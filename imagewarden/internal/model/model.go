package model

import (
	"fmt"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	ort "github.com/yalue/onnxruntime_go"

	"github.com/kalevski/toolcase/imagewarden/internal/imaging"
)

const (
	// dylibEnv names the environment variable that points at
	// libonnxruntime.so; defaultDylib matches the Docker layout (spec §9),
	// where the ONNX Runtime stage unpacks the .so into /usr/lib/.
	dylibEnv     = "ORT_DYLIB_PATH"
	defaultDylib = "/usr/lib/libonnxruntime.so"
)

var (
	initOnce sync.Once
	initErr  error
)

// ensureEnv points the binding at libonnxruntime.so and initializes the
// process-global ONNX Runtime environment exactly once, no matter how many
// times Load runs (e.g. once per test). SetSharedLibraryPath must be called
// before InitializeEnvironment — that ordering is the binding's contract.
func ensureEnv() error {
	initOnce.Do(func() {
		path := os.Getenv(dylibEnv)
		if path == "" {
			path = defaultDylib
		}
		ort.SetSharedLibraryPath(path)
		initErr = ort.InitializeEnvironment()
	})
	return initErr
}

// Shutdown releases the process-global ONNX Runtime environment. It is
// process-wide state, not per-Model, so callers must only invoke it once, at
// process exit, after every Model has been Close'd — cmd/run's graceful
// shutdown path calls it, not (*Model).Close (spec §4.1).
func Shutdown() error {
	return ort.DestroyEnvironment()
}

// Scores maps a manifest label to its softmax score (spec §4.1).
type Scores map[string]float32

// ModelInfo summarizes a loaded model for GET /status (spec §5).
type ModelInfo struct {
	Name         string
	Version      string
	Quantization string
	Labels       []string
}

// Model is the engine adapter over ONNX Runtime (spec §3.1, §4.1): one
// session built at boot and reused for every Classify call. ONNX Runtime's
// Run() is safe for concurrent use on a single session, so there is no
// session pool — only the per-call input/output tensors are private to each
// Classify invocation.
type Model struct {
	sess     *ort.DynamicAdvancedSession
	manifest Manifest
	labels   []string
	spec     imaging.TensorSpec
	inShape  ort.Shape
	outShape ort.Shape
}

// Load reads the manifest, verifies model.onnx's checksum, builds one ONNX
// Runtime session sized by threads (0 -> runtime.NumCPU()), and runs a
// warmup inference so a bad model, a shape mismatch, or an ORT/binding
// version mismatch fails Load instead of the first real request (spec §10
// boot order: config -> token -> model load -> warmup -> listen).
func Load(dir string, threads int, log *slog.Logger) (*Model, error) {
	manifest, err := LoadManifest(dir)
	if err != nil {
		return nil, err
	}

	if err := ensureEnv(); err != nil {
		return nil, fmt.Errorf("initialize onnx runtime: %w", err)
	}

	opts, err := ort.NewSessionOptions()
	if err != nil {
		return nil, fmt.Errorf("session options: %w", err)
	}
	defer opts.Destroy()

	if threads == 0 {
		threads = runtime.NumCPU()
	}
	if err := opts.SetIntraOpNumThreads(threads); err != nil {
		return nil, fmt.Errorf("set intra-op threads: %w", err)
	}
	if err := opts.SetInterOpNumThreads(1); err != nil { // one graph; inter-op parallelism buys nothing here
		return nil, fmt.Errorf("set inter-op threads: %w", err)
	}

	onnxPath := filepath.Join(dir, "model.onnx")
	sess, err := ort.NewDynamicAdvancedSession(
		onnxPath,
		[]string{manifest.Input.Name},
		[]string{manifest.Output.Name},
		opts,
	)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	spec := manifest.ToTensorSpec()
	m := &Model{
		sess:     sess,
		manifest: manifest,
		labels:   manifest.Labels,
		spec:     spec,
		inShape:  shapeFor(spec),
		outShape: ort.NewShape(1, int64(len(manifest.Labels))),
	}

	if err := m.warmup(); err != nil {
		sess.Destroy()
		return nil, err
	}

	log.Info("model loaded", "name", manifest.Name, "version", manifest.Version, "labels", len(manifest.Labels))
	return m, nil
}

// shapeFor derives the batch-1 input shape from spec's layout. NHWC vs NCHW
// ordering comes entirely from the manifest (via TensorSpec.Layout) — never
// hardcoded here.
func shapeFor(spec imaging.TensorSpec) ort.Shape {
	h, w := int64(spec.Height), int64(spec.Width)
	if spec.Layout == LayoutNCHW {
		return ort.NewShape(1, 3, h, w)
	}
	return ort.NewShape(1, h, w, 3)
}

// warmup runs one inference on a zero-filled tensor of the manifest's input
// shape and asserts the output width equals len(labels). Any failure here
// propagates out of Load so the caller refuses to open the port (spec §10).
func (m *Model) warmup() error {
	zero, err := ort.NewEmptyTensor[float32](m.inShape)
	if err != nil {
		return fmt.Errorf("model warmup: alloc input: %w", err)
	}
	defer zero.Destroy()

	warm, err := ort.NewEmptyTensor[float32](m.outShape)
	if err != nil {
		return fmt.Errorf("model warmup: alloc output: %w", err)
	}
	defer warm.Destroy()

	if err := m.sess.Run([]ort.ArbitraryTensor{zero}, []ort.ArbitraryTensor{warm}); err != nil {
		return fmt.Errorf("model warmup: %w", err)
	}
	if got := len(warm.GetData()); got != len(m.labels) {
		return fmt.Errorf("model warmup: output width %d != labels %d", got, len(m.labels))
	}
	return nil
}

// Classify runs one inference for t and maps the output to per-label
// softmax scores. The session's Run() is safe for concurrent calls; each
// call here allocates its own input/output tensors and destroys them before
// returning, so nothing mutable is shared across concurrent Classify calls
// (spec §4.1).
func (m *Model) Classify(t imaging.Tensor) (Scores, error) {
	in, err := ort.NewTensor(ort.NewShape(t.Shape...), t.Data)
	if err != nil {
		return nil, fmt.Errorf("classify: input tensor: %w", err)
	}
	defer in.Destroy()

	out, err := ort.NewEmptyTensor[float32](m.outShape)
	if err != nil {
		return nil, fmt.Errorf("classify: output tensor: %w", err)
	}
	defer out.Destroy()

	if err := m.sess.Run([]ort.ArbitraryTensor{in}, []ort.ArbitraryTensor{out}); err != nil {
		return nil, fmt.Errorf("classify: run: %w", err)
	}

	raw := out.GetData()
	if len(raw) != len(m.labels) {
		return nil, fmt.Errorf("classify: output width %d != labels %d", len(raw), len(m.labels))
	}

	probs := toProbabilities(raw)
	scores := make(Scores, len(m.labels))
	for i, label := range m.labels {
		scores[label] = probs[i]
	}
	return scores, nil
}

// toProbabilities normalizes raw model output into per-class probabilities.
// A MobileNet head converted by tools/preparemodel may already end in a
// softmax op (real weights), while the task-029 placeholder graph is a bare
// matmul that emits unbounded logits. Rather than assume one or the other,
// values that already look like a probability distribution (non-negative,
// summing to ~1) are passed through unchanged; anything else goes through a
// stable softmax. This avoids visibly wrong double-softmaxed scores on real
// weights while still normalizing raw logits from a logit-emitting graph.
func toProbabilities(raw []float32) []float32 {
	if looksLikeProbabilities(raw) {
		out := make([]float32, len(raw))
		copy(out, raw)
		return out
	}
	return softmax(raw)
}

// looksLikeProbabilities reports whether x already forms a probability
// distribution. The sum tolerance is 1e-2, not tighter: a quantized output
// head snaps each score to steps of its dequantization scale (~1/255), so a
// genuine softmax output can sum to 1 ± ~0.01 after int8 rounding — such a
// distribution must be passed through, not softmaxed a second time (double
// softmax flattens e.g. [0,0,0.99,0,0] into [0.15,0.15,0.40,0.15,0.15]).
func looksLikeProbabilities(x []float32) bool {
	var sum float64
	for _, v := range x {
		if v < 0 || v > 1 {
			return false
		}
		sum += float64(v)
	}
	return math.Abs(sum-1) < 1e-2
}

// softmax is the numerically stable softmax (max-subtraction before exp).
func softmax(x []float32) []float32 {
	max := x[0]
	for _, v := range x[1:] {
		if v > max {
			max = v
		}
	}
	var sum float64
	out := make([]float32, len(x))
	for i, v := range x {
		e := math.Exp(float64(v - max))
		out[i] = float32(e)
		sum += e
	}
	for i := range out {
		out[i] = float32(float64(out[i]) / sum)
	}
	return out
}

// Info summarizes the loaded model for GET /status (spec §5).
func (m *Model) Info() ModelInfo {
	return ModelInfo{
		Name:         m.manifest.Name,
		Version:      m.manifest.Version,
		Quantization: m.manifest.Quantization,
		Labels:       m.labels,
	}
}

// Spec returns the TensorSpec resolved from the manifest at Load, so
// callers (internal/imaging.Prepare, the ort integration test in task 011)
// don't need to re-read manifest.yml themselves.
func (m *Model) Spec() imaging.TensorSpec {
	return m.spec
}

// Close destroys the session. It deliberately does not tear down the
// process-global ONNX Runtime environment — other Models may still be live;
// call the package-level Shutdown once at process exit instead.
func (m *Model) Close() error {
	return m.sess.Destroy()
}

package classify

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/png"
	"testing"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/imaging"
	"github.com/kalevski/toolcase/imagewarden/internal/model"
	"github.com/kalevski/toolcase/imagewarden/internal/policy"
)

// fakeClassifier stands in for *model.Model with no CGO / ONNX Runtime link.
// If block is non-nil, Classify blocks on it — used to pin the semaphore slot.
type fakeClassifier struct {
	scores model.Scores
	block  chan struct{}
	err    error
}

func (f fakeClassifier) Classify(imaging.Tensor) (model.Scores, error) {
	if f.block != nil {
		<-f.block
	}
	return f.scores, f.err
}

func (f fakeClassifier) Info() model.ModelInfo {
	labels := make([]string, 0, len(f.scores))
	for k := range f.scores {
		labels = append(labels, k)
	}
	return model.ModelInfo{Name: "fake", Labels: labels}
}

// testSpec is a minimal valid spec. Its exact values only matter for the happy
// path, where the fake ignores the tensor anyway; decode-failure tests never
// reach tensorize.
func testSpec() imaging.TensorSpec {
	return imaging.TensorSpec{
		Width:  8,
		Height: 8,
		Layout: "NHWC",
		Scale:  255.0,
		Mean:   [3]float64{0, 0, 0},
		Std:    [3]float64{1, 1, 1},
		Name:   "input",
	}
}

// testPolicy blocks at 0.8 and reviews at 0.5 on the summed "porn" score.
func testPolicy() policy.PolicyConfig {
	return policy.PolicyConfig{
		UnsafeClasses:   []string{"porn"},
		BlockThreshold:  0.8,
		ReviewThreshold: 0.5,
	}
}

// pngBytes is a tiny valid PNG so imaging.Prepare succeeds on the happy path.
func pngBytes(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 16, 16))
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	return buf.Bytes()
}

func TestDoHappyPath(t *testing.T) {
	fake := fakeClassifier{scores: model.Scores{"porn": 0.9, "safe": 0.1}}
	s := New(fake, testSpec(), testPolicy(), 2, 1<<20, time.Second)

	v, err := s.Do(context.Background(), pngBytes(t))
	if err != nil {
		t.Fatalf("Do: unexpected error: %v", err)
	}
	if v.Decision != policy.DecisionBlock {
		t.Fatalf("Decision = %q, want %q", v.Decision, policy.DecisionBlock)
	}
	// float32(0.9) widened to float64 is ~0.8999999762, so compare with a
	// tolerance rather than against the float64 literal 0.9.
	if diff := v.UnsafeScore - 0.9; diff < -1e-6 || diff > 1e-6 {
		t.Fatalf("UnsafeScore = %v, want ~0.9", v.UnsafeScore)
	}
}

func TestDoQueueTimeout(t *testing.T) {
	block := make(chan struct{})
	defer close(block) // release the pinned slot when the test ends

	fake := fakeClassifier{scores: model.Scores{"porn": 0.9}, block: block}
	timeout := 20 * time.Millisecond
	s := New(fake, testSpec(), testPolicy(), 1, 1<<20, timeout)

	// Pin the single slot: this goroutine's Classify blocks on `block`.
	held := make(chan struct{})
	go func() {
		close(held)
		_, _ = s.Do(context.Background(), pngBytes(t))
	}()
	<-held
	// Wait until the slot is actually taken before racing the second call.
	waitForSem(t, s, 1)

	start := time.Now()
	_, err := s.Do(context.Background(), pngBytes(t))
	elapsed := time.Since(start)

	if !errors.Is(err, ErrQueueTimeout) {
		t.Fatalf("Do: err = %v, want ErrQueueTimeout", err)
	}
	if elapsed < timeout {
		t.Fatalf("returned after %v, expected to wait ~%v", elapsed, timeout)
	}
}

func TestDoContextCancellation(t *testing.T) {
	block := make(chan struct{})
	defer close(block)

	fake := fakeClassifier{scores: model.Scores{"porn": 0.9}, block: block}
	// Long queue timeout so cancellation, not the timer, ends the wait.
	s := New(fake, testSpec(), testPolicy(), 1, 1<<20, time.Minute)

	held := make(chan struct{})
	go func() {
		close(held)
		_, _ = s.Do(context.Background(), pngBytes(t))
	}()
	<-held
	waitForSem(t, s, 1)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := s.Do(ctx, pngBytes(t))
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("Do: err = %v, want context.Canceled", err)
	}
}

func TestDoImagingErrorPropagates(t *testing.T) {
	fake := fakeClassifier{scores: model.Scores{"porn": 0.9}}
	s := New(fake, testSpec(), testPolicy(), 2, 1<<20, time.Second)

	_, err := s.Do(context.Background(), []byte("not an image"))
	if !errors.Is(err, imaging.ErrUnsupportedFormat) {
		t.Fatalf("Do: err = %v, want imaging.ErrUnsupportedFormat", err)
	}
}

// waitForSem blocks until the service's semaphore holds want tokens, so tests
// don't race the goroutine that pins a slot. Fails the test if it never fills.
func waitForSem(t *testing.T, s *Service, want int) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if len(s.sem) >= want {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("semaphore never reached %d held tokens", want)
}

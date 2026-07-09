package policy

// Decision is the outcome of Decide: "allow", "review", or "block" (spec §4.2).
type Decision string

const (
	DecisionAllow  Decision = "allow"
	DecisionReview Decision = "review"
	DecisionBlock  Decision = "block"
)

// PolicyConfig configures the score -> decision thresholds (spec §6/§4.2).
//
// This is the canonical definition of the type. internal/config defines a
// field-for-field mirror (with yaml tags) rather than importing this package
// directly, because internal/config has no app-internal imports (see the
// import-boundary discipline in spec §4 / task 041) — the same rule that
// keeps this package stdlib-only. Callers that need to go from one shape to
// the other (e.g. wiring config.PolicyConfig into classify.Service, which
// takes a policy.PolicyConfig) convert with a plain
// policy.PolicyConfig(cfg.Policy).
//
// BorderlineClasses is carried here for future per-class handling but does
// not feed unsafe_score in v1 (spec §4.2 lists borderline_classes separately
// from unsafe_classes) — don't expect it to affect Decide's gate.
type PolicyConfig struct {
	UnsafeClasses     []string
	BorderlineClasses []string
	BlockThreshold    float64
	ReviewThreshold   float64
}

// Verdict carries the decision, the summed unsafe score, and the full class
// breakdown, so callers can apply stricter local rules without re-inferring
// (spec §4.2).
type Verdict struct {
	Decision    Decision
	UnsafeScore float64
	Scores      map[string]float32 // full class breakdown, copied (not aliased)
}

// Decide gates on the summed unsafe score. It never mutates s.
//
// s is accepted as a plain map[string]float32 (the model package's Scores
// shape) rather than a named type, so policy never imports model.
//
// Gate order matters: >= BlockThreshold is tested before >= ReviewThreshold,
// so when ReviewThreshold == BlockThreshold a score at that value resolves to
// block (block wins ties). The comparison is plain float64 >= with no
// epsilon: thresholds and the summed score are both float64, the boundary is
// inclusive by design, and the comparison is not fuzzed — a config author
// gets exactly the cutoff they wrote. (Each score's float32->float64
// widening is exact, so the summation is deterministic.)
func Decide(s map[string]float32, p PolicyConfig) Verdict {
	var unsafe float64
	for _, c := range p.UnsafeClasses {
		if v, ok := s[c]; ok { // labels not present in the scores map contribute 0
			unsafe += float64(v)
		}
	}

	decision := DecisionAllow
	switch {
	case unsafe >= p.BlockThreshold:
		decision = DecisionBlock
	case unsafe >= p.ReviewThreshold:
		decision = DecisionReview
	}

	// Copy the breakdown so callers can't observe/mutate a shared map.
	out := make(map[string]float32, len(s))
	for k, v := range s {
		out[k] = v
	}
	return Verdict{Decision: decision, UnsafeScore: unsafe, Scores: out}
}

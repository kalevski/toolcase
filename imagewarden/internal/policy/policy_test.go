package policy

import "testing"

// Score and threshold values below are chosen as exact binary fractions
// (multiples of 1/16) so a decimal literal parses to the same value as a
// float32 and as a float64 — the exact-equality assertions on UnsafeScore
// would otherwise be comparing float64(float32(0.8)) against a float64
// literal 0.8, which differ in their low bits despite both meaning "0.8".
func TestDecide(t *testing.T) {
	cases := []struct {
		name       string
		scores     map[string]float32
		cfg        PolicyConfig
		want       Decision
		wantUnsafe float64
	}{
		{
			name:   "boundary exactly at block threshold blocks",
			scores: map[string]float32{"porn": 0.75},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionBlock,
			wantUnsafe: 0.75,
		},
		{
			name:   "boundary exactly at review threshold reviews",
			scores: map[string]float32{"porn": 0.5},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionReview,
			wantUnsafe: 0.5,
		},
		{
			name:   "just below block threshold reviews",
			scores: map[string]float32{"porn": 0.6875},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionReview,
			wantUnsafe: 0.6875,
		},
		{
			name:   "just above block threshold blocks",
			scores: map[string]float32{"porn": 0.8125},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionBlock,
			wantUnsafe: 0.8125,
		},
		{
			name:   "just below review threshold allows",
			scores: map[string]float32{"porn": 0.4375},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionAllow,
			wantUnsafe: 0.4375,
		},
		{
			name:   "just above review threshold reviews",
			scores: map[string]float32{"porn": 0.5625},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionReview,
			wantUnsafe: 0.5625,
		},
		{
			name:   "empty unsafe classes always allows regardless of scores",
			scores: map[string]float32{"porn": 0.99, "hentai": 0.99},
			cfg: PolicyConfig{
				UnsafeClasses:   nil,
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionAllow,
			wantUnsafe: 0,
		},
		{
			name:   "unknown label listed but absent from scores is ignored",
			scores: map[string]float32{"neutral": 0.9},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionAllow,
			wantUnsafe: 0,
		},
		{
			name:   "multiple unsafe classes summed cross block gate only in sum",
			scores: map[string]float32{"porn": 0.375, "hentai": 0.4375},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn", "hentai"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionBlock,
			wantUnsafe: 0.8125,
		},
		{
			name:   "multiple unsafe classes summed cross review gate only in sum",
			scores: map[string]float32{"porn": 0.25, "hentai": 0.3125},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn", "hentai"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.5,
			},
			want:       DecisionReview,
			wantUnsafe: 0.5625,
		},
		{
			name:   "review threshold equal to block threshold: at value ties to block",
			scores: map[string]float32{"porn": 0.75},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.75,
			},
			want:       DecisionBlock,
			wantUnsafe: 0.75,
		},
		{
			name:   "review threshold equal to block threshold: just below allows",
			scores: map[string]float32{"porn": 0.6875},
			cfg: PolicyConfig{
				UnsafeClasses:   []string{"porn"},
				BlockThreshold:  0.75,
				ReviewThreshold: 0.75,
			},
			want:       DecisionAllow,
			wantUnsafe: 0.6875,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := Decide(c.scores, c.cfg)
			if got.Decision != c.want {
				t.Errorf("Decide() decision = %q, want %q", got.Decision, c.want)
			}
			if got.UnsafeScore != c.wantUnsafe {
				t.Errorf("Decide() unsafe score = %v, want %v", got.UnsafeScore, c.wantUnsafe)
			}
		})
	}
}

func TestDecideScoresIsACopy(t *testing.T) {
	input := map[string]float32{"porn": 0.9, "sexy": 0.1}
	cfg := PolicyConfig{UnsafeClasses: []string{"porn"}, BlockThreshold: 0.8, ReviewThreshold: 0.5}

	v := Decide(input, cfg)

	// Mutating the input after Decide must not affect the returned Verdict.
	input["porn"] = 0.0
	input["new"] = 1.0
	if v.Scores["porn"] != 0.9 {
		t.Errorf("Verdict.Scores mutated by later change to input map: got %v, want 0.9", v.Scores["porn"])
	}
	if _, ok := v.Scores["new"]; ok {
		t.Errorf("Verdict.Scores picked up a key added to the input map after Decide")
	}

	// Mutating the returned Verdict.Scores must not affect the original input.
	v.Scores["sexy"] = 0.0
	if input["sexy"] != 0.1 {
		t.Errorf("input map mutated by change to Verdict.Scores: got %v, want 0.1", input["sexy"])
	}
}

func TestDecideUnsafeScoreSum(t *testing.T) {
	scores := map[string]float32{"porn": 0.3125, "hentai": 0.25, "sexy": 0.9}
	cfg := PolicyConfig{
		UnsafeClasses:     []string{"porn", "hentai"},
		BorderlineClasses: []string{"sexy"},
		BlockThreshold:    0.80,
		ReviewThreshold:   0.50,
	}

	v := Decide(scores, cfg)

	want := 0.5625
	if v.UnsafeScore != want {
		t.Fatalf("UnsafeScore = %v, want %v (sexy is borderline, not unsafe, and must not contribute)", v.UnsafeScore, want)
	}
	if v.Decision != DecisionReview {
		t.Fatalf("Decision = %q, want %q", v.Decision, DecisionReview)
	}
}

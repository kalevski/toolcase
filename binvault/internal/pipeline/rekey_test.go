package pipeline_test

import (
	"context"
	"crypto/rand"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
)

// Pipeline secrets are sealed values like token secrets: boot and validate fail
// on a key that cannot open them, and rekey re-seals them (spec §4.7).
func TestSealedPipelineSecretsFollowMasterKeyRotation(t *testing.T) {
	ctx := context.Background()
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{
		"token":   map[string]any{"grants": []any{}},
		"service": map[string]any{"headers": map[string]any{"Authorization": "Bearer sealed-header"}, "signing_secret": strings.Repeat("s", 40)},
	})
	n.attach("bkt", "p")
	cfg1 := *n.cfg
	n.stop()

	newKey := make([]byte, 32)
	_, _ = rand.Read(newKey)
	stranger := make([]byte, 32)
	_, _ = rand.Read(stranger)

	// the wrong key: validate names the pipeline's secrets, and the node refuses to start
	wrong := cfg1
	wrong.MasterKey, wrong.MasterKeyOld = stranger, nil
	rep, err := app.Validate(ctx, &wrong, false)
	if err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(rep.Problems, "\n")
	if !strings.Contains(joined, "pipeline p service.headers") || !strings.Contains(joined, "pipeline p service.signing_secret") {
		t.Fatalf("validate with the wrong key: %v", rep.Problems)
	}
	if _, err := app.New(ctx, &wrong, slog.New(slog.NewTextHandler(io.Discard, nil)), app.Build{}); err == nil || !strings.Contains(err.Error(), "pipeline p") {
		t.Fatalf("boot with the wrong key must fail and name the pipeline: %v", err)
	}

	// rotation: the new key current, the old one kept for decrypting
	rot := cfg1
	rot.MasterKey, rot.MasterKeyOld = newKey, [][]byte{cfg1.MasterKey}
	if rep, err := app.Validate(ctx, &rot, false); err != nil || len(rep.Problems) != 0 {
		t.Fatalf("validate during rotation: %v %v", rep.Problems, err)
	}
	changed, err := app.RekeyDataDir(ctx, &rot)
	if err != nil || changed < 3 { // the token secret and the pipeline's two values
		t.Fatalf("rekey: %d %v", changed, err)
	}
	// afterwards the old key can go
	done := cfg1
	done.MasterKey, done.MasterKeyOld = newKey, nil
	if rep, err := app.Validate(ctx, &done, false); err != nil || len(rep.Problems) != 0 {
		t.Fatalf("validate after rekey: %v %v", rep.Problems, err)
	}
	n2 := startNodeCfg(t, withEphemeralPorts(done))
	svc.on("p", func(cl *call) reply { return reply{} })
	n2.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	n2.waitRunState("pipeline=p", "succeeded")
	cl := svc.callsOf("p")[0]
	if cl.Header.Get("Authorization") != "Bearer sealed-header" || !strings.HasPrefix(cl.Header.Get("X-Binvault-Signature"), "v1=") {
		t.Fatalf("the sealed values survive the rotation: %v", cl.Header)
	}
}

func withEphemeralPorts(c config.Config) *config.Config {
	c.Listen, c.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
	return &c
}

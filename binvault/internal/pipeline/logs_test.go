package pipeline_test

import (
	"strings"
	"sync"
	"testing"
)

type lockedBuf struct {
	mu sync.Mutex
	b  strings.Builder
}

func (l *lockedBuf) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.Write(p)
}

func (l *lockedBuf) String() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.String()
}

// Every request of a pipeline token is logged as pipeline:<name>/<run> (spec
// §9.1), and a run's outcome is logged with its id. Secrets are never logged.
func TestLogsNameThePipelinePrincipalAndNeverLeakTokens(t *testing.T) {
	buf := &lockedBuf{}
	logSink = buf
	defer func() { logSink = nil }()
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", nil)
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "reader", "after", map[string]any{
		"service": map[string]any{"headers": map[string]any{"Authorization": "Bearer log-me-not"}, "signing_secret": strings.Repeat("q", 40)},
	})
	n.attach("bkt", "reader")
	var bearer string
	svc.on("reader", func(cl *call) reply {
		bearer = cl.bearer()
		n.s3b(bearer, "GET", objPath("bkt", cl.str("key")), nil)
		return reply{}
	})
	n.must(c, 200, "PUT", objPath("bkt", "k"), []byte("x"))
	r := n.waitRunState("pipeline=reader", "succeeded")
	n.stop()
	out := buf.String()
	if !strings.Contains(out, "principal=pipeline:reader/"+r["id"].(string)) {
		t.Errorf("the access log must name the pipeline principal:\n%s", grep(out, "request"))
	}
	if !strings.Contains(out, "pipeline run succeeded") || !strings.Contains(out, "run="+r["id"].(string)) {
		t.Errorf("the run outcome is logged with its id:\n%s", grep(out, "pipeline"))
	}
	secretPart := bearer[strings.Index(bearer, ".")+1:]
	for _, secret := range []string{secretPart, "log-me-not", strings.Repeat("q", 40), c.sk} {
		if strings.Contains(out, secret) {
			t.Errorf("a secret reached the log: %q", secret)
		}
	}
}

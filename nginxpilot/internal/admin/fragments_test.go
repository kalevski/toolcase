package admin

import (
	"reflect"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// Every list field on config.Fragment must be counted by fragmentCounts —
// otherwise a new resource kind slips through the shape gate (the bug that
// let a "site" fragment smuggle streams before the shared helper existed).
func TestFragmentCountsCoverEveryList(t *testing.T) {
	typ := reflect.TypeOf(config.Fragment{})
	listFields := 0
	for i := 0; i < typ.NumField(); i++ {
		if typ.Field(i).Type.Kind() == reflect.Slice {
			listFields++
		}
	}
	counts := fragmentCounts(&config.Fragment{})
	if len(counts) != listFields {
		t.Fatalf("fragmentCounts covers %d kinds but config.Fragment declares %d list fields — update fragmentCounts",
			len(counts), listFields)
	}
}

func TestRequireExactlyOne(t *testing.T) {
	frag := &config.Fragment{Proxies: []config.Proxy{{Domain: "a.com"}}}
	if err := requireExactlyOne(frag, "proxy"); err != nil {
		t.Errorf("one proxy should pass: %v", err)
	}
	if err := requireExactlyOne(frag, "site"); err == nil {
		t.Error("wrong kind should fail")
	}
	frag.Streams = []config.Stream{{Name: "s"}}
	if err := requireExactlyOne(frag, "proxy"); err == nil {
		t.Error("a proxy fragment smuggling a stream must fail the shape gate")
	}
	frag = &config.Fragment{Redirects: []config.Redirect{{Domain: "a.com"}, {Domain: "b.com"}}}
	if err := requireExactlyOne(frag, "redirect"); err == nil {
		t.Error("two redirects must fail")
	}
	frag = &config.Fragment{DeadHosts: []config.DeadHost{{Domain: "a.com"}}}
	if err := requireExactlyOne(frag, "dead_host"); err != nil {
		t.Errorf("one dead_host should pass: %v", err)
	}
}

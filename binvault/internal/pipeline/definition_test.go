package pipeline

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

var testEnv = Env{BeforeTotalTimeout: 25 * time.Second}

// def decodes a JSON definition the way the admin API does (onto the defaults).
func def(t *testing.T, doc string) Definition {
	t.Helper()
	d := NewDefinition()
	if err := json.Unmarshal([]byte(doc), &d); err != nil {
		t.Fatalf("decode %s: %v", doc, err)
	}
	return d
}

func normalize(t *testing.T, doc string) (Definition, map[string]string) {
	t.Helper()
	d := def(t, doc)
	return d, d.Normalize(testEnv)
}

func mustValid(t *testing.T, doc string) Definition {
	t.Helper()
	d, f := normalize(t, doc)
	if len(f) > 0 {
		t.Fatalf("%s: unexpected problems %v", doc, f)
	}
	return d
}

func mustFail(t *testing.T, doc string, field string) {
	t.Helper()
	_, f := normalize(t, doc)
	if _, ok := f[field]; !ok {
		t.Fatalf("%s: want a problem with %q, got %v", doc, field, f)
	}
}

const minAfter = `{"name":"p","stage":"after","service":{"url":"http://svc:8080/h"}}`
const minBefore = `{"name":"g","stage":"before","service":{"url":"http://svc:8080/h"}}`

func TestDefaultsAfter(t *testing.T) {
	d := mustValid(t, minAfter)
	if !d.Enabled || d.Paused || strings.Join(d.Events, ",") != "object.created,object.updated" {
		t.Errorf("enabled/paused/events: %+v", d)
	}
	if d.Service.Timeout != "30s" || d.OnError != "stop" || d.Limits.MaxConcurrency != 8 || d.Limits.QueueTimeout != "" {
		t.Errorf("service/on_error/limits: %+v", d)
	}
	if d.Retry.MaxAttempts != 5 || strings.Join(d.Retry.Backoff, ",") != "10s,1m,10m,1h" {
		t.Errorf("retry: %+v", d.Retry)
	}
	if len(d.Token.Grants) != 1 || d.Token.Grants[0].Actions[0] != "read" || d.Token.Grants[0].Keys[0] != "{key}" {
		t.Errorf("default grants: %+v", d.Token.Grants)
	}
	if d.Service.Headers == nil {
		t.Error("headers must be an object")
	}
}

func TestDefaultsBefore(t *testing.T) {
	d := mustValid(t, minBefore)
	if d.Service.Timeout != "20s" || d.OnError != "reject" || d.Limits.QueueTimeout != "5s" || d.Retry.MaxAttempts != 1 ||
		strings.Join(d.Retry.Backoff, ",") != "1s" {
		t.Errorf("before defaults: %+v", d)
	}
}

func TestEmptyGrantsMeanNoToken(t *testing.T) {
	d := mustValid(t, `{"name":"n","stage":"after","service":{"url":"http://s/h"},"token":{"grants":[]}}`)
	if d.Token.Grants == nil || len(d.Token.Grants) != 0 {
		t.Fatalf("grants [] must stay empty (no token), got %#v", d.Token.Grants)
	}
}

func TestNameAndStage(t *testing.T) {
	for _, name := range []string{"a", "compress-images", "x_1", "0abc", strings.Repeat("a", 63)} {
		mustValid(t, `{"name":"`+name+`","stage":"after","service":{"url":"http://s/h"}}`)
	}
	for _, name := range []string{"", "A", "-a", "_a", "a b", "a.b", "a/b", strings.Repeat("a", 64), "é"} {
		mustFail(t, `{"name":"`+name+`","stage":"after","service":{"url":"http://s/h"}}`, "name")
	}
	mustFail(t, `{"name":"a","service":{"url":"http://s/h"}}`, "stage")
	mustFail(t, `{"name":"a","stage":"during","service":{"url":"http://s/h"}}`, "stage")
}

func TestPausedOnlyOnAfter(t *testing.T) {
	mustValid(t, `{"name":"a","stage":"after","paused":true,"service":{"url":"http://s/h"}}`)
	mustFail(t, `{"name":"a","stage":"before","paused":true,"service":{"url":"http://s/h"}}`, "paused")
}

func TestEvents(t *testing.T) {
	d := mustValid(t, `{"name":"a","stage":"after","events":["object.deleted","object.deleted"],"service":{"url":"http://s/h"}}`)
	if len(d.Events) != 1 || d.Events[0] != "object.deleted" {
		t.Errorf("events dedupe: %v", d.Events)
	}
	mustFail(t, `{"name":"a","stage":"after","events":["object.exploded"],"service":{"url":"http://s/h"}}`, "events")
	d = mustValid(t, `{"name":"a","stage":"after","events":[],"service":{"url":"http://s/h"}}`)
	if len(d.Events) != 2 {
		t.Errorf("empty events take the default: %v", d.Events)
	}
}

func TestMatchValidation(t *testing.T) {
	with := func(stage, match string) string {
		return `{"name":"a","stage":"` + stage + `","service":{"url":"http://s/h"},"match":` + match + `}`
	}
	mustValid(t, with("after", `{"keys":["uploads/**","*.{jpg,png}"],"exclude_keys":["raw/**"],"content_type":["image/*","application/pdf"],"content_type_source":"sniffed","operations":["put","lifecycle","backfill"],"min_size":1,"max_size":10}`))
	mustFail(t, with("after", `{"keys":["[a-"]}`), "match.keys[0]")
	mustFail(t, with("after", `{"exclude_keys":["{a,b"]}`), "match.exclude_keys[0]")
	mustFail(t, with("after", `{"content_type":["image"]}`), "match.content_type")
	mustFail(t, with("after", `{"content_type_source":"guessed"}`), "match.content_type_source")
	mustFail(t, with("after", `{"operations":["teleport"]}`), "match.operations")
	mustFail(t, with("after", `{"min_size":-1}`), "match.min_size")
	mustFail(t, with("after", `{"min_size":10,"max_size":5}`), "match.max_size")
	// only put, post, copy, multipart and delete can run a before chain
	mustValid(t, with("before", `{"operations":["put","post","copy","multipart","delete"]}`))
	for _, op := range []string{"delete_version", "lifecycle", "backfill"} {
		mustFail(t, with("before", `{"operations":["`+op+`"]}`), "match.operations")
	}
	many := make([]string, 101)
	for i := range many {
		many[i] = "a"
	}
	b, _ := json.Marshal(many)
	mustFail(t, with("after", `{"keys":`+string(b)+`}`), "match.keys")
}

func TestServiceURL(t *testing.T) {
	url := func(u string) string {
		return `{"name":"a","stage":"after","service":{"url":"` + u + `"}}`
	}
	mustValid(t, url("http://svc"))
	mustValid(t, url("https://svc.example.com:8443/hooks/binvault?x=1"))
	mustFail(t, url(""), "service.url")
	mustFail(t, url("ftp://svc/h"), "service.url")
	mustFail(t, url("svc:8080/h"), "service.url")
	mustFail(t, url("http:///h"), "service.url")
	mustFail(t, url("http://user:pw@svc/h"), "service.url")
	mustFail(t, url("http://svc/h#frag"), "service.url")
	mustFail(t, url("http://"+strings.Repeat("a", 2100)), "service.url")
	mustValid(t, `{"name":"a","stage":"after","service":{"url":"http://s/h","s3_endpoint":"https://s3.internal:9000"}}`)
	mustFail(t, `{"name":"a","stage":"after","service":{"url":"http://s/h","s3_endpoint":"file:///x"}}`, "service.s3_endpoint")
}

func TestServiceHeaders(t *testing.T) {
	hdr := func(h string) string {
		return `{"name":"a","stage":"after","service":{"url":"http://s/h","headers":` + h + `}}`
	}
	mustValid(t, hdr(`{"Authorization":"Bearer abc","X-Api-Key":"k"}`))
	for _, name := range []string{"Host", "host", "Content-Length", "X-Binvault-Run", "x-binvault-signature", "Transfer-Encoding"} {
		mustFail(t, hdr(`{"`+name+`":"v"}`), "service.headers."+name)
	}
	mustFail(t, hdr(`{"Bad Name":"v"}`), "service.headers.Bad Name")
	mustFail(t, hdr(`{"X-A":"line\nbreak"}`), "service.headers.X-A")
	mustFail(t, hdr(`{"X-A":"nul\u0000"}`), "service.headers.X-A")
	mustValid(t, hdr(`{"X-A":"tab\there"}`))
	mustFail(t, hdr(`{"X-A":"`+strings.Repeat("v", 5000)+`"}`), "service.headers.X-A")
	mustFail(t, hdr(`{"X-A":"1","x-a":"2"}`), "service.headers.x-a")
	var many []string
	for i := 0; i < 17; i++ {
		many = append(many, `"X-H`+string(rune('a'+i))+`":"v"`)
	}
	mustFail(t, hdr(`{`+strings.Join(many, ",")+`}`), "service.headers")
	mustValid(t, hdr(`{`+strings.Join(many[:16], ",")+`}`))
}

func TestSigningSecret(t *testing.T) {
	sec := func(s string) string {
		return `{"name":"a","stage":"after","service":{"url":"http://s/h","signing_secret":` + s + `}}`
	}
	mustValid(t, sec(`"`+strings.Repeat("s", 32)+`"`))
	mustFail(t, sec(`"`+strings.Repeat("s", 31)+`"`), "service.signing_secret")
	d, f := normalize(t, sec(`null`))
	if len(f) != 0 || !d.Service.SigningSecret.Set || !d.Service.SigningSecret.Null {
		t.Errorf("null removes the secret: %+v %v", d.Service.SigningSecret, f)
	}
	d = def(t, minAfter)
	if d.Service.SigningSecret.Set {
		t.Error("an absent secret must read as unset (keeps the stored one)")
	}
}

func TestTimeouts(t *testing.T) {
	to := func(stage, v string) string {
		return `{"name":"a","stage":"` + stage + `","service":{"url":"http://s/h","timeout":"` + v + `"}}`
	}
	mustValid(t, to("after", "1s"))
	mustValid(t, to("after", "30m"))
	mustFail(t, to("after", "31m"), "service.timeout")
	mustFail(t, to("after", "999ms"), "service.timeout")
	mustFail(t, to("after", "soon"), "service.timeout")
	mustValid(t, to("before", "25s"))
	mustFail(t, to("before", "26s"), "service.timeout") // above BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT
	mustFail(t, to("before", "500ms"), "service.timeout")
	// the ceiling is the configured budget
	d := def(t, to("before", "40s"))
	if f := d.Normalize(Env{BeforeTotalTimeout: time.Minute}); len(f) != 0 {
		t.Errorf("a larger budget allows a larger timeout: %v", f)
	}
}

func TestTokenGrants(t *testing.T) {
	g := func(stage, grants string) string {
		return `{"name":"a","stage":"` + stage + `","service":{"url":"http://s/h"},"token":{"grants":` + grants + `}}`
	}
	mustValid(t, g("after", `[{"actions":["read"],"keys":["{key}"]},{"actions":["write","list"],"keys":["derived/{key}/*"]},{"actions":["delete","tag","purge","create"],"keys":["{dir}/{name}.webp"]}]`))
	mustValid(t, g("after", `[{"actions":["read"]}]`)) // every key
	mustFail(t, g("after", `[{"actions":[]}]`), "token.grants[0].actions")
	mustFail(t, g("after", `[{"actions":["fly"]}]`), "token.grants[0].actions")
	mustFail(t, g("after", `[{"actions":["read"],"keys":[]}]`), "token.grants[0].keys")
	mustFail(t, g("after", `[{"actions":["read"],"keys":["{bogus}"]}]`), "token.grants[0].keys[0]")
	mustFail(t, g("after", `[{"actions":["read"],"keys":["a*b"]}]`), "token.grants[0].keys[0]")
	mustFail(t, g("after", `[{"actions":["read"],"keys":["{key"]}]`), "token.grants[0].keys[0]")

	// before: staged-view grants must be {key} exactly, and purge is not allowed
	mustValid(t, g("before", `[{"actions":["read","delete","write","tag","create"],"keys":["{key}"]},{"actions":["read","list"],"keys":["rules/*"]}]`))
	mustValid(t, g("before", `[{"actions":["read"]}]`))
	for _, a := range []string{"create", "write", "delete", "tag"} {
		mustFail(t, g("before", `[{"actions":["`+a+`"],"keys":["derived/{key}"]}]`), "token.grants[0].keys")
		mustFail(t, g("before", `[{"actions":["`+a+`"],"keys":["*"]}]`), "token.grants[0].keys")
		mustFail(t, g("before", `[{"actions":["`+a+`"]}]`), "token.grants[0].keys")
		mustFail(t, g("before", `[{"actions":["`+a+`"],"keys":["{key}","other"]}]`), "token.grants[0].keys")
	}
	mustFail(t, g("before", `[{"actions":["purge"],"keys":["{key}"]}]`), "token.grants[0].actions")
	many := strings.Repeat(`{"actions":["read"]},`, 17)
	mustFail(t, g("after", `[`+many[:len(many)-1]+`]`), "token.grants")
}

func TestLimitsAndRetry(t *testing.T) {
	doc := func(stage, extra string) string {
		return `{"name":"a","stage":"` + stage + `","service":{"url":"http://s/h"},` + extra + `}`
	}
	mustValid(t, doc("after", `"limits":{"max_concurrency":256},"retry":{"max_attempts":10,"backoff":["1s","90m"]}`))
	mustFail(t, doc("after", `"limits":{"max_concurrency":257}`), "limits.max_concurrency")
	mustFail(t, doc("after", `"limits":{"max_concurrency":-1}`), "limits.max_concurrency")
	mustFail(t, doc("after", `"retry":{"max_attempts":11}`), "retry.max_attempts")
	mustFail(t, doc("after", `"retry":{"max_attempts":-1}`), "retry.max_attempts")
	mustFail(t, doc("after", `"retry":{"backoff":["soon"]}`), "retry.backoff[0]")
	mustFail(t, doc("after", `"retry":{"backoff":["0s"]}`), "retry.backoff[0]")
	mustFail(t, doc("after", `"retry":{"backoff":["-1s"]}`), "retry.backoff[0]")

	mustValid(t, doc("before", `"retry":{"max_attempts":3,"backoff":["5s"]}`))
	mustFail(t, doc("before", `"retry":{"max_attempts":4}`), "retry.max_attempts")
	mustFail(t, doc("before", `"retry":{"backoff":["6s"]}`), "retry.backoff[0]")
	mustValid(t, doc("before", `"limits":{"queue_timeout":"250ms"}`))
	mustFail(t, doc("before", `"limits":{"queue_timeout":"fast"}`), "limits.queue_timeout")
	mustFail(t, doc("before", `"limits":{"queue_timeout":"0s"}`), "limits.queue_timeout")
}

func TestOnError(t *testing.T) {
	doc := func(stage, v string) string {
		return `{"name":"a","stage":"` + stage + `","service":{"url":"http://s/h"},"on_error":"` + v + `"}`
	}
	mustValid(t, doc("before", "reject"))
	mustValid(t, doc("before", "continue"))
	mustFail(t, doc("before", "stop"), "on_error")
	mustValid(t, doc("after", "stop"))
	mustValid(t, doc("after", "continue"))
	mustFail(t, doc("after", "reject"), "on_error")
}

func TestDescription(t *testing.T) {
	mustValid(t, `{"name":"a","stage":"after","description":"`+strings.Repeat("é", 500)+`","service":{"url":"http://s/h"}}`)
	mustFail(t, `{"name":"a","stage":"after","description":"`+strings.Repeat("é", 501)+`","service":{"url":"http://s/h"}}`, "description")
}

func TestPublicRedactsSecrets(t *testing.T) {
	d := mustValid(t, `{"name":"a","stage":"after","service":{"url":"http://s/h","headers":{"Authorization":"Bearer secret"},"signing_secret":"`+strings.Repeat("s", 40)+`"}}`)
	pub := d.Public(true)
	raw, _ := json.Marshal(pub)
	if strings.Contains(string(raw), "Bearer secret") || strings.Contains(string(raw), strings.Repeat("s", 40)) {
		t.Fatalf("secrets leaked: %s", raw)
	}
	var back map[string]any
	_ = json.Unmarshal(raw, &back)
	svc := back["service"].(map[string]any)
	if svc["headers"].(map[string]any)["Authorization"] != "***" || svc["has_signing_secret"] != true {
		t.Fatalf("redaction: %v", svc)
	}
	if _, ok := svc["signing_secret"]; ok {
		t.Fatal("signing_secret must be omitted")
	}
	// the original is untouched
	if d.Service.Headers["Authorization"] != "Bearer secret" {
		t.Fatal("Public must not modify the definition")
	}
}

func TestMergePatch(t *testing.T) {
	target := map[string]any{"a": 1.0, "b": map[string]any{"c": 2.0, "d": 3.0}, "l": []any{1.0}}
	MergePatch(target, map[string]any{"a": nil, "b": map[string]any{"c": nil, "e": 4.0}, "l": []any{9.0}, "n": "new"})
	raw, _ := json.Marshal(target)
	if string(raw) != `{"b":{"d":3,"e":4},"l":[9],"n":"new"}` {
		t.Fatalf("merge patch: %s", raw)
	}
}

func TestNullableStringJSON(t *testing.T) {
	var s Service
	if err := json.Unmarshal([]byte(`{"signing_secret":"x"}`), &s); err != nil || !s.SigningSecret.Set || s.SigningSecret.Null || s.SigningSecret.V != "x" {
		t.Fatalf("string: %+v %v", s.SigningSecret, err)
	}
	s = Service{}
	if err := json.Unmarshal([]byte(`{"signing_secret":null}`), &s); err != nil || !s.SigningSecret.Set || !s.SigningSecret.Null {
		t.Fatalf("null: %+v %v", s.SigningSecret, err)
	}
	raw, _ := json.Marshal(Service{})
	if strings.Contains(string(raw), "signing_secret") {
		t.Fatalf("an unset secret must not be marshalled: %s", raw)
	}
	_ = meta.Grant{}
}

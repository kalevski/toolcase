// Package sanitize turns untrusted message HTML into a safe, self-contained
// HTML document (spec §3.7). It is an allow-list sanitiser built on the
// golang.org/x/net/html tokenizer: elements, attributes, URL schemes and CSS
// properties not on a list are dropped, remote content is blocked unless the
// caller asks for it, and links are rewritten. It is defence in depth: the
// result is still shown in a sandboxed, script-less iframe with a CSP.
package sanitize

import (
	"fmt"
	"io"
	"net/url"
	"regexp"
	"strings"

	"golang.org/x/net/html"
)

// Options control one sanitising run.
type Options struct {
	// LoadRemote allows http(s) images and CSS url()s through. Off by default:
	// remote images are tracking pixels.
	LoadRemote bool
	// ResolveCID maps a Content-ID (without "cid:") to a data: URI of the
	// referenced inline image. nil or ok=false leaves the image out.
	ResolveCID func(cid string) (dataURI string, ok bool)
	// MaxInput caps the input size in bytes (default 2 MiB); the rest is cut.
	MaxInput int
}

// Result is the sanitised document.
type Result struct {
	// HTML is a complete document: charset, a restrictive CSP meta, a style
	// block and the cleaned body.
	HTML string
	// HasRemote: the message referenced remote content (images, backgrounds).
	HasRemote bool
	// Blocked is how many remote references were removed (0 when LoadRemote).
	Blocked int
	// Plain: the document came from a plain-text body.
	Plain bool
}

const defaultMaxInput = 2 << 20

var allowedTags = map[string]bool{}

func init() {
	for _, t := range strings.Fields(`a abbr address article aside b bdi bdo big blockquote br caption center cite code col colgroup
		dd del details dfn div dl dt em figcaption figure font footer h1 h2 h3 h4 h5 h6 header hr i img ins kbd li main mark nav
		ol p pre q s samp section small span strike strong sub summary sup table tbody td tfoot th thead tr tt u ul var wbr`) {
		allowedTags[t] = true
	}
}

// dropContent elements are removed together with everything inside them.
var dropContent = map[string]bool{
	"script": true, "iframe": true, "object": true, "embed": true, "applet": true, "svg": true, "math": true,
	"noscript": true, "template": true, "head": true, "title": true, "textarea": true, "select": true,
	"frameset": true, "frame": true, "noframes": true, "noembed": true, "xmp": true, "plaintext": true,
	"audio": true, "video": true, "canvas": true, "map": true, "datalist": true, "option": true, "optgroup": true,
	"button": true, "dialog": true, "slot": true, "portal": true, "marquee": true, "bgsound": true,
}

var voidTags = map[string]bool{"br": true, "hr": true, "img": true, "col": true, "wbr": true, "embed": true, "frame": true, "bgsound": true}

// Per-attribute value shapes.
var (
	reNum    = regexp.MustCompile(`^[0-9]{1,5}(\.[0-9]+)?(%|px)?$`)
	reWord   = regexp.MustCompile(`^[A-Za-z-]{1,24}$`)
	reColor  = regexp.MustCompile(`^[#A-Za-z0-9(),.% ]{1,40}$`)
	reClass  = regexp.MustCompile(`^[A-Za-z0-9_\- ]{1,200}$`)
	reFace   = regexp.MustCompile(`^[A-Za-z0-9 ,'"\-]{1,100}$`)
	reLang   = regexp.MustCompile(`^[A-Za-z0-9-]{1,16}$`)
	reDigits = regexp.MustCompile(`^[0-9]{1,6}$`)
)

type attrRule int

const (
	aNum attrRule = iota
	aWord
	aColor
	aDigits
)

// globalAttrs apply to every allowed element.
var globalAttrs = map[string]attrRule{"dir": aWord, "align": aWord, "valign": aWord, "bgcolor": aColor, "color": aColor}

var tagAttrs = map[string]map[string]attrRule{
	"table":    {"width": aNum, "height": aNum, "border": aNum, "cellpadding": aNum, "cellspacing": aNum},
	"td":       {"width": aNum, "height": aNum, "colspan": aDigits, "rowspan": aDigits, "nowrap": aWord},
	"th":       {"width": aNum, "height": aNum, "colspan": aDigits, "rowspan": aDigits, "nowrap": aWord},
	"tr":       {"height": aNum},
	"col":      {"width": aNum, "span": aDigits},
	"colgroup": {"width": aNum, "span": aDigits},
	"font":     {"size": aWord},
	"hr":       {"width": aNum, "size": aNum, "noshade": aWord},
	"ol":       {"start": aDigits, "type": aWord},
	"ul":       {"type": aWord},
	"li":       {"value": aDigits},
	"img":      {"width": aNum, "height": aNum, "border": aNum, "hspace": aNum, "vspace": aNum},
}

// Sanitize cleans HTML.
func Sanitize(src string, o Options) Result {
	max := o.MaxInput
	if max <= 0 {
		max = defaultMaxInput
	}
	if len(src) > max {
		src = src[:max]
		for len(src) > 0 && !validUTF8Tail(src) {
			src = src[:len(src)-1]
		}
	}
	s := &state{o: o}
	s.body.Grow(len(src)) // output is about the size of the input; avoids repeated regrowth
	s.run(src)
	return Result{HTML: s.document(), HasRemote: s.remote > 0, Blocked: s.blocked, Plain: false}
}

func validUTF8Tail(s string) bool {
	return strings.ToValidUTF8(s[max(0, len(s)-4):], "\x00") == s[max(0, len(s)-4):]
}

type state struct {
	o       Options
	body    strings.Builder
	styles  []string
	stack   []string
	remote  int
	blocked int
	// body element presentation, folded into a wrapper div
	bodyAttrs string
}

func (s *state) countRemote() {
	s.remote++
	if !s.o.LoadRemote {
		s.blocked++
	}
}

func (s *state) run(src string) {
	z := html.NewTokenizer(strings.NewReader(src))
	skipName := "" // inside a dropContent element
	skipDepth := 0
	inStyle := false
	var styleText strings.Builder
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			if z.Err() != io.EOF {
				// tolerate any other error: keep what was parsed
				break
			}
			break
		}
		t := z.Token()
		name := strings.ToLower(t.Data)
		if skipName != "" {
			switch tt {
			case html.StartTagToken:
				if name == skipName {
					skipDepth++
				}
			case html.EndTagToken:
				if name == skipName {
					skipDepth--
					if skipDepth == 0 {
						skipName = ""
					}
				}
			}
			continue
		}
		if inStyle {
			switch tt {
			case html.TextToken:
				styleText.WriteString(t.Data)
			case html.EndTagToken:
				if name == "style" {
					inStyle = false
					if css := SanitizeCSS(styleText.String(), s.cssOpts()); css != "" {
						s.styles = append(s.styles, css)
					}
					styleText.Reset()
				}
			}
			continue
		}
		switch tt {
		case html.TextToken:
			s.body.WriteString(html.EscapeString(t.Data))
		case html.StartTagToken, html.SelfClosingTagToken:
			switch {
			case name == "style":
				if tt == html.StartTagToken {
					inStyle = true
				}
			case name == "body":
				s.bodyAttrs = s.attrs("div", t.Attr, false)
			case dropContent[name]:
				if tt == html.StartTagToken && !voidTags[name] {
					skipName, skipDepth = name, 1
				}
			case allowedTags[name]:
				s.start(name, t.Attr, tt == html.SelfClosingTagToken)
			}
			// unknown / form / meta / link / base / html: tag dropped, children kept
		case html.EndTagToken:
			if allowedTags[name] && !voidTags[name] {
				s.end(name)
			}
		}
	}
	for len(s.stack) > 0 {
		s.pop()
	}
}

func (s *state) cssOpts() CSSOptions {
	return CSSOptions{LoadRemote: s.o.LoadRemote, ResolveCID: s.o.ResolveCID, OnRemote: s.countRemote}
}

func (s *state) start(name string, attrs []html.Attribute, selfClosing bool) {
	out := s.attrs(name, attrs, true)
	if name == "img" {
		var ok bool
		out, ok = s.imgAttrs(attrs, out)
		if !ok {
			// No usable source (remote and blocked, an unresolved cid:, a bad URL): never a broken-image glyph.
			s.blockedImage(attrs)
			return
		}
	}
	s.body.WriteByte('<')
	s.body.WriteString(name)
	s.body.WriteString(out)
	s.body.WriteByte('>')
	if voidTags[name] {
		return
	}
	s.stack = append(s.stack, name)
}

func (s *state) end(name string) {
	for i := len(s.stack) - 1; i >= 0; i-- {
		if s.stack[i] == name {
			for len(s.stack) > i {
				s.pop()
			}
			return
		}
	}
}

func (s *state) pop() {
	n := s.stack[len(s.stack)-1]
	s.stack = s.stack[:len(s.stack)-1]
	s.body.WriteString("</")
	s.body.WriteString(n)
	s.body.WriteByte('>')
}

// attrs renders the allowed attributes of an element (without img/a special
// handling, which follows).
func (s *state) attrs(tag string, attrs []html.Attribute, full bool) string {
	var b strings.Builder
	var href string
	hasTitle := false
	for _, a := range attrs {
		k := strings.ToLower(a.Key)
		v := a.Val
		switch {
		case k == "style":
			if css := SanitizeDeclarations(v, s.cssOpts()); css != "" {
				writeAttr(&b, "style", html.EscapeString(css))
			}
		case k == "class":
			if reClass.MatchString(v) {
				writeAttr(&b, "class", html.EscapeString(v))
			}
		case k == "lang":
			if reLang.MatchString(v) {
				writeAttr(&b, "lang", html.EscapeString(v))
			}
		case k == "title":
			hasTitle = true
			writeAttr(&b, "title", html.EscapeString(clip(v, 200)))
		case k == "alt" && tag == "img":
			writeAttr(&b, "alt", html.EscapeString(clip(v, 500)))
		case k == "face" && tag == "font":
			if reFace.MatchString(v) {
				writeAttr(&b, "face", html.EscapeString(v))
			}
		case k == "href" && tag == "a":
			href = v
		case k == "background":
			// legacy background image: remote content, never kept
			if tag == "table" || tag == "td" || tag == "th" || tag == "tr" || tag == "div" {
				if u, kind := classifyURL(v); kind == urlRemote {
					_ = u
					s.countRemote()
				}
			}
		default:
			rule, ok := globalAttrs[k]
			if !ok {
				rule, ok = tagAttrs[tag][k]
			}
			if ok && attrValueOK(rule, v) {
				writeAttr(&b, k, html.EscapeString(v))
			}
		}
	}
	if tag == "a" && full {
		if u, ok := SafeLinkURL(href); ok {
			fmt.Fprintf(&b, ` href="%s" target="_blank" rel="noopener noreferrer"`, html.EscapeString(u))
			if !hasTitle {
				writeAttr(&b, "title", html.EscapeString(clip(u, 200)))
			}
		}
	}
	return b.String()
}

// writeAttr appends ` name="escapedValue"`.
func writeAttr(b *strings.Builder, name, escaped string) {
	b.WriteByte(' ')
	b.WriteString(name)
	b.WriteString(`="`)
	b.WriteString(escaped)
	b.WriteByte('"')
}

func attrValueOK(rule attrRule, v string) bool {
	switch rule {
	case aNum:
		return reNum.MatchString(v)
	case aWord:
		return reWord.MatchString(v)
	case aColor:
		return reColor.MatchString(v)
	case aDigits:
		return reDigits.MatchString(v)
	}
	return false
}

func clip(s string, n int) string {
	if len(s) > n {
		s = s[:n]
		for !strings.HasSuffix(strings.ToValidUTF8(s, ""), s) {
			s = s[:len(s)-1]
		}
	}
	return s
}

// blockedImage stands in for an image that is not shown: a quiet box of the image's own size (so the layout does
// not jump when images are loaded) carrying its alt text, instead of the browser's broken-image glyph. Tracking
// pixels (a side of 2px or less) and images with neither a size nor alt text leave nothing behind.
func (s *state) blockedImage(attrs []html.Attribute) {
	var w, h int
	var alt string
	for _, a := range attrs {
		switch strings.ToLower(a.Key) {
		case "width":
			w = pixels(a.Val)
		case "height":
			h = pixels(a.Val)
		case "alt":
			alt = strings.TrimSpace(a.Val)
		}
	}
	if (w > 0 && w <= 2) || (h > 0 && h <= 2) || (w == 0 && h == 0 && alt == "") {
		return
	}
	style := ""
	if w > 0 {
		style += fmt.Sprintf("width:%dpx;", min(w, 2000))
	}
	if h > 0 {
		style += fmt.Sprintf("height:%dpx;", min(h, 2000))
	}
	s.body.WriteString(`<span class="wm-img-blocked" data-blocked="1"`)
	if style != "" {
		s.body.WriteString(` style="` + style + `"`)
	}
	s.body.WriteByte('>')
	if len(alt) > 200 {
		alt = alt[:200]
		for len(alt) > 0 && !validUTF8Tail(alt) {
			alt = alt[:len(alt)-1]
		}
	}
	s.body.WriteString(html.EscapeString(alt))
	s.body.WriteString("</span>")
}

// pixels reads an HTML length attribute as whole pixels; percentages and junk read as 0 (unknown).
func pixels(v string) int {
	v = strings.TrimSuffix(strings.TrimSpace(v), "px")
	n := 0
	for _, r := range v {
		if r < '0' || r > '9' {
			return 0
		}
		n = n*10 + int(r-'0')
		if n > 100000 {
			return 100000
		}
	}
	return n
}

// imgAttrs adds the src of an image: cid: images become data: URIs, remote
// images are blocked unless allowed, srcset/lowsrc/dynsrc/ping are never kept.
func (s *state) imgAttrs(attrs []html.Attribute, out string) (string, bool) {
	var src string
	for _, a := range attrs {
		switch strings.ToLower(a.Key) {
		case "src":
			src = a.Val
		case "srcset":
			// a candidate list of remote URLs: treated as remote content
			if strings.TrimSpace(a.Val) != "" {
				s.countRemote()
			}
		case "lowsrc", "dynsrc":
			if strings.TrimSpace(a.Val) != "" {
				s.countRemote()
			}
		}
	}
	if src == "" {
		return out, false
	}
	u, kind := classifyURL(src)
	switch kind {
	case urlData:
		return out + fmt.Sprintf(` src="%s"`, html.EscapeString(u)), true
	case urlCID:
		if s.o.ResolveCID != nil {
			if d, ok := s.o.ResolveCID(u); ok && dataImageOK(d) {
				return out + fmt.Sprintf(` src="%s"`, html.EscapeString(d)), true
			}
		}
		return out, false
	case urlRemote:
		s.countRemote()
		if s.o.LoadRemote {
			return out + fmt.Sprintf(` src="%s" referrerpolicy="no-referrer"`, html.EscapeString(u)), true
		}
		return out + ` data-blocked="1"`, false
	}
	return out, false
}

type urlKind int

const (
	urlBad urlKind = iota
	urlRemote
	urlData
	urlCID
)

// cleanURL removes characters browsers ignore inside URLs (controls, spaces,
// tabs, newlines), which attackers use to hide a scheme ("java\tscript:").
func cleanURL(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if r <= 0x20 || r == 0x7f || (r >= 0x80 && r <= 0x9f) || r == 0x200b || r == 0xfeff {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

var reDataImage = regexp.MustCompile(`^data:image/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/=]*$`)

func dataImageOK(d string) bool { return len(d) <= 3<<20 && reDataImage.MatchString(d) }

var urlEscaper = strings.NewReplacer("(", "%28", ")", "%29", "'", "%27")

// classifyURL sorts an image/background URL into remote http(s), safe inline
// data:image, cid: (returning the content id), or bad.
func classifyURL(raw string) (string, urlKind) {
	c := cleanURL(raw)
	l := strings.ToLower(c)
	switch {
	case strings.HasPrefix(l, "cid:"):
		return strings.Trim(c[4:], "<>"), urlCID
	case strings.HasPrefix(l, "data:"):
		if dataImageOK(c) || dataImageOK("data:"+strings.ToLower(c[5:min(len(c), 15)])+c[min(len(c), 15):]) {
			return c, urlData
		}
		return "", urlBad
	case strings.HasPrefix(l, "http://") || strings.HasPrefix(l, "https://") || strings.HasPrefix(l, "//"):
		if strings.HasPrefix(l, "//") {
			c = "https:" + c
		}
		if u, err := url.Parse(c); err == nil && u.Host != "" {
			return urlEscaper.Replace(u.String()), urlRemote
		}
	}
	return "", urlBad
}

// SafeLinkURL returns a link target that is safe to put in href: http, https,
// mailto or tel only. Everything else (javascript:, data:, vbscript:, file:,
// relative and fragment-only links) is refused.
func SafeLinkURL(raw string) (string, bool) {
	c := cleanURL(raw)
	if c == "" || len(c) > 4096 {
		return "", false
	}
	u, err := url.Parse(c)
	if err != nil {
		return "", false
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
		if u.Host == "" {
			return "", false
		}
	case "mailto", "tel":
	default:
		return "", false
	}
	return u.String(), true
}

// document wraps the cleaned body in a complete page with a strict CSP.
func (s *state) document() string {
	return buildDocument(s.body.String(), s.styles, s.bodyAttrs, s.o.LoadRemote)
}

const baseCSS = `html,body{margin:0;padding:0}body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:15px;line-height:1.45;color:#1c2430;background:#fff;overflow-wrap:anywhere;word-break:break-word}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}a{color:#1a56b0}blockquote{margin:.5em 0 .5em .5em;padding-left:.75em;border-left:3px solid #c7ced9;color:#4a5668}.wm-body{padding:12px}.wm-img-blocked{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;max-width:100%;min-width:1.5em;min-height:1.5em;padding:2px 6px;vertical-align:middle;border:1px dashed #c7ced9;border-radius:4px;background:#f4f6f9;color:#6b7686;font-size:12px;line-height:1.3;overflow:hidden}`

func buildDocument(body string, styles []string, wrapAttrs string, remote bool) string {
	img := "data:"
	if remote {
		img = "data: https: http:"
	}
	var b strings.Builder
	b.WriteString(`<!doctype html><html><head><meta charset="utf-8">`)
	b.WriteString(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ` + img + `; style-src 'unsafe-inline'; font-src 'none'; base-uri 'none'; form-action 'none'">`)
	b.WriteString(`<meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1">`)
	b.WriteString("<style>" + baseCSS + "</style>")
	for _, st := range styles {
		b.WriteString("<style>" + st + "</style>")
	}
	b.WriteString(`</head><body><div class="wm-body"` + wrapAttrs + ">")
	b.WriteString(body)
	b.WriteString("</div></body></html>")
	return b.String()
}

var reURL = regexp.MustCompile(`https?://[^\s<>"']+`)

// PlainText renders a text/plain body: escaped, links detected locally,
// newlines preserved.
func PlainText(text string, o Options) Result {
	max := o.MaxInput
	if max <= 0 {
		max = defaultMaxInput
	}
	if len(text) > max {
		text = strings.ToValidUTF8(text[:max], "")
	}
	var b strings.Builder
	b.WriteString(`<div style="white-space:pre-wrap">`)
	last := 0
	for _, loc := range reURL.FindAllStringIndex(text, -1) {
		b.WriteString(html.EscapeString(text[last:loc[0]]))
		raw := strings.TrimRight(text[loc[0]:loc[1]], ".,;:!?)]}")
		end := loc[0] + len(raw)
		if u, ok := SafeLinkURL(raw); ok {
			fmt.Fprintf(&b, `<a href="%s" target="_blank" rel="noopener noreferrer" title="%s">%s</a>`,
				html.EscapeString(u), html.EscapeString(clip(u, 200)), html.EscapeString(raw))
		} else {
			b.WriteString(html.EscapeString(raw))
		}
		last = end
	}
	b.WriteString(html.EscapeString(text[last:]))
	b.WriteString("</div>")
	return Result{HTML: buildDocument(b.String(), nil, "", false), Plain: true}
}

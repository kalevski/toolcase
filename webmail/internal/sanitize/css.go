package sanitize

import (
	"regexp"
	"strings"
)

// CSSOptions are the policy for style sheets and style attributes.
type CSSOptions struct {
	LoadRemote bool
	ResolveCID func(cid string) (string, bool)
	// OnRemote is called for every remote url() found (kept or blocked).
	OnRemote func()
}

// allowedProps is the safe CSS property subset. Deliberately absent: position
// (overlay attacks), content, behavior/-moz-binding, filter, cursor (remote
// url), z-index, anything animated, anything that loads a resource except
// background(-image) which is checked separately.
var allowedProps = map[string]bool{}

func init() {
	for _, p := range strings.Fields(`color background background-color background-image background-position background-repeat background-size
		border border-top border-right border-bottom border-left border-color border-style border-width border-collapse border-spacing
		border-top-color border-right-color border-bottom-color border-left-color
		border-top-style border-right-style border-bottom-style border-left-style
		border-top-width border-right-width border-bottom-width border-left-width border-radius
		margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left
		font font-family font-size font-style font-weight font-variant line-height letter-spacing word-spacing
		text-align text-decoration text-indent text-transform text-overflow white-space word-break overflow-wrap word-wrap
		vertical-align width height min-width min-height max-width max-height display float clear
		list-style list-style-type list-style-position table-layout direction unicode-bidi opacity box-sizing visibility
		caption-side empty-cells overflow`) {
		allowedProps[p] = true
	}
}

var allowedDisplay = map[string]bool{"block": true, "inline": true, "inline-block": true, "none": true, "table": true,
	"table-row": true, "table-cell": true, "table-row-group": true, "table-header-group": true, "table-footer-group": true,
	"table-column": true, "table-column-group": true, "list-item": true}

var (
	reBadValue = regexp.MustCompile(`(?i)(expression|javascript:|vbscript:|livescript:|behavio|binding|@import|-moz-|image-set|\\|<|>|\{|\}|/\*)`)
	reURLFunc  = regexp.MustCompile(`(?i)url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)`)
	reSelector = regexp.MustCompile(`^[A-Za-z0-9_\-.#*,>+~:\[\]="'^$|() \t\r\n]+$`)
	reMedia    = regexp.MustCompile(`^[A-Za-z0-9_\-:(),. \t\r\n]+$`)
)

// badWords are the literal alternatives of reBadValue (lower case).
var badWords = []string{"expression", "javascript:", "vbscript:", "livescript:", "behavio", "binding", "@import", "-moz-", "image-set", "/*"}

// badValue reports whether a declaration value matches reBadValue. Pure-ASCII
// values (nearly all of them) take a plain substring scan, which is equivalent
// there because ASCII only case-folds to ASCII; anything else uses the regexp.
func badValue(val string) bool {
	for i := 0; i < len(val); i++ {
		if val[i] >= 0x80 {
			return reBadValue.MatchString(val)
		}
	}
	if strings.ContainsAny(val, "\\<>{}") {
		return true
	}
	lower := strings.ToLower(val)
	for _, w := range badWords {
		if strings.Contains(lower, w) {
			return true
		}
	}
	return false
}

// SanitizeCSS cleans the text of a <style> element: rules with unsafe
// selectors are dropped, at-rules other than @media are dropped (@import,
// @font-face, @keyframes, @namespace, ...), declarations are filtered.
func SanitizeCSS(css string, o CSSOptions) string {
	return sanitizeSheet(stripComments(css), o, 0)
}

func stripComments(s string) string {
	for {
		i := strings.Index(s, "/*")
		if i < 0 {
			return s
		}
		j := strings.Index(s[i+2:], "*/")
		if j < 0 {
			return s[:i]
		}
		s = s[:i] + " " + s[i+2+j+2:]
	}
}

// blockEnd returns the index of the '}' matching the '{' at s[open], honouring
// strings and nested braces; -1 if unbalanced.
func blockEnd(s string, open int) int {
	depth := 0
	var quote byte
	for i := open; i < len(s); i++ {
		c := s[i]
		switch {
		case quote != 0:
			if c == '\\' {
				i++
			} else if c == quote {
				quote = 0
			}
		case c == '"' || c == '\'':
			quote = c
		case c == '{':
			depth++
		case c == '}':
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return -1
}

func sanitizeSheet(s string, o CSSOptions, depth int) string {
	var out strings.Builder
	for {
		s = strings.TrimSpace(s)
		if s == "" {
			break
		}
		if s[0] == '@' {
			semi := strings.IndexByte(s, ';')
			brace := strings.IndexByte(s, '{')
			if brace < 0 || (semi >= 0 && semi < brace) {
				if semi < 0 {
					break
				}
				s = s[semi+1:] // statement at-rule (@import, @charset, @namespace): dropped
				continue
			}
			end := blockEnd(s, brace)
			if end < 0 {
				break
			}
			prelude := strings.TrimSpace(s[:brace])
			inner := s[brace+1 : end]
			s = s[end+1:]
			if strings.HasPrefix(strings.ToLower(prelude), "@media") && depth < 2 && reMedia.MatchString(prelude[6:]) {
				if in := sanitizeSheet(inner, o, depth+1); in != "" {
					out.WriteString(prelude + "{" + in + "}")
				}
			}
			continue
		}
		brace := strings.IndexByte(s, '{')
		if brace < 0 {
			break
		}
		end := blockEnd(s, brace)
		if end < 0 {
			break
		}
		sel := strings.TrimSpace(s[:brace])
		block := s[brace+1 : end]
		s = s[end+1:]
		if sel == "" || !reSelector.MatchString(sel) || strings.Contains(strings.ToLower(sel), "url(") {
			continue
		}
		if decls := SanitizeDeclarations(block, o); decls != "" {
			out.WriteString(sel + "{" + decls + "}")
		}
	}
	return out.String()
}

// splitDecls splits on ';' outside quotes and parentheses.
func splitDecls(s string) []string {
	var parts []string
	depth := 0
	var quote byte
	start := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case quote != 0:
			if c == '\\' {
				i++
			} else if c == quote {
				quote = 0
			}
		case c == '"' || c == '\'':
			quote = c
		case c == '(':
			depth++
		case c == ')':
			if depth > 0 {
				depth--
			}
		case c == ';' && depth == 0:
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	return append(parts, s[start:])
}

// SanitizeDeclarations cleans a declaration list (a style attribute or the
// inside of a rule block) and returns it as "prop:value;prop:value".
func SanitizeDeclarations(decls string, o CSSOptions) string {
	var out []string
	for _, d := range splitDecls(stripComments(decls)) {
		prop, val, ok := strings.Cut(d, ":")
		if !ok {
			continue
		}
		prop = strings.ToLower(strings.TrimSpace(prop))
		val = strings.TrimSpace(val)
		if !allowedProps[prop] || val == "" || len(val) > 1000 {
			continue
		}
		important := ""
		if i := strings.LastIndex(strings.ToLower(val), "!important"); i >= 0 && strings.TrimSpace(val[i+10:]) == "" {
			important = " !important"
			val = strings.TrimSpace(val[:i])
		}
		if val == "" {
			continue
		}
		val, ok = cleanValue(prop, val, o)
		if !ok {
			continue
		}
		out = append(out, prop+":"+val+important)
	}
	return strings.Join(out, ";")
}

func urlSafeInCSS(u string) bool {
	return !strings.ContainsAny(u, "();, \t\r\n\f\"'\\")
}

func cleanValue(prop, val string, o CSSOptions) (string, bool) {
	if badValue(val) {
		return "", false
	}
	if prop == "display" {
		return val, allowedDisplay[strings.ToLower(val)]
	}
	if strings.Contains(strings.ToLower(val), "url(") {
		if prop != "background" && prop != "background-image" {
			return "", false
		}
		if len(reURLFunc.FindAllString(val, -1)) != strings.Count(strings.ToLower(val), "url(") {
			return "", false // an unterminated or odd url(
		}
		ok := true
		res := reURLFunc.ReplaceAllStringFunc(val, func(m string) string {
			g := reURLFunc.FindStringSubmatch(m)
			raw := g[1] + g[2] + g[3]
			u, kind := classifyURL(raw)
			switch kind {
			case urlData:
				return "url(" + u + ")"
			case urlCID:
				if o.ResolveCID != nil {
					if d, found := o.ResolveCID(u); found && dataImageOK(d) {
						return "url(" + d + ")"
					}
				}
			case urlRemote:
				if o.OnRemote != nil {
					o.OnRemote()
				}
				if o.LoadRemote && urlSafeInCSS(u) {
					return "url(" + u + ")"
				}
			}
			ok = false
			return ""
		})
		if !ok || strings.Count(strings.ToLower(res), "url(") != strings.Count(strings.ToLower(val), "url(") {
			return "", false
		}
		// a url() with quotes or parens inside the data/remote part cannot
		// escape: classifyURL accepted only strict shapes, and u comes from
		// url.Parse().String() (percent-encoded).
		if strings.ContainsAny(strings.ReplaceAll(strings.ReplaceAll(res, "url(", ""), ")", ""), "\"'\n\r") {
			return "", false
		}
		return res, true
	}
	return val, true
}

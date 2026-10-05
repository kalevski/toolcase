package platform

import (
	"net/url"
	"regexp"
	"strings"
	"unicode"
)

// PublicBranding is what the browser receives (spec §3.4): validated data,
// never raw CSS or HTML. Known is false for domains that are not active mail
// domains; the page then wears the neutral platform skin.
type PublicBranding struct {
	Known           bool         `json:"known"`
	Domain          string       `json:"domain"`
	Name            string       `json:"name"`
	LogoURL         string       `json:"logoUrl"`
	Theme           string       `json:"theme"`
	Accent          string       `json:"accent"`
	LoginTitle      string       `json:"loginTitle"`
	LoginMessage    string       `json:"loginMessage"`
	SupportEmail    string       `json:"supportEmail"`
	SupportURL      string       `json:"supportUrl"`
	FooterLinks     []FooterLink `json:"footerLinks"`
	DefaultLanguage string       `json:"defaultLanguage"`
	AllowUserAccent bool         `json:"allowUserAccent"`
}

var (
	reTheme  = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)
	reAccent = regexp.MustCompile(`^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)
	reLang   = regexp.MustCompile(`^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$`)
	reEmail  = regexp.MustCompile(`^[^@\s<>"]{1,64}@[A-Za-z0-9.-]{1,253}$`)
)

// Neutral is the platform skin for unknown domains.
func Neutral(domain string) *PublicBranding {
	return &PublicBranding{Domain: domain, Name: "Webmail", FooterLinks: []FooterLink{}}
}

// Public validates a platform Branding into its browser form. Fields that fail
// validation are dropped, not repaired.
func Public(domain string, b *Branding) *PublicBranding {
	if b == nil {
		return Neutral(domain)
	}
	p := &PublicBranding{
		Known: true, Domain: domain, FooterLinks: []FooterLink{},
		Name:            text(b.Name, 80),
		LoginTitle:      text(b.LoginTitle, 120),
		LoginMessage:    text(b.LoginMessage, 280),
		AllowUserAccent: b.AllowUserAccent,
	}
	if p.Name == "" {
		p.Name = domain
	}
	if reTheme.MatchString(b.Theme) {
		p.Theme = b.Theme
	}
	if reAccent.MatchString(b.Accent) {
		p.Accent = strings.ToLower(b.Accent)
	}
	if reLang.MatchString(b.DefaultLanguage) {
		p.DefaultLanguage = b.DefaultLanguage
	}
	if strings.HasPrefix(b.LogoURL, "/api/logo?domain=") {
		p.LogoURL = b.LogoURL // our own proxy path, set by Client.Branding
	} else {
		p.LogoURL = httpURL(b.LogoURL)
	}
	p.SupportURL = httpURL(b.SupportURL)
	if reEmail.MatchString(b.SupportEmail) {
		p.SupportEmail = b.SupportEmail
	}
	for _, l := range b.FooterLinks {
		if len(p.FooterLinks) >= 8 {
			break
		}
		if u, label := httpURL(l.URL), text(l.Label, 60); u != "" && label != "" {
			p.FooterLinks = append(p.FooterLinks, FooterLink{Label: label, URL: u})
		}
	}
	return p
}

// text strips control characters and angle brackets' meaning is left to the
// SPA, which renders it as text; length is capped in runes.
func text(s string, max int) string {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' {
			return -1
		}
		return r
	}, strings.TrimSpace(s))
	if r := []rune(s); len(r) > max {
		s = string(r[:max])
	}
	return s
}

func httpURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > 2048 {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil {
		return ""
	}
	return u.String()
}

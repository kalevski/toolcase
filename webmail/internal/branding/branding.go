// Package branding validates the brandings the platform pushes and shapes them
// for the two readers: the platform (admin form) and the browser (public form,
// data only, never raw CSS or HTML).
package branding

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/kalevski/toolcase/webmail/internal/store"
)

var (
	domainRe = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$`)
	reTheme  = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,31}$`)
	reAccent = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	reLang   = regexp.MustCompile(`^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$`)
	reEmail  = regexp.MustCompile(`^[^@\s<>"]{1,64}@[A-Za-z0-9.-]{1,253}$`)
)

const (
	maxName    = 80
	maxText    = 280
	maxLabel   = 40
	maxLinks   = 6
	maxMailbox = 1 << 31
)

// ValidDomain reports whether s is a plausible lower-case DNS name (it is
// placed in URLs and used as a key, so anything else is refused).
func ValidDomain(s string) bool { return len(s) <= 253 && domainRe.MatchString(s) }

// NormalizeDomain lower-cases a domain and drops a trailing dot.
func NormalizeDomain(s string) string {
	return strings.ToLower(strings.TrimSuffix(strings.TrimSpace(s), "."))
}

// FooterLink is one footer or help-menu link.
type FooterLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// Input is what the platform sends; Admin is what it reads back.
type Input struct {
	Domain          string       `json:"domain"`
	DisplayName     string       `json:"displayName"`
	Theme           string       `json:"theme"`
	Accent          string       `json:"accent"`
	LoginTitle      string       `json:"loginTitle"`
	LoginMessage    string       `json:"loginMessage"`
	SupportEmail    string       `json:"supportEmail"`
	SupportURL      string       `json:"supportUrl"`
	FooterLinks     []FooterLink `json:"footerLinks"`
	DefaultLocale   string       `json:"defaultLocale"`
	AllowUserAccent bool         `json:"allowUserAccent"`
	MailboxCount    int          `json:"mailboxCount"`
	JMAPURL         string       `json:"jmapUrl"`
}

// Admin is the contract's Branding object.
type Admin struct {
	Input
	HasLogo   bool   `json:"hasLogo"`
	UpdatedAt string `json:"updatedAt"`
}

// FieldError names the field that failed validation.
type FieldError struct {
	Field string
	Msg   string
}

func (e *FieldError) Error() string { return fmt.Sprintf("%s: %s", e.Field, e.Msg) }

// Validate checks every field and returns the row to store. Nothing is
// repaired silently except surrounding whitespace and control characters.
func Validate(in Input, domain string) (*store.Branding, error) {
	b := &store.Branding{Domain: domain, FooterLinks: []store.FooterLink{}, AllowUserAccent: in.AllowUserAccent}
	var err error
	if !ValidDomain(domain) {
		return nil, &FieldError{"domain", "is not a valid domain name"}
	}
	if b.DisplayName, err = clean("displayName", in.DisplayName, maxName); err != nil {
		return nil, err
	}
	if in.Theme != "" && !reTheme.MatchString(in.Theme) {
		return nil, &FieldError{"theme", "is not a theme name"}
	}
	b.Theme = in.Theme
	if in.Accent != "" && !reAccent.MatchString(in.Accent) {
		return nil, &FieldError{"accent", "must be #rrggbb"}
	}
	b.Accent = strings.ToLower(in.Accent)
	if b.LoginTitle, err = clean("loginTitle", in.LoginTitle, maxText); err != nil {
		return nil, err
	}
	if b.LoginMessage, err = clean("loginMessage", in.LoginMessage, maxText); err != nil {
		return nil, err
	}
	if in.SupportEmail != "" && !reEmail.MatchString(in.SupportEmail) {
		return nil, &FieldError{"supportEmail", "is not an email address"}
	}
	b.SupportEmail = in.SupportEmail
	if in.SupportURL != "" {
		if b.SupportURL = httpURL(in.SupportURL); b.SupportURL == "" {
			return nil, &FieldError{"supportUrl", "must be an http(s) address"}
		}
	}
	if len(in.FooterLinks) > maxLinks {
		return nil, &FieldError{"footerLinks", fmt.Sprintf("at most %d links", maxLinks)}
	}
	for _, l := range in.FooterLinks {
		label, err := clean("footerLinks", l.Label, maxLabel)
		if err != nil {
			return nil, err
		}
		u := httpURL(l.URL)
		if label == "" || u == "" {
			return nil, &FieldError{"footerLinks", "every link needs a label and an http(s) address"}
		}
		b.FooterLinks = append(b.FooterLinks, store.FooterLink{Label: label, URL: u})
	}
	if in.DefaultLocale != "" && !reLang.MatchString(in.DefaultLocale) {
		return nil, &FieldError{"defaultLocale", "must be a language code such as en or pt-BR"}
	}
	b.DefaultLocale = in.DefaultLocale
	if in.MailboxCount < 0 || in.MailboxCount > maxMailbox {
		return nil, &FieldError{"mailboxCount", "must not be negative"}
	}
	b.MailboxCount = in.MailboxCount
	if in.JMAPURL != "" {
		if b.JMAPURL = baseURL(in.JMAPURL); b.JMAPURL == "" {
			return nil, &FieldError{"jmapUrl", "must be an http(s) address of the mail server"}
		}
	}
	return b, nil
}

// ToAdmin is the platform's view of a stored branding.
func ToAdmin(b *store.Branding) Admin {
	links := make([]FooterLink, 0, len(b.FooterLinks))
	for _, l := range b.FooterLinks {
		links = append(links, FooterLink{Label: l.Label, URL: l.URL})
	}
	return Admin{
		Input: Input{
			Domain: b.Domain, DisplayName: b.DisplayName, Theme: b.Theme, Accent: b.Accent, LoginTitle: b.LoginTitle,
			LoginMessage: b.LoginMessage, SupportEmail: b.SupportEmail, SupportURL: b.SupportURL, FooterLinks: links,
			DefaultLocale: b.DefaultLocale, AllowUserAccent: b.AllowUserAccent, MailboxCount: b.MailboxCount, JMAPURL: b.JMAPURL,
		},
		HasLogo:   b.HasLogo,
		UpdatedAt: b.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

// PublicBranding is what the browser receives (spec §3.4): validated data,
// never raw CSS or HTML. Known is false for domains the platform has not
// registered; the page then wears the neutral skin.
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

// Neutral is the skin for unknown domains.
func Neutral(domain string) *PublicBranding {
	return &PublicBranding{Domain: domain, Name: "Webmail", FooterLinks: []FooterLink{}}
}

// Public is the browser form of a stored branding; nil gives the neutral skin.
func Public(domain string, b *store.Branding) *PublicBranding {
	if b == nil {
		return Neutral(domain)
	}
	p := &PublicBranding{
		Known: true, Domain: domain, FooterLinks: []FooterLink{}, Name: b.DisplayName, Theme: b.Theme, Accent: b.Accent,
		LoginTitle: b.LoginTitle, LoginMessage: b.LoginMessage, SupportEmail: b.SupportEmail, SupportURL: b.SupportURL,
		DefaultLanguage: b.DefaultLocale, AllowUserAccent: b.AllowUserAccent,
	}
	if p.Name == "" {
		p.Name = domain
	}
	if b.HasLogo {
		p.LogoURL = "/api/logo?domain=" + url.QueryEscape(domain)
	}
	for _, l := range b.FooterLinks {
		p.FooterLinks = append(p.FooterLinks, FooterLink{Label: l.Label, URL: l.URL})
	}
	return p
}

// clean strips control characters and surrounding space, and refuses text
// longer than max runes.
func clean(field, s string, max int) (string, error) {
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' {
			return -1
		}
		return r
	}, strings.TrimSpace(s))
	if len([]rune(s)) > max {
		return "", &FieldError{field, fmt.Sprintf("at most %d characters", max)}
	}
	return s, nil
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

// baseURL is a mail server's JMAP base: an http(s) address with a host, no credentials, query or fragment, no trailing slash.
func baseURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > 300 {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return ""
	}
	return strings.TrimRight(u.String(), "/")
}

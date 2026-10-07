package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// ErrExists is returned when a row that must be new already exists.
var ErrExists = errors.New("store: already exists")

// FooterLink is one footer or help-menu link of a branding.
type FooterLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// Branding is one row of the brandings table: what the platform pushed for a
// mail domain.
type Branding struct {
	Domain          string
	DisplayName     string
	Theme           string
	Accent          string
	LoginTitle      string
	LoginMessage    string
	SupportEmail    string
	SupportURL      string
	FooterLinks     []FooterLink
	DefaultLocale   string
	AllowUserAccent bool
	MailboxCount    int
	JMAPURL         string
	WebmailHost     string
	SignInScope     string // "any" or "domain"
	BrandPrimary    string
	BrandSecondary  string
	BrandBadge      string
	UpdatedAt       time.Time
}

const brandingCols = `domain, display_name, theme, accent, login_title, login_message, support_email, support_url,
	footer_links, default_locale, allow_user_accent, mailbox_count, jmap_url, webmail_host, sign_in_scope, brand_primary, brand_secondary, brand_badge, updated_at`

func scanBranding(sc interface{ Scan(...any) error }) (*Branding, error) {
	var b Branding
	var links string
	var allow int
	var updated int64
	if err := sc.Scan(&b.Domain, &b.DisplayName, &b.Theme, &b.Accent, &b.LoginTitle, &b.LoginMessage, &b.SupportEmail,
		&b.SupportURL, &links, &b.DefaultLocale, &allow, &b.MailboxCount, &b.JMAPURL, &b.WebmailHost, &b.SignInScope, &b.BrandPrimary, &b.BrandSecondary, &b.BrandBadge, &updated); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	b.FooterLinks = []FooterLink{}
	_ = json.Unmarshal([]byte(links), &b.FooterLinks)
	if b.FooterLinks == nil {
		b.FooterLinks = []FooterLink{}
	}
	b.AllowUserAccent = allow != 0
	b.UpdatedAt = time.Unix(updated, 0)
	return &b, nil
}

func linksJSON(links []FooterLink) string {
	if links == nil {
		links = []FooterLink{}
	}
	j, _ := json.Marshal(links)
	return string(j)
}

// InsertBranding adds a domain; ErrExists when it is already there.
func (s *Store) InsertBranding(ctx context.Context, b *Branding) error {
	_, err := s.w.ExecContext(ctx, `INSERT INTO brandings (domain, display_name, theme, accent, login_title, login_message,
		support_email, support_url, footer_links, default_locale, allow_user_accent, mailbox_count, jmap_url, webmail_host, sign_in_scope, brand_primary, brand_secondary, brand_badge, updated_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		b.Domain, b.DisplayName, b.Theme, b.Accent, b.LoginTitle, b.LoginMessage, b.SupportEmail, b.SupportURL,
		linksJSON(b.FooterLinks), b.DefaultLocale, b2i(b.AllowUserAccent), b.MailboxCount, b.JMAPURL, b.WebmailHost, scopeOf(b.SignInScope), b.BrandPrimary, b.BrandSecondary, b.BrandBadge, s.now().Unix())
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return ErrExists
	}
	return err
}

// UpdateBranding replaces every editable field of a domain;
// ErrNotFound when the domain is not there.
func (s *Store) UpdateBranding(ctx context.Context, b *Branding) error {
	res, err := s.w.ExecContext(ctx, `UPDATE brandings SET display_name = ?, theme = ?, accent = ?, login_title = ?,
		login_message = ?, support_email = ?, support_url = ?, footer_links = ?, default_locale = ?,
		allow_user_accent = ?, mailbox_count = ?, jmap_url = ?, webmail_host = ?, sign_in_scope = ?, brand_primary = ?, brand_secondary = ?, brand_badge = ?,
		updated_at = ? WHERE domain = ?`,
		b.DisplayName, b.Theme, b.Accent, b.LoginTitle, b.LoginMessage, b.SupportEmail, b.SupportURL,
		linksJSON(b.FooterLinks), b.DefaultLocale, b2i(b.AllowUserAccent), b.MailboxCount, b.JMAPURL, b.WebmailHost, scopeOf(b.SignInScope), b.BrandPrimary, b.BrandSecondary, b.BrandBadge,
		s.now().Unix(), b.Domain)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// GetBranding loads one domain.
func (s *Store) GetBranding(ctx context.Context, domain string) (*Branding, error) {
	return scanBranding(s.r.QueryRowContext(ctx, `SELECT `+brandingCols+` FROM brandings WHERE domain = ?`, domain))
}

// BrandingForHost finds the domain whose webmail is served on host: the one the platform named with that host,
// else a domain without a named host whose own name is the host (webmail served on the mail domain itself).
func (s *Store) BrandingForHost(ctx context.Context, host string) (*Branding, error) {
	return scanBranding(s.r.QueryRowContext(ctx, `SELECT `+brandingCols+` FROM brandings
		WHERE webmail_host = ? OR (webmail_host = '' AND domain = ?) ORDER BY webmail_host = '' LIMIT 1`, host, host))
}

// DeleteBranding removes a domain. It is not an error when the
// domain is already gone.
func (s *Store) DeleteBranding(ctx context.Context, domain string) error {
	_, err := s.w.ExecContext(ctx, `DELETE FROM brandings WHERE domain = ?`, domain)
	return err
}

// ListBrandings returns up to limit domains after the given one, ordered by
// domain, whose name contains q; total counts every domain that matches q.
func (s *Store) ListBrandings(ctx context.Context, q, after string, limit int) ([]*Branding, int, error) {
	var total int
	if err := s.r.QueryRowContext(ctx, `SELECT COUNT(*) FROM brandings WHERE ? = '' OR instr(domain, ?) > 0`, q, q).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.r.QueryContext(ctx, `SELECT `+brandingCols+` FROM brandings
		WHERE domain > ? AND (? = '' OR instr(domain, ?) > 0) ORDER BY domain LIMIT ?`, after, q, q, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []*Branding
	for rows.Next() {
		b, err := scanBranding(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, b)
	}
	return out, total, rows.Err()
}

// CountBrandings is the number of registered domains.
func (s *Store) CountBrandings(ctx context.Context) (int, error) {
	var n int
	err := s.r.QueryRowContext(ctx, `SELECT COUNT(*) FROM brandings`).Scan(&n)
	return n, err
}

// scopeOf stores an unset scope as "any", the behaviour before the setting existed.
func scopeOf(scope string) string {
	if scope == "" {
		return "any"
	}
	return scope
}

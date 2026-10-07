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
// mail domain. The logo bytes are not part of it (see Logo).
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
	HasLogo         bool
	UpdatedAt       time.Time
}

const brandingCols = `domain, display_name, theme, accent, login_title, login_message, support_email, support_url,
	footer_links, default_locale, allow_user_accent, mailbox_count, jmap_url, logo IS NOT NULL, updated_at`

func scanBranding(sc interface{ Scan(...any) error }) (*Branding, error) {
	var b Branding
	var links string
	var allow, logo int
	var updated int64
	if err := sc.Scan(&b.Domain, &b.DisplayName, &b.Theme, &b.Accent, &b.LoginTitle, &b.LoginMessage, &b.SupportEmail,
		&b.SupportURL, &links, &b.DefaultLocale, &allow, &b.MailboxCount, &b.JMAPURL, &logo, &updated); err != nil {
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
	b.AllowUserAccent, b.HasLogo = allow != 0, logo != 0
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
		support_email, support_url, footer_links, default_locale, allow_user_accent, mailbox_count, jmap_url, updated_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		b.Domain, b.DisplayName, b.Theme, b.Accent, b.LoginTitle, b.LoginMessage, b.SupportEmail, b.SupportURL,
		linksJSON(b.FooterLinks), b.DefaultLocale, b2i(b.AllowUserAccent), b.MailboxCount, b.JMAPURL, s.now().Unix())
	if err != nil && strings.Contains(err.Error(), "UNIQUE") {
		return ErrExists
	}
	return err
}

// UpdateBranding replaces every editable field of a domain (the logo is kept);
// ErrNotFound when the domain is not there.
func (s *Store) UpdateBranding(ctx context.Context, b *Branding) error {
	res, err := s.w.ExecContext(ctx, `UPDATE brandings SET display_name = ?, theme = ?, accent = ?, login_title = ?,
		login_message = ?, support_email = ?, support_url = ?, footer_links = ?, default_locale = ?,
		allow_user_accent = ?, mailbox_count = ?, jmap_url = ?, updated_at = ? WHERE domain = ?`,
		b.DisplayName, b.Theme, b.Accent, b.LoginTitle, b.LoginMessage, b.SupportEmail, b.SupportURL,
		linksJSON(b.FooterLinks), b.DefaultLocale, b2i(b.AllowUserAccent), b.MailboxCount, b.JMAPURL, s.now().Unix(), b.Domain)
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

// DeleteBranding removes a domain and its logo. It is not an error when the
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

// SetLogo stores a domain's logo; ErrNotFound when the domain is not there.
func (s *Store) SetLogo(ctx context.Context, domain, mime string, data []byte) error {
	res, err := s.w.ExecContext(ctx, `UPDATE brandings SET logo = ?, logo_mime = ?, updated_at = ? WHERE domain = ?`,
		data, mime, s.now().Unix(), domain)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ClearLogo removes a domain's logo (idempotent).
func (s *Store) ClearLogo(ctx context.Context, domain string) error {
	_, err := s.w.ExecContext(ctx, `UPDATE brandings SET logo = NULL, logo_mime = '', updated_at = ? WHERE domain = ? AND logo IS NOT NULL`,
		s.now().Unix(), domain)
	return err
}

// Logo returns a domain's logo bytes and content type; ErrNotFound when it has none.
func (s *Store) Logo(ctx context.Context, domain string) ([]byte, string, error) {
	var data []byte
	var mime string
	err := s.r.QueryRowContext(ctx, `SELECT logo, logo_mime FROM brandings WHERE domain = ? AND logo IS NOT NULL`, domain).Scan(&data, &mime)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", ErrNotFound
	}
	return data, mime, err
}

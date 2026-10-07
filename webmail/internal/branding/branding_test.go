package branding

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/store"
)

func TestValidateAcceptsAndNormalises(t *testing.T) {
	b, err := Validate(Input{
		DisplayName: "  Ex\x00ample  ", Theme: "ocean", Accent: "#ABCDEF", LoginTitle: "Hi", LoginMessage: strings.Repeat("x", 280),
		SupportEmail: "help@example.test", SupportURL: "https://example.test/help",
		FooterLinks:   []FooterLink{{"Privacy", "https://example.test/p"}},
		DefaultLocale: "pt-BR", AllowUserAccent: true, MailboxCount: 3,
	}, "example.test")
	if err != nil {
		t.Fatal(err)
	}
	if b.DisplayName != "Example" || b.Accent != "#abcdef" || len(b.FooterLinks) != 1 || !b.AllowUserAccent || b.MailboxCount != 3 {
		t.Fatalf("%+v", b)
	}
	if _, err := Validate(Input{}, "example.test"); err != nil {
		t.Fatalf("an empty branding is valid: %v", err)
	}
}

func TestValidateRejectsInsteadOfDropping(t *testing.T) {
	cases := map[string]Input{
		"displayName":   {DisplayName: strings.Repeat("x", 81)},
		"theme":         {Theme: "x;}</style><script>"},
		"accent":        {Accent: "red;background:url(x)"},
		"loginTitle":    {LoginTitle: strings.Repeat("x", 281)},
		"loginMessage":  {LoginMessage: strings.Repeat("x", 281)},
		"supportEmail":  {SupportEmail: "not an email"},
		"supportUrl":    {SupportURL: "javascript:alert(1)"},
		"footerLinks":   {FooterLinks: []FooterLink{{"Evil", "javascript:alert(1)"}}},
		"defaultLocale": {DefaultLocale: "en\"><"},
		"mailboxCount":  {MailboxCount: -1},
	}
	for field, in := range cases {
		_, err := Validate(in, "example.test")
		var fe *FieldError
		if !errors.As(err, &fe) || fe.Field != field {
			t.Errorf("%s: %v", field, err)
		}
	}
	seven := make([]FooterLink, 7)
	for i := range seven {
		seven[i] = FooterLink{"a", "https://example.test"}
	}
	if _, err := Validate(Input{FooterLinks: seven}, "example.test"); err == nil {
		t.Error("seven footer links accepted")
	}
	if _, err := Validate(Input{FooterLinks: []FooterLink{{"", "https://example.test"}}}, "example.test"); err == nil {
		t.Error("a link without a label accepted")
	}
	for _, d := range []string{"", "Example.test", "../etc/passwd", "a b.test", "-x.test"} {
		if _, err := Validate(Input{}, d); err == nil {
			t.Errorf("domain %q accepted", d)
		}
	}
}

func TestPublic(t *testing.T) {
	p := Public("example.test", &store.Branding{
		DisplayName: "Example", HasLogo: true, Theme: "ocean", Accent: "#336699", DefaultLocale: "de",
		FooterLinks: []store.FooterLink{{Label: "Privacy", URL: "https://example.test/p"}}, UpdatedAt: time.Now(),
	})
	if !p.Known || p.Name != "Example" || p.LogoURL != "/api/logo?domain=example.test" || p.DefaultLanguage != "de" || len(p.FooterLinks) != 1 {
		t.Fatalf("%+v", p)
	}
	if p := Public("a.test", &store.Branding{}); p.Name != "a.test" || p.LogoURL != "" || p.FooterLinks == nil {
		t.Fatalf("%+v", p)
	}
	n := Public("unknown.test", nil)
	if n.Known || n.Name != "Webmail" || n.FooterLinks == nil {
		t.Fatalf("%+v", n)
	}
}

func TestToAdmin(t *testing.T) {
	a := ToAdmin(&store.Branding{Domain: "example.test", MailboxCount: 4, HasLogo: true, UpdatedAt: time.Unix(0, 0)})
	if a.Domain != "example.test" || a.MailboxCount != 4 || !a.HasLogo || a.UpdatedAt != "1970-01-01T00:00:00Z" || a.FooterLinks == nil {
		t.Fatalf("%+v", a)
	}
}

func TestJMAPURLIsAnHTTPBaseWithoutCredentials(t *testing.T) {
	ok, err := Validate(Input{Domain: "a.test", JMAPURL: " http://10.0.0.8:8080/ "}, "a.test")
	if err != nil || ok.JMAPURL != "http://10.0.0.8:8080" {
		t.Fatalf("a plain base is kept without its trailing slash: %v %q", err, ok.JMAPURL)
	}
	for _, bad := range []string{"ftp://x.test", "http://user:pw@x.test", "http://x.test/?a=b", "x.test", "http://x.test/#f"} {
		if _, err := Validate(Input{Domain: "a.test", JMAPURL: bad}, "a.test"); err == nil {
			t.Fatalf("%q must be refused", bad)
		}
	}
	empty, err := Validate(Input{Domain: "a.test"}, "a.test")
	if err != nil || empty.JMAPURL != "" {
		t.Fatalf("no address means the default server: %v %q", err, empty.JMAPURL)
	}
}

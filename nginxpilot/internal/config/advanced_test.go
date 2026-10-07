package config

import (
	"strings"
	"testing"
)

func TestValidateAdvancedAccepts(t *testing.T) {
	ok := []string{
		"",
		"add_header X-Frame-Options SAMEORIGIN;",
		"add_header X-Foo \"bar baz\" always;",
		"expires 30d;\nexpires modified +1h;",
		"rewrite ^/old/(.*)$ /new/$1 permanent;",
		"rewrite ^/a$ https://example.com/b redirect;",
		"return 301 /moved;",
		"return 404;",
		"return 503 \"down for maintenance\";",
		"error_page 404 /404.html;",
		"error_page 500 502 =200 /oops.html;",
		"client_max_body_size 100m;",
		"gzip on;\ngzip_types text/plain application/json;\ngzip_min_length 256;",
		"charset utf-8;",
		"etag off;",
		"access_log off;",
	}
	for _, in := range ok {
		if err := ValidateAdvanced(in, AdvancedSite); err != nil {
			t.Errorf("ValidateAdvanced(%q): unexpected error: %v", in, err)
		}
	}
	if err := ValidateAdvanced("proxy_read_timeout 300s;", AdvancedProxy); err != nil {
		t.Errorf("proxy scope must allow proxy_read_timeout: %v", err)
	}
}

func TestValidateAdvancedRejects(t *testing.T) {
	bad := map[string]string{
		"close block":          "add_header X y; } server { listen 80; }",
		"open block":           "location /x { return 404; }",
		"alias":                "alias /etc/letsencrypt/;",
		"include":              "include /etc/nginx/secret.conf;",
		"include uppercase":    "Include /etc/passwd;",
		"quoted directive":     "\"include\" /etc/passwd;",
		"root":                 "root /;",
		"load_module":          "load_module modules/x.so;",
		"proxy_pass":           "proxy_pass http://unix:/run/nginxpilot/admin.sock:/;",
		"fastcgi_pass":         "fastcgi_pass 127.0.0.1:9000;",
		"proxy timeout (site)": "proxy_read_timeout 300s;",
		"ssl":                  "ssl_certificate /x;",
		"set":                  "set $a b;",
		"if":                   "if ($a) { return 403; }",
		"try_files":            "try_files $uri /etc/passwd;",
		"allow":                "allow all;",
		"lua":                  "content_by_lua_block { ngx.say('x') }",
		"missing semicolon":    "add_header X y",
		"comment":              "add_header X y; # }",
		"backslash":            "add_header X y" + "\\" + ";",
		"brace in quotes":      "add_header X \"{\";",
		"unterminated quote":   "add_header X \"y;",
		"mid-token quote":      "add_header X a\"b\";",
		"text after quote":     "add_header X \"a\"b;",
		"dotdot":               "rewrite ^/a /../etc/passwd last;",
		"fs path":              "return 301 /etc/passwd;",
		"fs path root":         "error_page 404 /var/lib/x;",
		"bad rewrite flag":     "rewrite ^/a /b sneaky;",
		"return 200":           "return 200 \"ok\";",
		"return http":          "return 301 http://example.com;",
		"body unlimited":       "client_max_body_size 0;",
		"body too big":         "client_max_body_size 2g;",
		"access_log file":      "access_log /var/log/x.log;",
		"add_header arity":     "add_header X;",
		"expires junk":         "expires banana;",
		"control char":         "add_header X y\x00;",
		"empty statement":      ";",
	}
	for name, in := range bad {
		if err := ValidateAdvanced(in, AdvancedSite); err == nil {
			t.Errorf("%s: ValidateAdvanced(%q) accepted", name, in)
		}
	}
	if err := ValidateAdvanced("proxy_read_timeout 99h;", AdvancedProxy); err == nil {
		t.Error("proxy_read_timeout over 1h must be refused")
	}
	if err := ValidateAdvanced(strings.Repeat("etag on;", 5000), AdvancedSite); err == nil {
		t.Error("oversized snippet must be refused")
	}
}

func TestValidateRejectsAdvancedOnEveryPath(t *testing.T) {
	site := Site{Domain: "a.example.com", Source: Source{Type: SourceHTTPZip, URL: "https://x.example.com/a.zip"},
		WebOptions: WebOptions{Advanced: "include /etc/passwd;"}}
	if err := Validate(&Config{LogLevel: "info", Defaults: Defaults{KeepReleases: 3}, Sites: []Site{site}}); err == nil {
		t.Error("site advanced must be validated")
	}
	p := Proxy{Domain: "p.example.com", Pass: "http://backend:80", Locations: []ProxyLocation{{Path: "/", Advanced: "alias /;"}}}
	if err := Validate(&Config{LogLevel: "info", Defaults: Defaults{KeepReleases: 3}, Proxies: []Proxy{p}}); err == nil {
		t.Error("location advanced must be validated")
	}
}

func TestValidateLocationPath(t *testing.T) {
	good := []string{"/", "/api/", "/a-b_c.d/~x", "/v1/users:search", "/a%20b"}
	bad := []string{"/ { } server { listen 1; } location /y", "/a b", "/a;b", "/a{b", "/a\"b", "/a'b", "/a\\b", "/../etc", "~ ^/x", "/a\nb"}
	for _, path := range good {
		p := Proxy{Domain: "p.example.com", Locations: []ProxyLocation{{Path: path, Pass: "http://backend:80"}}}
		if err := Validate(&Config{LogLevel: "info", Defaults: Defaults{KeepReleases: 3}, Proxies: []Proxy{p}}); err != nil {
			t.Errorf("path %q: unexpected error %v", path, err)
		}
	}
	for _, path := range bad {
		p := Proxy{Domain: "p.example.com", Locations: []ProxyLocation{{Path: path, Pass: "http://backend:80"}}}
		if err := Validate(&Config{LogLevel: "info", Defaults: Defaults{KeepReleases: 3}, Proxies: []Proxy{p}}); err == nil {
			t.Errorf("path %q accepted", path)
		}
	}
}

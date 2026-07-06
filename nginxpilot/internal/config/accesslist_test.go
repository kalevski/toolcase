package config

import "testing"

func validList() AccessList {
	return AccessList{
		Name:    "office",
		Satisfy: "any",
		Users:   []AccessListUser{{Username: "alice", PasswordHash: "$apr1$abcdefgh$EfExgQSMBXioDhIVk8IOb1"}},
		Rules:   []AccessRule{{Allow: "10.0.0.0/8"}, {Deny: "203.0.113.7"}},
	}
}

func TestValidateAccessListOK(t *testing.T) {
	cfg := baseCfg()
	cfg.AccessLists = []AccessList{validList()}
	cfg.Proxies = []Proxy{{Domain: "a.example.com", Pass: "http://127.0.0.1:1", AccessList: "office"}}
	if err := Validate(cfg); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestValidateAccessListNameRules(t *testing.T) {
	cfg := baseCfg()
	cfg.AccessLists = []AccessList{{Name: ""}}
	mustFail(t, cfg, "name is required")

	cfg.AccessLists = []AccessList{{Name: "has-dash"}}
	mustFail(t, cfg, "name must match")

	cfg.AccessLists = []AccessList{{Name: "office"}, {Name: "office"}}
	mustFail(t, cfg, "duplicate access_list")
}

func TestValidateAccessListSatisfyEnum(t *testing.T) {
	cfg := baseCfg()
	cfg.AccessLists = []AccessList{{Name: "office", Satisfy: "some"}}
	mustFail(t, cfg, "satisfy")
}

func TestValidateAccessListUsers(t *testing.T) {
	cfg := baseCfg()
	cfg.AccessLists = []AccessList{{Name: "l", Users: []AccessListUser{{Username: ""}}}}
	mustFail(t, cfg, "username is required")

	cfg.AccessLists = []AccessList{{Name: "l", Users: []AccessListUser{{Username: "a:b"}}}}
	mustFail(t, cfg, "without ':'")

	cfg.AccessLists = []AccessList{{Name: "l", Users: []AccessListUser{{Username: "a"}, {Username: "a"}}}}
	mustFail(t, cfg, "duplicate user")
}

func TestValidateAccessListRules(t *testing.T) {
	cfg := baseCfg()
	cfg.AccessLists = []AccessList{{Name: "l", Rules: []AccessRule{{}}}}
	mustFail(t, cfg, "exactly one of allow | deny")

	cfg.AccessLists = []AccessList{{Name: "l", Rules: []AccessRule{{Allow: "10.0.0.0/8", Deny: "1.2.3.4"}}}}
	mustFail(t, cfg, "exactly one of allow | deny")

	cfg.AccessLists = []AccessList{{Name: "l", Rules: []AccessRule{{Allow: "not-an-ip"}}}}
	mustFail(t, cfg, "not an IP")

	// IP, CIDR, IPv6 and "all" are each fine.
	cfg.AccessLists = []AccessList{{Name: "l", Rules: []AccessRule{
		{Allow: "192.0.2.1"}, {Allow: "10.0.0.0/8"}, {Deny: "2001:db8::/32"}, {Deny: "all"},
	}}}
	if err := Validate(cfg); err != nil {
		t.Fatalf("expected valid rules, got %v", err)
	}
}

func TestValidateAccessListRefs(t *testing.T) {
	cfg := baseCfg()
	cfg.Proxies = []Proxy{{Domain: "a.example.com", Pass: "http://127.0.0.1:1", AccessList: "ghost"}}
	mustFail(t, cfg, `access_list "ghost" is not declared`)

	cfg = baseCfg()
	cfg.AccessLists = []AccessList{{Name: "office"}}
	cfg.Redirects = []Redirect{{Domain: "r.example.com", To: "t.example.com", AccessList: "nope"}}
	mustFail(t, cfg, `access_list "nope" is not declared`)

	cfg = baseCfg()
	cfg.DeadHosts = []DeadHost{{Domain: "d.example.com", AccessList: "nope"}}
	mustFail(t, cfg, `access_list "nope" is not declared`)
}

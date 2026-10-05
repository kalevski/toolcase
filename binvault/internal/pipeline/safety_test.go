package pipeline

import (
	"net/netip"
	"strings"
	"testing"
)

func TestCheckAddr(t *testing.T) {
	type tc struct {
		addr           string
		allowPrivate   bool
		blocked        bool
		blockedPrivate bool // blocked when private addresses are refused
	}
	tests := []tc{
		{"8.8.8.8", true, false, false},
		{"2001:4860:4860::8888", true, false, false},
		{"127.0.0.1", true, false, true}, {"::1", true, false, true}, {"127.1.2.3", true, false, true},
		{"10.0.0.1", true, false, true}, {"172.16.5.4", true, false, true}, {"172.31.255.255", true, false, true},
		{"192.168.1.1", true, false, true}, {"fd12:3456::1", true, false, true}, {"fc00::1", true, false, true},
		{"172.32.0.1", true, false, false}, // just outside RFC 1918
		// never allowed
		{"169.254.169.254", true, true, true}, {"169.254.0.1", true, true, true}, {"169.254.255.255", true, true, true},
		{"fe80::1", true, true, true}, {"fe80::abcd:1", true, true, true},
		{"fd00:ec2::254", true, true, true}, {"100.100.100.200", true, true, true}, {"192.0.0.192", true, true, true},
		{"168.63.129.16", true, true, true},
		{"0.0.0.0", true, true, true}, {"::", true, true, true}, {"255.255.255.255", true, true, true},
		{"224.0.0.1", true, true, true}, {"ff02::1", true, true, true},
		// the same addresses in disguise
		{"::ffff:169.254.169.254", true, true, true}, // IPv4-mapped
		{"64:ff9b::a9fe:a9fe", true, true, true},     // NAT64 of 169.254.169.254
		{"2002:a9fe:a9fe::1", true, true, true},      // 6to4 of 169.254.169.254
		{"::ffff:127.0.0.1", true, false, true},      // mapped loopback
		{"64:ff9b::7f00:1", true, false, true},       // NAT64 of 127.0.0.1
		{"fe80::1%eth0", true, true, true},           // with a zone
	}
	for _, c := range tests {
		ip, err := netip.ParseAddr(c.addr)
		if err != nil {
			t.Fatalf("%s: %v", c.addr, err)
		}
		if got := checkAddr(ip, true) != nil; got != c.blocked {
			t.Errorf("checkAddr(%s, allowPrivate) blocked=%v, want %v", c.addr, got, c.blocked)
		}
		if got := checkAddr(ip, false) != nil; got != c.blockedPrivate {
			t.Errorf("checkAddr(%s, !allowPrivate) blocked=%v, want %v", c.addr, got, c.blockedPrivate)
		}
	}
	if err := checkAddr(netip.Addr{}, true); err == nil {
		t.Error("an invalid address is refused")
	}
	err := checkAddr(netip.MustParseAddr("169.254.169.254"), true)
	if err == nil || !strings.Contains(err.Error(), "169.254.169.254") {
		t.Errorf("the message names the address: %v", err)
	}
	if _, ok := isBlocked(err); !ok {
		t.Error("isBlocked")
	}
}

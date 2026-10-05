package pipeline

import (
	"errors"
	"fmt"
	"net"
	"net/netip"
	"syscall"
	"time"
)

// blockedError is a connection refused by the outbound safety rules (spec
// §7.13): a misconfiguration, not a transient failure.
type blockedError struct{ msg string }

func (e *blockedError) Error() string { return e.msg }

// alwaysBlocked are cloud-metadata endpoints outside the link-local range:
// nothing legitimate lives there (spec §7.13).
var alwaysBlocked = []netip.Prefix{
	netip.MustParsePrefix("fd00:ec2::254/128"),  // AWS IMDS over IPv6
	netip.MustParsePrefix("100.100.100.200/32"), // Alibaba Cloud metadata
	netip.MustParsePrefix("192.0.0.192/32"),     // Oracle Cloud metadata
	netip.MustParsePrefix("168.63.129.16/32"),   // Azure wire server
	netip.MustParsePrefix("169.254.0.0/16"),     // link-local, incl. the 169.254.169.254 metadata address
	netip.MustParsePrefix("fe80::/10"),          // link-local
	netip.MustParsePrefix("0.0.0.0/8"),          // "this network": reaches the local host on some systems
	netip.MustParsePrefix("255.255.255.255/32"), // broadcast
	netip.MustParsePrefix("::/128"),             // unspecified
}

// embeddedV4 returns the IPv4 address an IPv6 address carries when it is an
// IPv4-translation form (NAT64 well-known prefix, 6to4), so those cannot be
// used to reach a blocked IPv4 address.
func embeddedV4(ip netip.Addr) (netip.Addr, bool) {
	if !ip.Is6() {
		return netip.Addr{}, false
	}
	b := ip.As16()
	if netip.MustParsePrefix("64:ff9b::/96").Contains(ip) {
		return netip.AddrFrom4([4]byte{b[12], b[13], b[14], b[15]}), true
	}
	if b[0] == 0x20 && b[1] == 0x02 { // 2002::/16: 6to4
		return netip.AddrFrom4([4]byte{b[2], b[3], b[4], b[5]}), true
	}
	return netip.Addr{}, false
}

// checkAddr decides whether a pipeline call may connect to ip. Link-local and
// cloud-metadata addresses are always refused; with allowPrivate false the
// loopback, RFC 1918 and unique-local ranges are refused too.
func checkAddr(ip netip.Addr, allowPrivate bool) error {
	if !ip.IsValid() {
		return &blockedError{"the service address is not valid"}
	}
	ip = ip.WithZone("").Unmap()
	if v4, ok := embeddedV4(ip); ok {
		if err := checkAddr(v4, allowPrivate); err != nil {
			return err
		}
	}
	for _, p := range alwaysBlocked {
		if p.Contains(ip) {
			return &blockedError{fmt.Sprintf("the service address %s is not allowed (link-local and cloud-metadata addresses are always refused)", ip)}
		}
	}
	if ip.IsMulticast() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() {
		return &blockedError{fmt.Sprintf("the service address %s is not allowed", ip)}
	}
	if !allowPrivate && (ip.IsLoopback() || ip.IsPrivate()) {
		return &blockedError{fmt.Sprintf("the service address %s is private or loopback and BINVAULT_PIPELINE_ALLOW_PRIVATE is false", ip)}
	}
	return nil
}

// newDialer returns a dialer that validates the address it is about to connect
// to, after DNS resolution and for every attempt, so a hostname that resolves
// to something blocked (or changes its answer between a check and a connect,
// DNS rebinding) cannot reach it: the check is on the connection itself.
func newDialer(allowPrivate func() bool) *net.Dialer {
	return &net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 30 * time.Second,
		Control: func(network, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return &blockedError{"the service address is not valid"}
			}
			ip, err := netip.ParseAddr(host)
			if err != nil {
				return &blockedError{"the service address is not valid"}
			}
			return checkAddr(ip, allowPrivate())
		},
	}
}

func isBlocked(err error) (*blockedError, bool) {
	var b *blockedError
	if errors.As(err, &b) {
		return b, true
	}
	return nil, false
}

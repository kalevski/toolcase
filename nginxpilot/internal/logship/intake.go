package logship

import (
	"bytes"
	"context"
	"log/slog"
	"net"
	"slices"
	"strings"
	"sync"
	"time"
)

// maxDatagram is the receive buffer per datagram. nginx caps a syslog message
// well below this (~2 KB by default); anything larger arrives truncated at the
// SENDER, which the JSON parse detects and wraps as a parse_error entry (G1).
const maxDatagram = 64 << 10

// A transient read error backs off briefly instead of hot-looping; after this
// many consecutive errors the intake gives up and reports itself dead rather
// than silently consuming nothing forever while nginx keeps sending into a
// void (bug: read-loop death without surfacing it).
const (
	maxConsecutiveReadErrors = 10
	readErrorBackoff         = 100 * time.Millisecond
)

// Intake is the loopback UDP syslog listener nginx's
// `access_log syslog:server=…` points at. It strips the RFC3164 header, parses
// the JSON payload (redacting at ingest, before any destination sees the line)
// and dispatches to the shipper. Loss while the daemon is down is accepted for
// access logs (§1.3); durability wants a `file` destination.
type Intake struct {
	addr    string
	shipper *Shipper
	opts    ParseOptions
	log     *slog.Logger

	mu      sync.Mutex
	conn    net.PacketConn
	closed  bool
	onError func(error)
}

// OnError registers a callback invoked (at most once) if the read loop gives
// up after repeated consecutive read errors. The intake is already closed by
// the time this fires — the caller should treat shipping as down (e.g. record
// it for /status) since nothing recreates the intake on its own.
func (i *Intake) OnError(fn func(error)) {
	i.mu.Lock()
	i.onError = fn
	i.mu.Unlock()
}

// NewIntake builds an intake for a listen address ("127.0.0.1:5514").
func NewIntake(addr string, shipper *Shipper, opts ParseOptions, log *slog.Logger) *Intake {
	return &Intake{addr: addr, shipper: shipper, opts: opts, log: log}
}

// Start binds the UDP socket and begins reading. Bind failure is returned to
// the caller (surfaced in /status), never fatal to the daemon (G6). The intake
// must be started BEFORE nginx is reloaded with syslog access_log directives.
func (i *Intake) Start(ctx context.Context) error {
	conn, err := net.ListenPacket("udp", i.addr)
	if err != nil {
		return err
	}
	i.mu.Lock()
	if i.closed {
		i.mu.Unlock()
		conn.Close()
		return nil
	}
	i.conn = conn
	i.mu.Unlock()

	go func() {
		<-ctx.Done()
		i.Close()
	}()
	go i.readLoop(conn)
	i.log.Info("log intake listening", "addr", i.addr)
	return nil
}

// Close stops the listener (idempotent).
func (i *Intake) Close() {
	i.mu.Lock()
	defer i.mu.Unlock()
	i.closed = true
	if i.conn != nil {
		_ = i.conn.Close()
		i.conn = nil
	}
}

// Addr returns the configured listen address.
func (i *Intake) Addr() string { return i.addr }

// Options returns the ParseOptions this intake was constructed with, so a
// caller can detect a config-reload change (e.g. redact_params, anonymize_ip)
// that requires restarting the intake to take effect.
func (i *Intake) Options() ParseOptions { return i.opts }

// EqualParseOptions reports whether two ParseOptions are equivalent for
// intake-restart purposes (the Now clock override is test-only and ignored).
func EqualParseOptions(a, b ParseOptions) bool {
	if a.AnonymizeIP != b.AnonymizeIP {
		return false
	}
	return slices.Equal(normalizeRedactParams(a.RedactParams), normalizeRedactParams(b.RedactParams))
}

// normalizeRedactParams applies the same nil→default substitution and
// case-folding as redactParams() so equivalent configurations compare equal
// regardless of casing or explicit-vs-default nil.
func normalizeRedactParams(params []string) []string {
	src := params
	if src == nil {
		src = DefaultRedactParams
	}
	out := make([]string, len(src))
	for i, p := range src {
		out[i] = strings.ToLower(p)
	}
	slices.Sort(out)
	return out
}

func (i *Intake) readLoop(conn net.PacketConn) {
	buf := make([]byte, maxDatagram)
	var consecutiveErrors int
	for {
		n, _, err := conn.ReadFrom(buf)
		if err != nil {
			i.mu.Lock()
			closed := i.closed
			i.mu.Unlock()
			if closed {
				return
			}
			consecutiveErrors++
			i.log.Warn("log intake read failed", "error", err, "consecutive_errors", consecutiveErrors)
			if consecutiveErrors >= maxConsecutiveReadErrors {
				i.log.Error("log intake giving up after repeated read errors; access-log shipping is down",
					"addr", i.addr, "error", err)
				i.Close()
				i.mu.Lock()
				onError := i.onError
				i.mu.Unlock()
				if onError != nil {
					onError(err)
				}
				return
			}
			time.Sleep(readErrorBackoff)
			continue
		}
		consecutiveErrors = 0
		payload := stripSyslogHeader(buf[:n])
		line := make([]byte, len(payload)) // buf is reused; the entry owns its bytes
		copy(line, payload)
		i.shipper.Dispatch(ParseAccessLine(line, i.opts))
	}
}

// stripSyslogHeader extracts the message payload from an RFC3164 datagram
// ("<190>Oct 11 22:14:15 host nginx: {…}"). The JSON body starts at the first
// '{'; a datagram without one (garbage, or truncated before the payload)
// is passed through whole and becomes a parse_error entry.
func stripSyslogHeader(dgram []byte) []byte {
	if idx := bytes.IndexByte(dgram, '{'); idx >= 0 {
		return dgram[idx:]
	}
	return dgram
}

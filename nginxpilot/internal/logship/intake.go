package logship

import (
	"bytes"
	"context"
	"log/slog"
	"net"
	"sync"
)

// maxDatagram is the receive buffer per datagram. nginx caps a syslog message
// well below this (~2 KB by default); anything larger arrives truncated at the
// SENDER, which the JSON parse detects and wraps as a parse_error entry (G1).
const maxDatagram = 64 << 10

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

	mu     sync.Mutex
	conn   net.PacketConn
	closed bool
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

func (i *Intake) readLoop(conn net.PacketConn) {
	buf := make([]byte, maxDatagram)
	for {
		n, _, err := conn.ReadFrom(buf)
		if err != nil {
			i.mu.Lock()
			closed := i.closed
			i.mu.Unlock()
			if !closed {
				i.log.Warn("log intake read failed", "error", err)
			}
			return
		}
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

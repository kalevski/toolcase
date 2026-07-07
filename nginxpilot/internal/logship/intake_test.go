package logship

import (
	"errors"
	"net"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// scriptedConn is a net.PacketConn stub that replays a fixed script of
// ReadFrom results, then blocks until Close is called — enough to drive
// Intake.readLoop through a controlled sequence of transient/permanent errors.
type scriptedConn struct {
	mu      sync.Mutex
	resp    []scriptedResp
	idx     int
	closed  bool
	unblock chan struct{}
}

type scriptedResp struct {
	err  error
	data []byte
}

func newScriptedConn(resp []scriptedResp) *scriptedConn {
	return &scriptedConn{resp: resp, unblock: make(chan struct{})}
}

func (c *scriptedConn) ReadFrom(p []byte) (int, net.Addr, error) {
	c.mu.Lock()
	if c.idx < len(c.resp) {
		r := c.resp[c.idx]
		c.idx++
		c.mu.Unlock()
		if r.err != nil {
			return 0, nil, r.err
		}
		n := copy(p, r.data)
		return n, &net.UDPAddr{}, nil
	}
	unblock := c.unblock
	c.mu.Unlock()
	<-unblock
	return 0, nil, net.ErrClosed
}

func (c *scriptedConn) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.closed {
		c.closed = true
		close(c.unblock)
	}
	return nil
}

func (c *scriptedConn) LocalAddr() net.Addr                       { return &net.UDPAddr{} }
func (c *scriptedConn) WriteTo(p []byte, _ net.Addr) (int, error) { return len(p), nil }
func (c *scriptedConn) SetDeadline(time.Time) error               { return nil }
func (c *scriptedConn) SetReadDeadline(time.Time) error           { return nil }
func (c *scriptedConn) SetWriteDeadline(time.Time) error          { return nil }

func newFileShipper(t *testing.T) *Shipper {
	t.Helper()
	s := NewShipper(testLogger())
	dest := Destination{
		Name: "all", Type: DestFile, Path: filepath.Join(t.TempDir(), "a.ndjson"),
		FlushInterval: time.Hour, BatchSize: 1000,
	}
	dest.SetSpec("v1")
	s.Configure([]Destination{dest})
	return s
}

// TestIntakeReadLoopRecoversFromTransientError is bug 7's non-regression case:
// a single read error must not kill the loop or fire OnError — the next
// datagram must still be dispatched.
func TestIntakeReadLoopRecoversFromTransientError(t *testing.T) {
	s := newFileShipper(t)
	defer s.Close()

	dgram := []byte(`<190>Jul  6 10:00:00 edge nginxpilot: ` + sampleLine)
	conn := newScriptedConn([]scriptedResp{
		{err: errors.New("transient read error")},
		{data: dgram},
	})

	i := NewIntake("127.0.0.1:0", s, ParseOptions{}, testLogger())
	var errCalled atomic.Bool
	i.OnError(func(error) { errCalled.Store(true) })

	done := make(chan struct{})
	go func() { defer close(done); i.readLoop(conn) }()
	defer func() {
		i.Close()    // marks the intake closed so the next read error ends the loop...
		conn.Close() // ...which requires unblocking the conn's pending ReadFrom first
		<-done
	}()

	waitFor(t, 2*time.Second, func() bool { return s.Status().Received == 1 })
	if s.Status().Received != 1 {
		t.Fatalf("received = %d, want 1 (loop should survive one transient error)", s.Status().Received)
	}
	if errCalled.Load() {
		t.Error("OnError fired after a single transient error — should only fire once truly given up")
	}
}

// TestIntakeReadLoopGivesUpAfterRepeatedErrors is bug 7's core case: a
// persistent read error must not spin forever unnoticed — after enough
// consecutive failures the intake closes itself and reports through OnError
// so /status can reflect the outage.
func TestIntakeReadLoopGivesUpAfterRepeatedErrors(t *testing.T) {
	s := newFileShipper(t)
	defer s.Close()

	var resp []scriptedResp
	for i := 0; i < maxConsecutiveReadErrors+5; i++ {
		resp = append(resp, scriptedResp{err: errors.New("persistent read error")})
	}
	conn := newScriptedConn(resp)

	i := NewIntake("127.0.0.1:0", s, ParseOptions{}, testLogger())
	errCh := make(chan error, 1)
	i.OnError(func(err error) { errCh <- err })

	done := make(chan struct{})
	go func() { defer close(done); i.readLoop(conn) }()

	select {
	case err := <-errCh:
		if err == nil {
			t.Error("OnError called with a nil error")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("OnError was never called after repeated read errors")
	}
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("readLoop did not return after giving up")
	}
}

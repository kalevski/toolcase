package httpx

import (
	"context"
	"crypto/tls"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"time"
)

// Server is one listener.
type Server struct {
	Name string
	srv  *http.Server
	ln   net.Listener
	tls  bool
	log  *slog.Logger
}

// ServerConfig configures NewServer.
type ServerConfig struct {
	Name string
	Addr string
	// Listener, when set, is served instead of binding Addr (an already bound
	// socket: the peer listener of an in-process cluster in tests).
	Listener      net.Listener
	Handler       http.Handler
	HeaderTimeout time.Duration
	TLSCertFile   string
	TLSKeyFile    string
	Log           *slog.Logger
}

// NewServer binds the listener now (so port errors surface at boot) and
// returns a server ready for Serve.
func NewServer(c ServerConfig) (*Server, error) {
	ln := c.Listener
	if ln == nil {
		var err error
		if ln, err = net.Listen("tcp", c.Addr); err != nil {
			return nil, err
		}
	}
	hs := &http.Server{
		Handler:           c.Handler,
		ReadHeaderTimeout: c.HeaderTimeout,
		// No Read/WriteTimeout: transfers are bounded by idleness (IdleReader,
		// recorder), never by total time (spec §2.3).
		IdleTimeout:    2 * time.Minute,
		MaxHeaderBytes: 64 << 10,
	}
	if c.Log != nil {
		// what net/http itself reports (TLS handshake errors, ...) goes through the
		// process logger, so BINVAULT_LOG_FORMAT=json is JSON on every line (spec §2.3, §9.1)
		hs.ErrorLog = slog.NewLogLogger(c.Log.With("listener", c.Name).Handler(), slog.LevelWarn)
	}
	s := &Server{Name: c.Name, srv: hs, ln: ln, log: c.Log}
	if c.TLSCertFile != "" {
		cert, err := tls.LoadX509KeyPair(c.TLSCertFile, c.TLSKeyFile)
		if err != nil {
			ln.Close()
			return nil, err
		}
		hs.TLSConfig = &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12, NextProtos: []string{"h2", "http/1.1"}}
		s.tls = true
	}
	return s, nil
}

// Addr is the bound address.
func (s *Server) Addr() net.Addr { return s.ln.Addr() }

// Serve blocks until the server stops; it returns nil after Shutdown.
func (s *Server) Serve() error {
	var err error
	if s.tls {
		err = s.srv.ServeTLS(s.ln, "", "")
	} else {
		err = s.srv.Serve(s.ln)
	}
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

// Shutdown stops accepting and waits for in-flight requests until ctx ends.
func (s *Server) Shutdown(ctx context.Context) error { return s.srv.Shutdown(ctx) }

// Close drops every connection.
func (s *Server) Close() error { return s.srv.Close() }

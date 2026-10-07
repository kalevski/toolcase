package httpx

import (
	"context"
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
	log  *slog.Logger
}

// ServerConfig configures NewServer.
type ServerConfig struct {
	Name          string
	Addr          string
	Handler       http.Handler
	HeaderTimeout time.Duration
	ReadTimeout   time.Duration
	WriteTimeout  time.Duration
	IdleTimeout   time.Duration
	Log           *slog.Logger
}

// NewServer binds the listener now (so port errors surface at boot) and
// returns a server ready for Serve. Read and Write timeouts default to 30 s and
// 60 s; the streaming handlers (upload, download, event stream) extend their own
// deadlines with http.ResponseController.
func NewServer(c ServerConfig) (*Server, error) {
	ln, err := net.Listen("tcp", c.Addr)
	if err != nil {
		return nil, err
	}
	if c.HeaderTimeout == 0 {
		c.HeaderTimeout = 10 * time.Second
	}
	if c.ReadTimeout == 0 {
		c.ReadTimeout = 30 * time.Second
	}
	if c.WriteTimeout == 0 {
		c.WriteTimeout = 60 * time.Second
	}
	if c.IdleTimeout == 0 {
		c.IdleTimeout = 2 * time.Minute
	}
	hs := &http.Server{
		Handler:           c.Handler,
		ReadHeaderTimeout: c.HeaderTimeout,
		ReadTimeout:       c.ReadTimeout,
		WriteTimeout:      c.WriteTimeout,
		IdleTimeout:       c.IdleTimeout,
		MaxHeaderBytes:    64 << 10,
	}
	return &Server{Name: c.Name, srv: hs, ln: ln, log: c.Log}, nil
}

// Addr is the bound address.
func (s *Server) Addr() net.Addr { return s.ln.Addr() }

// Serve blocks until the server stops; it returns nil after Shutdown.
func (s *Server) Serve() error {
	err := s.srv.Serve(s.ln)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

// Shutdown stops accepting and waits for in-flight requests until ctx ends.
func (s *Server) Shutdown(ctx context.Context) error { return s.srv.Shutdown(ctx) }

// Close drops every connection.
func (s *Server) Close() error { return s.srv.Close() }

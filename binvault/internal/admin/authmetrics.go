package admin

// A failed admin-API authentication is counted like a failed S3 one (spec §9.2,
// §4.8): binvault_auth_failures_total{scheme="admin"}, and a request refused
// because its address is over the failure limit in binvault_throttled_total
// {reason="auth"}. The families are the data plane's (obs.Registry.Counter
// returns the registered one), the admin token being the most valuable
// credential there is.

func (s *Server) authFailed() {
	if s.Metrics != nil {
		s.Metrics.Counter("binvault_auth_failures_total", "Failed authentications.", "scheme").Inc("admin")
	}
}

func (s *Server) throttledAuth() {
	if s.Metrics != nil {
		s.Metrics.Counter("binvault_throttled_total", "Throttled requests.", "reason").Inc("auth")
	}
}

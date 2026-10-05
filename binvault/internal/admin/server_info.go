package admin

import (
	"net/http"
	"time"
)

func (s *Server) status(rc *Ctx) error {
	q := s.Eng.DB.Read()
	nb, c, err := q.Stats(rc.Ctx)
	if err != nil {
		return internalErr(err)
	}
	free, _ := s.Eng.Store.FreeBytes()
	pending, _ := q.GCPending(rc.Ctx)
	open, _ := q.CountOpenUploads(rc.Ctx, "")
	out := map[string]any{
		"version":         s.Version,
		"commit":          s.Commit,
		"node":            map[string]any{"id": s.NodeID, "name": s.NodeName, "mode": s.mode()},
		"uptime_seconds":  int64(time.Since(s.Started).Seconds()),
		"buckets":         nb,
		"objects":         c.Objects,
		"versions":        c.Versions,
		"bytes":           c.Bytes,
		"free_bytes":      free,
		"blob_gc_pending": pending,
		"open_uploads":    open,
		"schema_version":  0,
	}
	if v, err := s.Eng.DB.Version(rc.Ctx); err == nil {
		out["schema_version"] = v
	}
	if s.StatusExtra != nil {
		s.StatusExtra(rc, out)
	}
	WriteJSON(rc.W, http.StatusOK, out)
	return nil
}

func (s *Server) mode() string {
	if s.Cfg.ClusterEnabled() {
		return "cluster"
	}
	return "single"
}

// config reports the effective non-secret configuration (spec §6.2).
func (s *Server) config(rc *Ctx) error {
	c := s.Cfg
	proxies := make([]string, len(c.TrustedProxies))
	for i, p := range c.TrustedProxies {
		proxies[i] = p.String()
	}
	out := map[string]any{
		"listen": c.Listen, "admin_listen": c.AdminListen, "endpoint_url": c.EndpointURL, "domain": c.Domain,
		"region": c.Region, "fsync": c.Fsync, "min_free_mb": c.MinFreeMB, "max_object_mb": c.MaxObjectMB,
		"gc_grace": c.GCGrace.String(), "multipart_ttl": c.MultipartTTL.String(), "clock_skew": c.ClockSkew.String(),
		"header_timeout": c.HeaderTimeout.String(), "body_idle_timeout": c.BodyIdleTimeout.String(),
		"shutdown_timeout": c.ShutdownTimeout.String(), "auth_fail_limit": c.AuthFailLimit,
		"scrub_interval": c.ScrubInterval.String(), "lifecycle_interval": c.LifecycleInterval.String(),
		"lifecycle_batch":  c.LifecycleBatch,
		"pipeline_workers": c.PipelineWorkers, "pipeline_before_total_timeout": c.PipelineBeforeTotalTimeout.String(),
		"pipeline_max_depth": c.PipelineMaxDepth, "pipeline_allow_private": c.PipelineAllowPrivate,
		"pipeline_run_retention": c.PipelineRunRetention.String(), "metrics_per_bucket": c.MetricsPerBucket,
		"log_format": c.LogFormat, "log_level": c.LogLevel, "cluster": c.ClusterEnabled(),
		"data_dir": c.DataDir, "trusted_proxies": proxies, "tls": c.TLSEnabled(), "admin_tls": c.AdminTLSEnabled(),
		"admin_insecure_http": c.AdminInsecureHTTP, "pipeline_ca_file": c.PipelineCAFile,
	}
	if c.ClusterEnabled() {
		// the cluster settings apply only then; the cluster keys never appear here
		out["node_name"], out["cluster_urls"], out["cluster_listen"] = c.NodeName, c.ClusterURLs, c.ClusterListen
		out["cluster_tls"], out["cluster_ca_file"], out["cluster_insecure_http"] = c.ClusterTLSEnabled(), c.ClusterCAFile, c.ClusterInsecureHTTP
		out["cluster_pull_interval"], out["cluster_max_clock_skew"] = c.ClusterPullInterval.String(), c.ClusterMaxClockSkew.String()
		out["cluster_startup_fence"], out["cluster_retention"] = c.ClusterStartupFence.String(), c.ClusterRetention.String()
		out["cluster_forward_connect_timeout"] = c.ClusterForwardConnectTimeout.String()
		out["move_streams"], out["move_freeze_timeout"] = c.MoveStreams, c.MoveFreezeTimeout.String()
	}
	WriteJSON(rc.W, http.StatusOK, out)
	return nil
}

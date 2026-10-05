package obs

import (
	"io"
	"log/slog"
	"strings"
)

// NewLogger builds the process logger: logfmt-style text or JSON, at a level
// (spec §3.8 WEBMAIL_LOG_FORMAT / WEBMAIL_LOG_LEVEL).
func NewLogger(w io.Writer, format, level string) *slog.Logger {
	var lv slog.Level
	switch strings.ToLower(level) {
	case "debug":
		lv = slog.LevelDebug
	case "warn", "warning":
		lv = slog.LevelWarn
	case "error":
		lv = slog.LevelError
	default:
		lv = slog.LevelInfo
	}
	opts := &slog.HandlerOptions{Level: lv}
	if strings.EqualFold(format, "json") {
		return slog.New(slog.NewJSONHandler(w, opts))
	}
	return slog.New(slog.NewTextHandler(w, opts))
}

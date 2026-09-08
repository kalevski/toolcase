package logship

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync/atomic"
	"time"
)

// DaemonSink is a slog.Handler that ships the daemon's OWN log records to the
// configured destinations, then hands the record to the handler it wraps so
// stdout keeps everything it had.
//
// Access logs answer "what did visitors ask for"; these answer "what did the
// daemon do about it" — a sync that failed, a reload that was quarantined, a
// certificate that renewed. Without this the operational half of a realm's
// story lives only in `docker logs` on a box the operator may not be able to
// reach.
//
// Entries carry `"source":"nginxpilot"` and `Fields.Stream = "daemon"`, so a
// destination's filter can select or exclude them and LogQL can split the two
// streams apart.
type DaemonSink struct {
	inner   slog.Handler
	shipper atomic.Pointer[Shipper]
	level   slog.Leveler
}

// NewDaemonSink wraps inner. Until AttachShipper is called it is a pass-through,
// which is what boot needs: the logger exists before the shipper does.
func NewDaemonSink(inner slog.Handler, level slog.Leveler) *DaemonSink {
	return &DaemonSink{inner: inner, level: level}
}

// AttachShipper starts shipping. Passing nil stops it again (config turned off).
func (d *DaemonSink) AttachShipper(s *Shipper) { d.shipper.Store(s) }

func (d *DaemonSink) Enabled(ctx context.Context, level slog.Level) bool {
	return d.inner.Enabled(ctx, level)
}

func (d *DaemonSink) Handle(ctx context.Context, record slog.Record) error {
	if shipper := d.shipper.Load(); shipper != nil && (d.level == nil || record.Level >= d.level.Level()) {
		shipper.Dispatch(d.entry(record))
	}
	return d.inner.Handle(ctx, record)
}

func (d *DaemonSink) WithAttrs(attrs []slog.Attr) slog.Handler {
	next := &DaemonSink{inner: d.inner.WithAttrs(attrs), level: d.level}
	next.shipper.Store(d.shipper.Load())
	return next
}

func (d *DaemonSink) WithGroup(name string) slog.Handler {
	next := &DaemonSink{inner: d.inner.WithGroup(name), level: d.level}
	next.shipper.Store(d.shipper.Load())
	return next
}

// entry renders one record as the JSON line shipped downstream.
func (d *DaemonSink) entry(record slog.Record) Entry {
	fields := map[string]any{
		"ts":     record.Time.UTC().Format(time.RFC3339Nano),
		"level":  levelName(record.Level),
		"msg":    record.Message,
		"source": "nginxpilot",
		"stream": "daemon",
		// Mirrors Fields.ResourceType so `| json | resource_type="daemon"` selects
		// these lines the same way `site` / `proxy` select access-log lines.
		"resource_type": "daemon",
	}
	record.Attrs(func(attr slog.Attr) bool {
		if _, taken := fields[attr.Key]; !taken {
			fields[attr.Key] = attr.Value.Resolve().Any()
		}
		return true
	})

	raw, err := json.Marshal(fields)
	if err != nil {
		raw = []byte(`{"source":"nginxpilot","stream":"daemon","level":"error","msg":"log record could not be encoded"}`)
	}

	ts := record.Time
	if ts.IsZero() {
		ts = time.Now()
	}
	return Entry{
		Raw: raw,
		TS:  ts.UTC(),
		F:   Fields{Level: levelName(record.Level), Stream: "daemon", ResourceType: "daemon"},
	}
}

func levelName(level slog.Level) string {
	switch {
	case level < slog.LevelInfo:
		return "debug"
	case level < slog.LevelWarn:
		return "info"
	case level < slog.LevelError:
		return "warning"
	default:
		return "error"
	}
}

// The process builds its logger before it reads config, and the manager learns
// about destinations afterwards. Rather than thread the sink through every
// constructor, the process registers it here and the manager attaches the
// shipper to it when the logs config is applied.
var processSink atomic.Pointer[DaemonSink]

// SetDaemonSink registers the process-wide sink (called once at startup).
func SetDaemonSink(sink *DaemonSink) { processSink.Store(sink) }

// ProcessDaemonSink returns the registered sink, or nil when there is none
// (tests, or a build that never installed one).
func ProcessDaemonSink() *DaemonSink { return processSink.Load() }

package pipeline

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// Routes is the admin API of pipelines (spec §6.5 to §6.8). It is registered as
// admin.Server.Extra: it answers /pipelines*, /runs*, /backfills* and
// GET|PUT /buckets/{name}/pipelines, and reports handled=false for any other
// path.
func (m *Manager) Routes(rc *admin.Ctx) (bool, error) {
	segs, method := rc.Segs, rc.R.Method
	op := func(name string) { httpx.From(rc.Ctx).Op = name }
	if len(segs) == 0 {
		return false, nil
	}
	switch segs[0] {
	case "pipelines":
		switch {
		case len(segs) == 1 && method == http.MethodGet:
			op("AdminListPipelines")
			return true, m.listPipelines(rc)
		case len(segs) == 1 && method == http.MethodPost:
			op("AdminCreatePipeline")
			return true, m.createPipeline(rc)
		case len(segs) == 2:
			switch method {
			case http.MethodGet:
				op("AdminGetPipeline")
				return true, m.getPipeline(rc, segs[1])
			case http.MethodPut:
				op("AdminPutPipeline")
				return true, m.updatePipeline(rc, segs[1], false)
			case http.MethodPatch:
				op("AdminPatchPipeline")
				return true, m.updatePipeline(rc, segs[1], true)
			case http.MethodDelete:
				op("AdminDeletePipeline")
				return true, m.deletePipeline(rc, segs[1])
			}
		case len(segs) == 3 && segs[2] == "test" && method == http.MethodPost:
			op("AdminTestPipeline")
			return true, m.testPipeline(rc, segs[1])
		}
	case "buckets":
		if len(segs) == 3 && segs[2] == "pipelines" {
			httpx.From(rc.Ctx).Bucket = segs[1]
			switch method {
			case http.MethodGet:
				op("AdminGetAttachments")
				return true, m.getAttachments(rc, segs[1])
			case http.MethodPut:
				op("AdminPutAttachments")
				return true, m.putAttachments(rc, segs[1])
			}
		}
	case "runs":
		switch {
		case len(segs) == 1 && method == http.MethodGet:
			op("AdminListRuns")
			return true, m.listRuns(rc)
		case len(segs) == 2 && segs[1] == "retry" && method == http.MethodPost:
			op("AdminRetryRuns")
			return true, m.bulkRetry(rc)
		case len(segs) == 2 && segs[1] == "cancel" && method == http.MethodPost:
			op("AdminCancelRuns")
			return true, m.bulkCancel(rc)
		case len(segs) == 2 && method == http.MethodGet:
			op("AdminGetRun")
			return true, m.getRun(rc, segs[1])
		case len(segs) == 3 && segs[2] == "retry" && method == http.MethodPost:
			op("AdminRetryRun")
			return true, m.retryRun(rc, segs[1])
		case len(segs) == 3 && segs[2] == "cancel" && method == http.MethodPost:
			op("AdminCancelRun")
			return true, m.cancelRun(rc, segs[1])
		}
	case "backfills":
		switch {
		case len(segs) == 1 && method == http.MethodPost:
			op("AdminCreateBackfill")
			return true, m.createBackfill(rc)
		case len(segs) == 1 && method == http.MethodGet:
			op("AdminListBackfills")
			return true, m.listBackfills(rc)
		case len(segs) == 2 && method == http.MethodGet:
			op("AdminGetBackfill")
			return true, m.getBackfill(rc, segs[1])
		case len(segs) == 3 && segs[2] == "cancel" && method == http.MethodPost:
			op("AdminCancelBackfill")
			return true, m.cancelBackfill(rc, segs[1])
		}
	}
	return false, nil
}

// StatusExtra adds the queued and running runs of each pipeline to GET /status
// (spec §6.2).
func (m *Manager) StatusExtra(rc *admin.Ctx, out map[string]any) {
	load, err := m.db.Read().OpenRunsByPipeline(rc.Ctx)
	if err != nil {
		return
	}
	type counts struct {
		Queued  int64 `json:"queued"`
		Running int64 `json:"running"`
	}
	per := map[string]counts{}
	var queued, running int64
	for _, p := range m.pipes.all() {
		per[p.Name()] = counts{}
	}
	for name, l := range load {
		per[name] = counts{Queued: l.Queued, Running: l.Running}
		queued += l.Queued
		running += l.Running
	}
	out["pipelines"] = per
	out["runs_queued"] = queued
	out["runs_running"] = running
}

// PipelinesOf lists a bucket's attached pipelines for GET /buckets/{name}
// (spec §6.3).
func (m *Manager) PipelinesOf(ctx context.Context, bucket string) []any {
	set, err := m.attachments(ctx, m.db.Read(), bucket, 0)
	if err != nil || len(set.items) == 0 {
		return nil
	}
	out := make([]any, 0, len(set.items))
	for _, a := range set.items {
		out = append(out, m.attachmentView(a))
	}
	return out
}

// BucketDeleting runs inside the transaction that deletes a bucket: its queued
// runs and walking backfills end with it (spec §6.3). Nothing is raised as an
// event.
func (m *Manager) BucketDeleting(ctx context.Context, tx *meta.Tx, name string) error {
	refs, err := tx.CancelRuns(ctx, meta.RunFilter{Bucket: name}, ReasonBucketRemoved, tx.Now())
	if err != nil {
		return err
	}
	if err := tx.CancelBackfillsOf(ctx, name, "", tx.Now()); err != nil {
		return err
	}
	if err := tx.KVDeletePrefix(ctx, attachmentHoldPrefix+name+"/"); err != nil {
		return err
	}
	tx.AfterCommit(func() {
		for _, r := range refs {
			m.mt.runs.Inc(r.Pipeline, r.Stage, meta.RunCancelled)
		}
	})
	return nil
}

// BucketLeaving runs inside the transaction that discards a bucket that moved to
// another node (spec §8.8 step 6): what this node keeps for the bucket's
// attachments goes with its rows. The runs and backfills travelled with the
// bucket, so none is cancelled and nothing is counted.
func (m *Manager) BucketLeaving(ctx context.Context, tx *meta.Tx, name string) error {
	return tx.KVDeletePrefix(ctx, attachmentHoldPrefix+name+"/")
}

// ---- small helpers shared by the handlers ------------------------------------------

// ifMatch parses an If-Match revision ("3" or "\"3\""); 0 = absent.
func ifMatch(r *http.Request) (int64, error) {
	v := strings.Trim(strings.TrimSpace(r.Header.Get("If-Match")), `"`)
	if v == "" {
		return 0, nil
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil || n <= 0 {
		return 0, admin.Invalid("If-Match must be a revision number", nil)
	}
	return n, nil
}

func (m *Manager) env() Env { return Env{BeforeTotalTimeout: m.cfg.PipelineBeforeTotalTimeout} }

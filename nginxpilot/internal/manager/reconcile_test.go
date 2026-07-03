package manager

import (
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
)

func reconcileTestManager() *Manager {
	return &Manager{log: slog.New(slog.NewTextHandler(io.Discard, nil))}
}

func active(kind, key string) nginxctl.ResourceResult {
	return nginxctl.ResourceResult{Kind: kind, Key: key, State: nginxctl.StateActive}
}
func disabledRes(kind, key, reason string) nginxctl.ResourceResult {
	return nginxctl.ResourceResult{Kind: kind, Key: key, State: nginxctl.StateDisabled, Reason: reason}
}
func result(rs ...nginxctl.ResourceResult) nginxctl.ApplyResult {
	return nginxctl.ApplyResult{Resources: rs}
}

func TestReconcileSteadyStateNoApply(t *testing.T) {
	m := reconcileTestManager()
	res := result(active("proxy", "a.com"), active("proxy", "b.com"))
	for i := 0; i < 3; i++ {
		if m.reconcileDiff(res, res, config.ReconcileWarn) {
			t.Fatal("steady state must never trigger an apply")
		}
	}
	if len(m.reconcile) != 0 {
		t.Fatalf("healthy resources must carry no state, got %v", m.reconcile)
	}
}

func TestReconcileNewFailureWarnPolicy(t *testing.T) {
	m := reconcileTestManager()
	last := result(active("proxy", "a.com"))
	now := result(disabledRes("proxy", "a.com", "host not found"))

	for i := 0; i < 5; i++ {
		if m.reconcileDiff(now, last, config.ReconcileWarn) {
			t.Fatal("warn policy must never trigger an apply")
		}
	}
	e := m.reconcile[reconcileKey{"proxy", "a.com"}]
	if e == nil || !e.AtRisk || e.Reason != "host not found" {
		t.Fatalf("resource should be at_risk with reason, got %+v", e)
	}

	// Status merge: the still-active lastApply entry reads as at_risk.
	merged := m.mergeReconcileState([]nginxctl.ResourceResult{active("proxy", "a.com")})
	if merged[0].State != nginxctl.StateAtRisk || merged[0].Since == nil {
		t.Fatalf("merge should overlay at_risk + since, got %+v", merged[0])
	}
}

func TestReconcileDisablePolicyFlapDamped(t *testing.T) {
	m := reconcileTestManager()
	last := result(active("proxy", "a.com"))
	now := result(disabledRes("proxy", "a.com", "host not found"))

	if m.reconcileDiff(now, last, config.ReconcileDisable) {
		t.Fatal("first failing tick must not apply (flap damping)")
	}
	if !m.reconcileDiff(now, last, config.ReconcileDisable) {
		t.Fatal("second consecutive failing tick should apply under disable policy")
	}
}

func TestReconcileRecoveryFlapDamped(t *testing.T) {
	m := reconcileTestManager()
	last := result(disabledRes("proxy", "a.com", "was broken"))
	now := result(active("proxy", "a.com"))

	if m.reconcileDiff(now, last, config.ReconcileWarn) {
		t.Fatal("first passing tick must not apply (flap damping)")
	}
	if !m.reconcileDiff(now, last, config.ReconcileWarn) {
		t.Fatal("second consecutive passing tick should trigger the recovery apply")
	}
}

func TestReconcileFlappingNeverApplies(t *testing.T) {
	m := reconcileTestManager()
	lastA := result(active("proxy", "a.com"))
	nowFail := result(disabledRes("proxy", "a.com", "flaky dns"))
	nowOK := result(active("proxy", "a.com"))

	for i := 0; i < 6; i++ {
		var now nginxctl.ApplyResult
		if i%2 == 0 {
			now = nowFail
		} else {
			now = nowOK
		}
		if m.reconcileDiff(now, lastA, config.ReconcileDisable) {
			t.Fatalf("alternating pass/fail must never reach the damping threshold (tick %d)", i)
		}
	}
}

func TestReconcileSinceStableAcrossTicks(t *testing.T) {
	m := reconcileTestManager()
	last := result(active("proxy", "a.com"))
	now := result(disabledRes("proxy", "a.com", "gone"))

	m.reconcileDiff(now, last, config.ReconcileWarn)
	first := m.reconcile[reconcileKey{"proxy", "a.com"}].FirstFailure
	time.Sleep(5 * time.Millisecond)
	m.reconcileDiff(now, last, config.ReconcileWarn)
	if got := m.reconcile[reconcileKey{"proxy", "a.com"}].FirstFailure; !got.Equal(first) {
		t.Fatalf("since must be stable across ticks: %v vs %v", first, got)
	}
}

func TestReconcileAtRiskClears(t *testing.T) {
	m := reconcileTestManager()
	last := result(active("proxy", "a.com"))
	m.reconcileDiff(result(disabledRes("proxy", "a.com", "gone")), last, config.ReconcileWarn)
	if e := m.reconcile[reconcileKey{"proxy", "a.com"}]; e == nil || !e.AtRisk {
		t.Fatal("should be at_risk")
	}
	// Problem clears: active in both → entry pruned, no apply.
	if m.reconcileDiff(result(active("proxy", "a.com")), last, config.ReconcileWarn) {
		t.Fatal("clearing at_risk must not apply")
	}
	if len(m.reconcile) != 0 {
		t.Fatalf("entry should be pruned after recovery, got %v", m.reconcile)
	}
}

func TestReconcilePrunesDeletedResources(t *testing.T) {
	m := reconcileTestManager()
	last := result(active("proxy", "a.com"))
	m.reconcileDiff(result(disabledRes("proxy", "a.com", "gone")), last, config.ReconcileWarn)
	if len(m.reconcile) != 1 {
		t.Fatal("entry expected")
	}
	// Resource deleted from config: absent from both maps → pruned.
	empty := result()
	m.reconcileDiff(empty, empty, config.ReconcileWarn)
	if len(m.reconcile) != 0 {
		t.Fatalf("deleted resource must be pruned, got %v", m.reconcile)
	}
}

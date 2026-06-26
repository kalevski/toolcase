'use client'

import { useCallback, useEffect, useState } from 'react'
import type { PaidPlan, PlanTier } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'
import { SelectField, TextField, type SelectOption } from '@/components/fields'

// Owner-only plan-tier mapping (§8/§13). Maps a monthly sponsorship floor (cents)
// to a paid plan; the highest matching tier wins. Changes apply to effective
// plans immediately (plans are computed from this mapping, never stored).

const PAID_PLANS: PaidPlan[] = ['bronze', 'silver', 'gold']
const PLAN_OPTIONS: SelectOption[] = PAID_PLANS.map((plan) => ({ value: plan, label: plan }))

export function AdminPlans() {
    const fetcher = useCallback(async (): Promise<PlanTier[] | null> => {
        try {
            return await fetch('/api/admin/plan-tiers', { cache: 'no-store' }).then((r) => json<PlanTier[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Plans"
            subtitle="Map sponsorship tiers to plans. Owner-only."
            state={state}
            onRetry={() => void reload()}
        >
            {(planTiers) => <PlanTiersForm planTiers={planTiers} onSaved={() => void reload()} />}
        </AdminPage>
    )
}

interface TierDraft {
    minCents: string
    plan: PaidPlan
}

function PlanTiersForm({ planTiers, onSaved }: { planTiers: PlanTier[]; onSaved: () => void }) {
    const [rows, setRows] = useState<TierDraft[]>(() =>
        planTiers.map((t) => ({ minCents: String(t.minCents), plan: t.plan })),
    )
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const [busy, setBusy] = useState(false)

    // Re-seed when the persisted mapping reloads (e.g. after a save round-trip).
    useEffect(() => {
        setRows(planTiers.map((t) => ({ minCents: String(t.minCents), plan: t.plan })))
        setSaved(false)
    }, [planTiers])

    const setRow = (i: number, patch: Partial<TierDraft>) =>
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    const addRow = () => setRows((prev) => [...prev, { minCents: '', plan: 'bronze' }])
    const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i))

    const save = useCallback(async () => {
        if (busy) return
        // Validate + normalise into the PlanTier[] the PUT accepts (cheapest-first).
        const parsed: PlanTier[] = []
        for (const r of rows) {
            const minCents = Number(r.minCents)
            if (!Number.isInteger(minCents) || minCents < 0) {
                setError('Every tier needs a whole, non-negative cents amount.')
                return
            }
            if (!PAID_PLANS.includes(r.plan)) {
                setError('Every tier needs a valid plan.')
                return
            }
            parsed.push({ minCents, plan: r.plan })
        }
        parsed.sort((a, b) => a.minCents - b.minCents)

        setBusy(true)
        setError(null)
        setSaved(false)
        try {
            const res = await fetch('/api/admin/plan-tiers', {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(parsed),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(body?.error ? `Couldn’t save tiers: ${body.error}.` : `Couldn’t save tiers (error ${res.status}).`)
                return
            }
            setSaved(true)
            onSaved()
        } catch {
            setError('Couldn’t save tiers — network error.')
        } finally {
            setBusy(false)
        }
    }, [rows, busy, onSaved])

    return (
        <tc-section-card title="Plan tiers" icon="credit-card">
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    Map a monthly sponsorship floor (in cents) to a plan; the highest matching tier wins.
                    Changes apply to effective plans immediately.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}
                {saved && !error && <tc-banner variant="success">Plan tiers saved.</tc-banner>}

                {rows.length === 0 ? (
                    <tc-empty-state icon="credit-card">
                        No paid tiers — every user is on the free plan.
                    </tc-empty-state>
                ) : (
                    <div className="perch-admin-tiers">
                        {rows.map((r, i) => (
                            <div className="perch-admin-tier-row" key={i}>
                                <TextField
                                    className="perch-admin-field"
                                    type="number"
                                    min={0}
                                    step={100}
                                    size="sm"
                                    label="Min cents / mo"
                                    value={r.minCents}
                                    onValue={(v) => setRow(i, { minCents: v })}
                                    help={
                                        r.minCents !== '' && Number.isFinite(Number(r.minCents))
                                            ? `= $${(Number(r.minCents) / 100).toFixed(2)}/mo`
                                            : '—'
                                    }
                                />
                                <SelectField
                                    className="perch-admin-field"
                                    size="sm"
                                    label="Plan"
                                    value={r.plan}
                                    options={PLAN_OPTIONS}
                                    onValue={(v) => setRow(i, { plan: v as PaidPlan })}
                                />
                                <tc-button
                                    variant="danger"
                                    size="sm"
                                    outline
                                    onClick={() => removeRow(i)}
                                >
                                    Remove
                                </tc-button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="perch-admin-tier-actions">
                    <tc-button variant="secondary" outline onClick={addRow}>
                        Add tier
                    </tc-button>
                    <tc-button variant="primary" loading={busy || undefined} onClick={() => void save()}>
                        Save tiers
                    </tc-button>
                </div>
            </div>
        </tc-section-card>
    )
}

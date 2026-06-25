'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
    AdvancedTableColumn,
    ActivityItem,
    TeamMember,
} from '@toolcase/web-components'
import { useTc, useTcProps, escapeHtml, targetValue } from '@/lib/tc'
import type {
    AppUser,
    AuditEntry,
    BaseDomain,
    MeResponse,
    PaidPlan,
    PlanTier,
    Site,
} from '@/server/domain/types'

// Owner-only admin area (§13, §14, task 736). Gated on `role === 'owner'`: a
// non-owner is bounced to the dashboard before any admin data is requested, and
// every backing route is independently `authorize('owner')`-gated server-side, so
// the gate here is a UX nicety, not the security boundary.
//
// Four moderation surfaces, each a `tc-*` component driven through the lib/tc.ts
// bridge:
//   • tc-advanced-table — every site, with a per-row Suspend action (§11)
//   • tc-team-list      — the user roster (GET /api/admin/users)
//   • simple field forms — the subdomain pool + the $→plan mapping (§8, §10)
//   • tc-activity-card  — the append-only audit feed (§12)

const PAID_PLANS: PaidPlan[] = ['bronze', 'silver', 'gold']

// ── data loading ────────────────────────────────────────────────────────────

interface AdminData {
    sites: Site[]
    users: AppUser[]
    baseDomains: BaseDomain[]
    planTiers: PlanTier[]
    audit: AuditEntry[]
}

const json = <T,>(r: Response): Promise<T> => (r.ok ? (r.json() as Promise<T>) : Promise.reject(r))

type LoadState =
    | { phase: 'loading' }
    | { phase: 'forbidden' }
    | { phase: 'error' }
    | { phase: 'ready'; data: AdminData }

export function OwnerAdmin() {
    const router = useRouter()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })

    // Fetch the five admin datasets. Returns null on any failure so callers can
    // surface a single error state.
    const fetchAll = useCallback(async (): Promise<AdminData | null> => {
        try {
            const [sites, users, baseDomains, planTiers, audit] = await Promise.all([
                fetch('/api/admin/sites', { cache: 'no-store' }).then((r) => json<Site[]>(r)),
                fetch('/api/admin/users', { cache: 'no-store' }).then((r) => json<AppUser[]>(r)),
                fetch('/api/admin/base-domains', { cache: 'no-store' }).then((r) => json<BaseDomain[]>(r)),
                fetch('/api/admin/plan-tiers', { cache: 'no-store' }).then((r) => json<PlanTier[]>(r)),
                fetch('/api/admin/audit', { cache: 'no-store' }).then((r) => json<AuditEntry[]>(r)),
            ])
            return { sites, users, baseDomains, planTiers, audit }
        } catch {
            return null
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        // Confirm the owner role first (the AuthGate only guarantees an authenticated
        // user, not an owner). Non-owners are redirected and never see the area.
        fetch('/api/me', { cache: 'no-store' })
            .then(async (res) => {
                if (cancelled) return
                if (res.status === 401 || res.status === 403) {
                    router.replace('/login')
                    return
                }
                if (!res.ok) {
                    setState({ phase: 'error' })
                    return
                }
                const me = (await res.json()) as MeResponse
                if (me.role !== 'owner') {
                    setState({ phase: 'forbidden' })
                    router.replace('/')
                    return
                }
                const data = await fetchAll()
                if (cancelled) return
                setState(data ? { phase: 'ready', data } : { phase: 'error' })
            })
            .catch(() => {
                if (!cancelled) setState({ phase: 'error' })
            })
        return () => {
            cancelled = true
        }
    }, [router, fetchAll])

    // Targeted reloads after a mutation. Each merges the refreshed slice (and the
    // audit feed, since every owner mutation appends to it) into the loaded data.
    const reload = useCallback(
        async (keys: Array<keyof AdminData>) => {
            const fresh = await fetchAll()
            if (!fresh) return
            setState((prev) =>
                prev.phase === 'ready'
                    ? {
                          phase: 'ready',
                          data: keys.reduce(
                              (acc, k) => ({ ...acc, [k]: fresh[k] }),
                              { ...prev.data, audit: fresh.audit },
                          ),
                      }
                    : prev,
            )
        },
        [fetchAll],
    )

    if (state.phase === 'loading' || state.phase === 'forbidden') {
        return (
            <section className="perch-admin" role="status" aria-busy="true">
                <p className="perch-home-lead">Loading the admin area…</p>
            </section>
        )
    }

    if (state.phase === 'error') {
        return (
            <section className="perch-admin" role="alert">
                <h1 className="perch-home-title">Couldn’t load the admin area</h1>
                <p className="perch-home-lead">Refresh the page to try again.</p>
            </section>
        )
    }

    const { data } = state
    return (
        <section className="perch-admin">
            <header className="perch-home-header">
                <h1 className="perch-home-title">Administration</h1>
                <p className="perch-home-lead">
                    Moderate every site, manage the subdomain pool and sponsor-tier mapping, and read the
                    audit feed. Owner-only.
                </p>
            </header>

            <SitesModeration
                sites={data.sites}
                users={data.users}
                onSuspended={() => reload(['sites'])}
            />
            <UsersRoster users={data.users} />
            <BaseDomainsForm baseDomains={data.baseDomains} onChanged={() => reload(['baseDomains'])} />
            <PlanTiersForm planTiers={data.planTiers} onSaved={() => reload(['planTiers'])} />
            <AuditFeed audit={data.audit} />
        </section>
    )
}

// ── site moderation (tc-advanced-table + suspend) ────────────────────────────

const SITE_COLUMNS: AdvancedTableColumn[] = [
    { key: 'hostname', label: 'Host' },
    { key: 'owner', label: 'Owner' },
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Repo / branch' },
    { key: 'created', label: 'Created' },
    { key: 'action', label: '', align: 'right' },
]

// Body rows are injected as an HTML string into the projected <tbody> (the
// canonical tc-advanced-table pattern — see the examples demo), so every
// interpolated value is escaped. The Suspend control is a plain <button> with a
// data attribute; clicks are caught by delegation on the table host.
function sitesRowsHtml(sites: Site[], ownerById: Map<number, string>): string {
    if (sites.length === 0) {
        return `<tr><td colspan="6" class="perch-admin-empty-cell">No sites yet.</td></tr>`
    }
    return sites
        .map((s) => {
            const owner = ownerById.get(s.ownerId) ?? `#${s.ownerId}`
            const source = `${s.repoOwner}/${s.repoName}@${s.branch}`
            const created = String(s.createdAt).slice(0, 10)
            const action =
                s.status === 'suspended'
                    ? `<span class="perch-admin-suspended">Suspended</span>`
                    : `<button type="button" class="perch-admin-suspend-btn" data-suspend-id="${escapeHtml(s.id)}" data-suspend-host="${escapeHtml(s.hostname)}">Suspend</button>`
            return (
                `<tr>` +
                `<td>${escapeHtml(s.hostname)}</td>` +
                `<td>${escapeHtml(owner)}</td>` +
                `<td><span class="perch-admin-status perch-admin-status--${escapeHtml(s.status)}">${escapeHtml(s.status.replace('_', ' '))}</span></td>` +
                `<td class="perch-admin-mono">${escapeHtml(source)}</td>` +
                `<td class="perch-admin-mono">${escapeHtml(created)}</td>` +
                `<td style="text-align:right">${action}</td>` +
                `</tr>`
            )
        })
        .join('')
}

function SitesModeration({
    sites,
    users,
    onSuspended,
}: {
    sites: Site[]
    users: AppUser[]
    onSuspended: () => void
}) {
    const [busyId, setBusyId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const ownerById = useMemo(() => new Map(users.map((u) => [u.githubId, u.login])), [users])

    const suspend = useCallback(
        async (id: string, host: string) => {
            if (busyId) return
            if (typeof window !== 'undefined' && !window.confirm(`Suspend ${host}? It stops serving immediately.`)) {
                return
            }
            setBusyId(id)
            setError(null)
            try {
                const res = await fetch(`/api/admin/sites/${encodeURIComponent(id)}/suspend`, { method: 'POST' })
                if (!res.ok) {
                    setError(`Couldn’t suspend ${host} (error ${res.status}).`)
                    return
                }
                onSuspended()
            } catch {
                setError(`Couldn’t suspend ${host} — network error.`)
            } finally {
                setBusyId(null)
            }
        },
        [busyId, onSuspended],
    )

    // Delegate suspend clicks on the table host (the buttons live in the injected
    // tbody HTML, so a host-level listener is the only way to reach them).
    const onTableClick = useCallback(
        (event: Event) => {
            const btn = (event.target as HTMLElement)?.closest?.('[data-suspend-id]') as HTMLElement | null
            if (!btn) return
            const id = btn.getAttribute('data-suspend-id')
            const host = btn.getAttribute('data-suspend-host') ?? ''
            if (id) void suspend(id, host)
        },
        [suspend],
    )

    const tableProps = useMemo(
        () => ({ columns: SITE_COLUMNS, total: sites.length, limit: Math.max(sites.length, 1), offset: 0 }),
        [sites.length],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onTableClick })

    // Inject the body rows after the element has rendered its <tbody>. Re-runs
    // whenever the sites (or owner names) change — including after a suspend.
    useEffect(() => {
        const el = tableRef.current
        if (!el) return
        const body = el.querySelector('.tc-advanced-table-body')
        if (body) body.innerHTML = sitesRowsHtml(sites, ownerById)
    }, [sites, ownerById, tableRef])

    return (
        <tc-section-card title="Sites" icon="layout-dashboard">
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    Every site across all tenants. Suspending drops the nginxpilot fragment and reloads, so the
                    site stops serving immediately — it’s reversible (the row is kept).
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}
                {busyId && (
                    <p className="perch-admin-busy" role="status">
                        Suspending…
                    </p>
                )}
                <tc-advanced-table ref={tableRef} />
            </div>
        </tc-section-card>
    )
}

// ── user roster (tc-team-list) ───────────────────────────────────────────────

function UsersRoster({ users }: { users: AppUser[] }) {
    const members = useMemo<TeamMember[]>(
        () =>
            users.map((u) => ({
                id: String(u.githubId),
                name: u.name || u.login,
                email: u.login ? `@${u.login}` : undefined,
                role: u.role,
                avatarUrl: u.avatarUrl,
            })),
        [users],
    )
    const ref = useTcProps<HTMLElement>(useMemo(() => ({ members }), [members]))

    return (
        <tc-section-card title="Users" icon="users">
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    {users.length} account{users.length === 1 ? '' : 's'}. The bootstrap owner leads; roles are
                    captured at sign-in.
                </p>
                {users.length === 0 ? (
                    <tc-empty-state icon="users">No users yet.</tc-empty-state>
                ) : (
                    <tc-team-list ref={ref} />
                )}
            </div>
        </tc-section-card>
    )
}

// ── subdomain pool (base domains) ────────────────────────────────────────────

function BaseDomainsForm({
    baseDomains,
    onChanged,
}: {
    baseDomains: BaseDomain[]
    onChanged: () => void
}) {
    const [draft, setDraft] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const inputRef = useTc<HTMLElement>(undefined, {
        input: (event: Event) => setDraft(targetValue(event)),
    })

    const add = useCallback(async () => {
        const domain = draft.trim()
        if (!domain || busy) return
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/base-domains', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ domain }),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(body?.error ? `Couldn’t add domain: ${body.error}.` : `Couldn’t add domain (error ${res.status}).`)
                return
            }
            setDraft('')
            if (inputRef.current) (inputRef.current as any).value = ''
            onChanged()
        } catch {
            setError('Couldn’t add domain — network error.')
        } finally {
            setBusy(false)
        }
    }, [draft, busy, onChanged, inputRef])

    const remove = useCallback(
        async (domain: string) => {
            if (busy) return
            if (typeof window !== 'undefined' && !window.confirm(`Remove base domain ${domain}?`)) return
            setBusy(true)
            setError(null)
            try {
                const res = await fetch(`/api/admin/base-domains?domain=${encodeURIComponent(domain)}`, {
                    method: 'DELETE',
                })
                if (!res.ok && res.status !== 204) {
                    setError(`Couldn’t remove ${domain} (error ${res.status}).`)
                    return
                }
                onChanged()
            } catch {
                setError(`Couldn’t remove ${domain} — network error.`)
            } finally {
                setBusy(false)
            }
        },
        [busy, onChanged],
    )

    return (
        <tc-section-card title="Base domains" icon="globe">
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    The subdomain pool. Each base domain backs <code>&lt;label&gt;.&lt;domain&gt;</code> sites.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}

                {baseDomains.length === 0 ? (
                    <tc-empty-state icon="globe">No base domains registered.</tc-empty-state>
                ) : (
                    <ul className="perch-admin-list">
                        {baseDomains.map((b) => (
                            <li key={b.domain} className="perch-admin-list-row">
                                <span className="perch-admin-mono">{b.domain}</span>
                                <tc-button
                                    variant="danger"
                                    size="sm"
                                    outline
                                    disabled={busy || undefined}
                                    onClick={() => void remove(b.domain)}
                                >
                                    Remove
                                </tc-button>
                            </li>
                        ))}
                    </ul>
                )}

                <form
                    className="perch-admin-add-row"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void add()
                    }}
                >
                    <tc-input
                        ref={inputRef}
                        placeholder="perch.dev"
                        aria-label="New base domain"
                        autocomplete="off"
                    />
                    <tc-button type="submit" variant="primary" disabled={!draft.trim() || busy || undefined}>
                        Add domain
                    </tc-button>
                </form>
            </div>
        </tc-section-card>
    )
}

// ── plan-tier mapping ($ → plan) ─────────────────────────────────────────────

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
                                <label className="perch-admin-tier-field">
                                    <span className="perch-admin-field-label">Min cents / mo</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step={100}
                                        className="form-control form-control-sm"
                                        value={r.minCents}
                                        onChange={(e) => setRow(i, { minCents: e.target.value })}
                                    />
                                </label>
                                <label className="perch-admin-tier-field">
                                    <span className="perch-admin-field-label">Plan</span>
                                    <select
                                        className="form-select form-select-sm"
                                        value={r.plan}
                                        onChange={(e) => setRow(i, { plan: e.target.value as PaidPlan })}
                                    >
                                        {PAID_PLANS.map((p) => (
                                            <option key={p} value={p}>
                                                {p}
                                            </option>
                                        ))}
                                    </select>
                                </label>
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

// ── audit feed (tc-activity-card) ────────────────────────────────────────────

// Map an audit action to a lucide glyph (PascalCase — tc-activity-card resolves
// names against the lucide-static export map, falling back to Circle).
function auditIcon(action: string): string {
    if (action.includes('suspend')) return 'OctagonX'
    if (action.includes('base_domain')) return 'Globe'
    if (action.includes('plan_tier')) return 'CreditCard'
    if (action.includes('site')) return 'LayoutDashboard'
    return 'ScrollText'
}

function AuditFeed({ audit }: { audit: AuditEntry[] }) {
    const activities = useMemo<ActivityItem[]>(
        () =>
            audit.map((e) => {
                const actor = e.login ?? 'system'
                const detailParts = [e.detail, e.site ? `site ${e.site}` : null].filter(Boolean)
                return {
                    id: String(e.id),
                    icon: auditIcon(e.action),
                    title: `${actor} · ${e.action}`,
                    description: detailParts.join(' — ') || undefined,
                    timestamp: String(e.at).replace('T', ' ').slice(0, 19),
                }
            }),
        [audit],
    )
    const ref = useTcProps<HTMLElement>(useMemo(() => ({ activities }), [activities]))

    return (
        <tc-section-card title="Audit feed" icon="scroll-text">
            <div className="perch-admin-section">
                {audit.length === 0 ? (
                    <tc-empty-state icon="scroll-text">No audit entries yet.</tc-empty-state>
                ) : (
                    <tc-activity-card ref={ref} />
                )}
            </div>
        </tc-section-card>
    )
}

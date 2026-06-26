'use client'

import { useCallback, useMemo, useState } from 'react'
import {
    ACCOUNT_LEVEL_LABEL,
    reviveLimits,
    type AccountLevel,
    type AdminUserRow,
    type PlanLimits,
    type Role,
    type UserLimitOverride,
} from '@/server/domain/types'
import { formatBytes } from '@/server/domain/site-dashboard'
import { AdminPage, json, useOwnerData } from './shared'
import { useToast } from '@/components/Toast'
import { SelectField, TextField, type SelectOption } from '@/components/fields'

// Owner-only user roster + management (§6/§13). Every signed-in account, enriched
// with its unified level (owner/maintainer/paid/free), effective plan, current
// usage, and resolved limits. The owner can: grant `maintainer`/`owner` or drop to
// `standard` (PATCH /api/admin/users); and override any user's quotas above/below
// their role/plan default (PUT/DELETE /api/admin/users/{id}/limits). A search box +
// level filter keep a long roster scannable. The last owner can't be demoted (409).

// Assignable roles, highest-access first (matches the server's ASSIGNABLE_ROLES).
const ROLES: Role[] = ['owner', 'maintainer', 'standard']
const ROLE_OPTIONS: SelectOption[] = ROLES.map((role) => ({ value: role, label: role }))

// Level filter for the roster (the 'all' sentinel plus every AccountLevel).
const LEVEL_OPTIONS: SelectOption[] = [
    { value: 'all', label: 'All levels' },
    { value: 'owner', label: 'Owner' },
    { value: 'maintainer', label: 'Maintainer' },
    { value: 'paid', label: 'Paid' },
    { value: 'free', label: 'Free' },
]

const MB = 1024 * 1024

// tc-badge variant per account level — owner stands out, paid reads positive.
const LEVEL_VARIANT: Record<AccountLevel, string> = {
    owner: 'primary',
    maintainer: 'info',
    paid: 'success',
    free: 'secondary',
}

// ── small formatters (formatBytes returns "0 B" for Infinity; show ∞ instead) ──
const fmtCount = (n: number) => (isFinite(n) ? String(n) : '∞')
const fmtBytes = (n: number) => (isFinite(n) ? formatBytes(n) : '∞')

export function AdminUsers() {
    const fetcher = useCallback(async (): Promise<AdminUserRow[] | null> => {
        try {
            const rows = await fetch('/api/admin/users', { cache: 'no-store' }).then((r) => json<AdminUserRow[]>(r))
            // Infinity limits arrive as null over JSON — revive so unlimited shows as ∞.
            return rows.map((row) => ({ ...row, limits: reviveLimits(row.limits) }))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Users"
            subtitle="Everyone with a Perch account — their level, usage, and limits. Grant roles or override quotas here. Owner-only."
            state={state}
            onRetry={() => void reload()}
        >
            {(users) => <UsersRoster users={users} onChanged={() => void reload()} />}
        </AdminPage>
    )
}

function UsersRoster({ users, onChanged }: { users: AdminUserRow[]; onChanged: () => void }) {
    const toast = useToast()
    const [error, setError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<number | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [query, setQuery] = useState('')
    const [levelFilter, setLevelFilter] = useState<'all' | AccountLevel>('all')

    const changeRole = useCallback(
        async (row: AdminUserRow, role: Role) => {
            if (busyId || role === row.user.role) return
            setBusyId(row.user.githubId)
            setError(null)
            try {
                const res = await fetch('/api/admin/users', {
                    method: 'PATCH',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ githubId: row.user.githubId, role }),
                })
                if (!res.ok) {
                    const body = (await res.json().catch(() => null)) as { error?: string } | null
                    setError(
                        body?.error === 'last_owner'
                            ? `Can’t demote ${row.user.login} — they’re the last owner.`
                            : `Couldn’t change ${row.user.login}’s role${body?.error ? `: ${body.error}` : ` (error ${res.status})`}.`,
                    )
                    return
                }
                toast.show(`${row.user.login} is now ${role}.`, { variant: 'success' })
                onChanged()
            } catch {
                setError(`Couldn’t change ${row.user.login}’s role — network error.`)
            } finally {
                setBusyId(null)
            }
        },
        [busyId, onChanged, toast],
    )

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return users.filter((row) => {
            if (levelFilter !== 'all' && row.level !== levelFilter) return false
            if (!q) return true
            return row.user.login.toLowerCase().includes(q) || row.user.name.toLowerCase().includes(q)
        })
    }, [users, query, levelFilter])

    return (
        <tc-section-card title="Users" icon="users">
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    {users.length} account{users.length === 1 ? '' : 's'}. Maintainers get the Routing surface and skip
                    hosting quotas; owners additionally get this Admin surface. Override a user’s quotas with{' '}
                    <strong>Limits</strong>.
                </p>
                {error && <tc-banner variant="danger">{error}</tc-banner>}

                <div className="perch-admin-userbar">
                    <TextField
                        className="perch-admin-search"
                        type="search"
                        size="sm"
                        placeholder="Search by login or name…"
                        value={query}
                        onValue={setQuery}
                        ariaLabel="Search users"
                    />
                    <SelectField
                        className="perch-admin-level-filter"
                        size="sm"
                        value={levelFilter}
                        options={LEVEL_OPTIONS}
                        onValue={(v) => setLevelFilter(v as 'all' | AccountLevel)}
                        ariaLabel="Filter by level"
                    />
                </div>

                {filtered.length === 0 ? (
                    <tc-empty-state icon="users">
                        {users.length === 0 ? 'No users yet.' : 'No users match your search.'}
                    </tc-empty-state>
                ) : (
                    <ul className="perch-admin-list">
                        {filtered.map((row) => (
                            <li key={row.user.githubId} className="perch-admin-user">
                                <div className="perch-admin-user-main">
                                    <div className="perch-admin-user-id">
                                        <span className="perch-admin-user-name">
                                            {row.user.name || row.user.login}
                                        </span>{' '}
                                        <span className="perch-admin-hint">@{row.user.login}</span>
                                        <span className="perch-admin-badges">
                                            <tc-badge variant={LEVEL_VARIANT[row.level]}>
                                                {ACCOUNT_LEVEL_LABEL[row.level]}
                                            </tc-badge>
                                            {row.plan !== 'free' && <tc-badge variant="light">{row.plan}</tc-badge>}
                                            {row.customLimits && (
                                                <tc-badge variant="warning">custom limits</tc-badge>
                                            )}
                                        </span>
                                    </div>
                                    <div className="perch-admin-user-actions">
                                        <SelectField
                                            className="perch-admin-role-select"
                                            size="sm"
                                            value={ROLES.includes(row.user.role) ? row.user.role : 'standard'}
                                            options={ROLE_OPTIONS}
                                            disabled={busyId === row.user.githubId}
                                            onValue={(v) => void changeRole(row, v as Role)}
                                            ariaLabel={`Role for ${row.user.login}`}
                                        />
                                        <button
                                            type="button"
                                            className="perch-admin-linkbtn"
                                            aria-expanded={editingId === row.user.githubId}
                                            onClick={() =>
                                                setEditingId((id) =>
                                                    id === row.user.githubId ? null : row.user.githubId,
                                                )
                                            }
                                        >
                                            {editingId === row.user.githubId ? 'Close' : 'Limits'}
                                        </button>
                                    </div>
                                </div>

                                <dl className="perch-admin-user-meta">
                                    <span>
                                        <dt>Sites</dt>{' '}
                                        <dd>
                                            {row.usage.siteCount} / {fmtCount(row.limits.maxSites)}
                                        </dd>
                                    </span>
                                    <span>
                                        <dt>Storage</dt>{' '}
                                        <dd>
                                            {formatBytes(row.usage.totalBytes)} / {fmtBytes(row.limits.maxBytesTotal)}
                                        </dd>
                                    </span>
                                    <span>
                                        <dt>Per-site cap</dt> <dd>{fmtBytes(row.limits.maxBytesPerSite)}</dd>
                                    </span>
                                    <span>
                                        <dt>Custom domains</dt> <dd>{fmtCount(row.limits.customDomains)}</dd>
                                    </span>
                                    <span>
                                        <dt>Poll floor</dt> <dd>{row.limits.minIntervalSec}s</dd>
                                    </span>
                                    <span>
                                        <dt>Private repos</dt> <dd>{row.limits.privateRepos ? 'yes' : 'no'}</dd>
                                    </span>
                                </dl>

                                {editingId === row.user.githubId && (
                                    <LimitsEditor
                                        row={row}
                                        onSaved={() => {
                                            setEditingId(null)
                                            onChanged()
                                        }}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </tc-section-card>
    )
}

// ── per-user limit override editor ─────────────────────────────────────────────

// Numeric override fields. `mb` fields are edited in mebibytes for sanity and
// converted to bytes on save; everything else is a raw count.
const NUM_FIELDS: { key: keyof PlanLimits; label: string; mb?: boolean }[] = [
    { key: 'maxSites', label: 'Max sites' },
    { key: 'maxBytesPerSite', label: 'Max MiB / site', mb: true },
    { key: 'maxBytesTotal', label: 'Max MiB total', mb: true },
    { key: 'minIntervalSec', label: 'Min interval (s)' },
    { key: 'customDomains', label: 'Custom domains' },
    { key: 'keepReleases', label: 'Keep releases' },
]

type Draft = Record<string, string>
type ReposChoice = 'inherit' | 'allow' | 'deny'

// Private-repo override choices. The inherit label spells out the resolved
// default so the owner sees what "inherit" means for this user.
const REPOS_OPTIONS = (inheritedAllows: boolean): SelectOption[] => [
    { value: 'inherit', label: `Inherit (${inheritedAllows ? 'yes' : 'no'})` },
    { value: 'allow', label: 'Allow' },
    { value: 'deny', label: 'Deny' },
]

/** Seed the editor inputs from the stored override (blank field = inherit default). */
function seedDraft(custom: UserLimitOverride | null): Draft {
    const d: Draft = {}
    for (const f of NUM_FIELDS) {
        const v = custom?.[f.key] as number | undefined
        d[f.key] = v === undefined ? '' : String(f.mb ? v / MB : v)
    }
    return d
}

function LimitsEditor({ row, onSaved }: { row: AdminUserRow; onSaved: () => void }) {
    const toast = useToast()
    const [draft, setDraft] = useState<Draft>(() => seedDraft(row.customLimits))
    const [repos, setRepos] = useState<ReposChoice>(
        row.customLimits?.privateRepos === undefined ? 'inherit' : row.customLimits.privateRepos ? 'allow' : 'deny',
    )
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const limitsUrl = `/api/admin/users/${encodeURIComponent(String(row.user.githubId))}/limits`

    const save = useCallback(async () => {
        setError(null)
        const override: UserLimitOverride = {}
        for (const f of NUM_FIELDS) {
            const raw = draft[f.key]?.trim()
            if (!raw) continue // blank → inherit
            const n = Number(raw)
            if (!Number.isFinite(n) || n < 0 || (!f.mb && !Number.isInteger(n))) {
                setError(`${f.label} must be a non-negative ${f.mb ? 'number' : 'integer'}.`)
                return
            }
            ;(override[f.key] as number) = f.mb ? Math.round(n * MB) : n
        }
        if (repos !== 'inherit') override.privateRepos = repos === 'allow'

        setBusy(true)
        try {
            const res = await fetch(limitsUrl, {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(override),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(`Couldn’t save limits${body?.error ? `: ${body.error}` : ` (error ${res.status})`}.`)
                return
            }
            toast.show(`Saved limit overrides for ${row.user.login}.`, { variant: 'success' })
            onSaved()
        } catch {
            setError('Couldn’t save limits — network error.')
        } finally {
            setBusy(false)
        }
    }, [draft, repos, limitsUrl, onSaved, toast, row.user.login])

    const clear = useCallback(async () => {
        setError(null)
        setBusy(true)
        try {
            const res = await fetch(limitsUrl, { method: 'DELETE' })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(`Couldn’t clear limits${body?.error ? `: ${body.error}` : ` (error ${res.status})`}.`)
                return
            }
            toast.show(`Cleared limit overrides for ${row.user.login}.`, { variant: 'success' })
            onSaved()
        } catch {
            setError('Couldn’t clear limits — network error.')
        } finally {
            setBusy(false)
        }
    }, [limitsUrl, onSaved, toast, row.user.login])

    return (
        <div className="perch-admin-limits">
            <p className="perch-admin-hint">
                Leave a field blank to inherit the {ACCOUNT_LEVEL_LABEL[row.level].toLowerCase()} default. Overrides
                apply immediately.
            </p>
            {error && <tc-banner variant="danger">{error}</tc-banner>}
            <div className="perch-admin-limits-grid">
                {NUM_FIELDS.map((f) => {
                    const def = row.limits[f.key] as number
                    const placeholder = `default ${f.mb ? fmtBytes(def) : fmtCount(def)}`
                    return (
                        <TextField
                            key={f.key}
                            type="number"
                            min="0"
                            step={f.mb ? 'any' : '1'}
                            size="sm"
                            label={f.label}
                            value={draft[f.key]}
                            placeholder={placeholder}
                            disabled={busy}
                            onValue={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                        />
                    )
                })}
                <SelectField
                    size="sm"
                    label="Private repos"
                    value={repos}
                    options={REPOS_OPTIONS(row.limits.privateRepos)}
                    disabled={busy}
                    onValue={(v) => setRepos(v as ReposChoice)}
                />
            </div>
            <div className="perch-admin-tier-actions">
                <tc-button variant="primary" size="sm" onClick={save} disabled={busy || undefined}>
                    {busy ? 'Saving…' : 'Save limits'}
                </tc-button>
                {row.customLimits && (
                    <tc-button variant="secondary" size="sm" outline onClick={clear} disabled={busy || undefined}>
                        Clear override
                    </tc-button>
                )}
            </div>
        </div>
    )
}

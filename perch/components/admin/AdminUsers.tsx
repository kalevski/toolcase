'use client'

import { useCallback, useMemo, useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { escapeHtml } from '@/lib/tc'
import {
    ACCOUNT_LEVEL_LABEL,
    reviveLimits,
    type AccountLevel,
    type AdminUserRow,
    type PlanLimits,
    type Realm,
    type Role,
    type UserLimitOverride,
} from '@/server/domain/types'
import { formatBytes } from '@/server/domain/site-dashboard'
import { AdminPage, json, useOwnerData } from './shared'
import { DataTable } from '@/components/DataTable'
import { useToast } from '@/components/Toast'
import { CheckField, SelectField, TextField, type SelectOption } from '@/components/fields'

/** The roster payload: users + the full realm set (for the per-user realm grant editor). */
interface RosterData {
    users: AdminUserRow[]
    realms: Realm[]
}

// Owner-only user roster + management (§6/§13). Every signed-in account, enriched
// with its unified level (owner/maintainer/paid/free), effective plan, current
// usage, and resolved limits. The owner can: grant `maintainer`/`owner` or drop to
// `standard` (PATCH /api/admin/users); and override any user's quotas above/below
// their role/plan default (PUT/DELETE /api/admin/users/{id}/limits). A search box +
// level filter keep a long roster scannable. The last owner can't be demoted (409).

// Assignable roles, highest-access first (matches the server's ASSIGNABLE_ROLES).
const ROLES: Role[] = ['owner', 'maintainer', 'standard']

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

// ── tc-table model (P1/P3) ─────────────────────────────────────────────────────
// One row per account: an identity cell (name + @login + level/plan/custom badges
// + the effective-limits readout), a role <select>, and Limits / Realms toggle
// buttons. The inline LimitsEditor / RealmsEditor panels stay React, rendered
// BELOW the table keyed off the selected user, so no React subtree is captured.

interface UserTableRow extends Record<string, unknown> {
    row: AdminUserRow
}

function badge(variant: string, text: string): string {
    return `<span class="badge text-bg-${variant}">${escapeHtml(text)}</span>`
}

function userIdentityHtml(r: AdminUserRow): string {
    const badges: string[] = [badge(LEVEL_VARIANT[r.level], ACCOUNT_LEVEL_LABEL[r.level])]
    if (r.plan !== 'free') badges.push(badge('light', r.plan))
    if (r.customLimits) badges.push(badge('warning', 'custom limits'))
    const metaPair = (label: string, value: string) =>
        `<span><dt>${escapeHtml(label)}</dt> <dd>${escapeHtml(value)}</dd></span>`
    const meta =
        `<dl class="perch-admin-user-meta">` +
        metaPair('Sites', `${r.usage.siteCount} / ${fmtCount(r.limits.maxSites)}`) +
        metaPair('Storage', `${formatBytes(r.usage.totalBytes)} / ${fmtBytes(r.limits.maxBytesTotal)}`) +
        metaPair('Per-site cap', fmtBytes(r.limits.maxBytesPerSite)) +
        metaPair('Custom domains', fmtCount(r.limits.customDomains)) +
        metaPair('Poll floor', `${r.limits.minIntervalSec}s`) +
        metaPair('Private repos', r.limits.privateRepos ? 'yes' : 'no') +
        `</dl>`
    return (
        `<div class="perch-admin-user-id">` +
        `<span class="perch-admin-user-name">${escapeHtml(r.user.name || r.user.login)}</span> ` +
        `<span class="perch-admin-hint">@${escapeHtml(r.user.login)}</span>` +
        `<span class="perch-admin-badges">${badges.join('')}</span>` +
        `</div>` +
        meta
    )
}

function roleSelectHtml(r: AdminUserRow, busy: boolean): string {
    const current = ROLES.includes(r.user.role) ? r.user.role : 'standard'
    const opts = ROLES.map(
        (role) => `<option value="${role}"${role === current ? ' selected' : ''}>${escapeHtml(role)}</option>`,
    ).join('')
    return (
        `<select class="form-select form-select-sm perch-admin-role-select" data-action="role" data-id="${r.user.githubId}"` +
        ` aria-label="Role for ${escapeHtml(r.user.login)}"${busy ? ' disabled' : ''}>${opts}</select>`
    )
}

function userActionsHtml(r: AdminUserRow, multiRealm: boolean, editingId: number | null, editingRealmsId: number | null): string {
    const linkBtn = (action: string, label: string) =>
        `<button type="button" class="perch-admin-linkbtn" data-action="${action}" data-id="${r.user.githubId}">${escapeHtml(label)}</button>`
    const parts = [linkBtn('limits', editingId === r.user.githubId ? 'Close' : 'Limits')]
    if (multiRealm) parts.push(linkBtn('realms', editingRealmsId === r.user.githubId ? 'Close' : 'Realms'))
    return `<span class="perch-admin-user-actions">${parts.join('')}</span>`
}

const USER_COLUMNS = (
    busy: boolean,
    multiRealm: boolean,
    editingId: number | null,
    editingRealmsId: number | null,
): TableColumn[] => [
    { key: 'user', header: 'User', render: (rt: UserTableRow) => userIdentityHtml(rt.row) },
    { key: 'role', header: 'Role', width: '11rem', render: (rt: UserTableRow) => roleSelectHtml(rt.row, busy) },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (rt: UserTableRow) => userActionsHtml(rt.row, multiRealm, editingId, editingRealmsId),
    },
]

export function AdminUsers() {
    const fetcher = useCallback(async (): Promise<RosterData | null> => {
        try {
            // Fetch the roster and the realm set together — the per-user realm grant editor
            // needs the full realm list to offer (multiple_realms.md §F.2).
            const [rows, realms] = await Promise.all([
                fetch('/api/admin/users', { cache: 'no-store' }).then((r) =>
                    json<AdminUserRow[]>(r),
                ),
                fetch('/api/admin/realms', { cache: 'no-store' }).then((r) => json<Realm[]>(r)),
            ])
            // Infinity limits arrive as null over JSON — revive so unlimited shows as ∞.
            return {
                users: rows.map((row) => ({ ...row, limits: reviveLimits(row.limits) })),
                realms,
            }
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Users"
            subtitle="Everyone with a Perch account — their level, usage, and limits. Grant roles, realms, or override quotas here. Owner-only."
            icon="users"
            iconColor="violet"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => (
                <UsersRoster
                    users={data.users}
                    realms={data.realms}
                    onChanged={() => void reload()}
                />
            )}
        </AdminPage>
    )
}

function UsersRoster({
    users,
    realms,
    onChanged,
}: {
    users: AdminUserRow[]
    realms: Realm[]
    onChanged: () => void
}) {
    const toast = useToast()
    const [error, setError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<number | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editingRealmsId, setEditingRealmsId] = useState<number | null>(null)
    const [query, setQuery] = useState('')
    // Multi-realm deployments expose a per-user realm grant editor; a single-realm
    // instance hides it (the one realm is implicit — zero change for that common case).
    const multiRealm = realms.length > 1
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
            return (
                row.user.login.toLowerCase().includes(q) || row.user.name.toLowerCase().includes(q)
            )
        })
    }, [users, query, levelFilter])

    // One delegated handler for every user-row control: a role <select> change
    // PATCHes the role; the Limits / Realms link-buttons toggle the matching
    // below-table editor panel.
    const onRowAction = useCallback(
        (action: string, dataset: DOMStringMap, event: Event) => {
            const githubId = Number(dataset.id)
            if (!Number.isFinite(githubId)) return
            const row = users.find((u) => u.user.githubId === githubId)
            if (!row) return
            if (action === 'role') {
                void changeRole(row, (event.target as HTMLSelectElement).value as Role)
            } else if (action === 'limits') {
                setEditingId((id) => (id === githubId ? null : githubId))
                setEditingRealmsId(null)
            } else if (action === 'realms') {
                setEditingRealmsId((id) => (id === githubId ? null : githubId))
                setEditingId(null)
            }
        },
        [users, changeRole],
    )

    const columns = useMemo(
        () => USER_COLUMNS(busyId !== null, multiRealm, editingId, editingRealmsId),
        [busyId, multiRealm, editingId, editingRealmsId],
    )
    const tableRows = useMemo<UserTableRow[]>(() => filtered.map((row) => ({ row })), [filtered])
    const editingRow = editingId != null ? users.find((u) => u.user.githubId === editingId) : undefined
    const editingRealmsRow =
        editingRealmsId != null ? users.find((u) => u.user.githubId === editingRealmsId) : undefined

    return (
        <tc-section-card title="Users" icon="users">
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    {users.length} account{users.length === 1 ? '' : 's'}. Maintainers get the
                    Routing surface and skip hosting quotas; owners additionally get this Admin
                    surface. Override a user’s quotas with <strong>Limits</strong>.
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
                    <DataTable<UserTableRow>
                        columns={columns}
                        rows={tableRows}
                        rowKey={(rt) => rt.row.user.githubId}
                        onAction={onRowAction}
                    />
                )}

                {/* The inline limit / realm editors render below the table (not in a
                    cell) so no React subtree is captured by tc-table. */}
                {editingRow && (
                    <LimitsEditor
                        key={`limits-${editingRow.user.githubId}`}
                        row={editingRow}
                        onSaved={() => {
                            setEditingId(null)
                            onChanged()
                        }}
                    />
                )}

                {multiRealm && editingRealmsRow && (
                    <RealmsEditor
                        key={`realms-${editingRealmsRow.user.githubId}`}
                        row={editingRealmsRow}
                        realms={realms}
                        onSaved={() => {
                            setEditingRealmsId(null)
                            onChanged()
                        }}
                    />
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
        row.customLimits?.privateRepos === undefined
            ? 'inherit'
            : row.customLimits.privateRepos
              ? 'allow'
              : 'deny',
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
                setError(
                    `Couldn’t save limits${body?.error ? `: ${body.error}` : ` (error ${res.status})`}.`,
                )
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
                setError(
                    `Couldn’t clear limits${body?.error ? `: ${body.error}` : ` (error ${res.status})`}.`,
                )
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
                Leave a field blank to inherit the {ACCOUNT_LEVEL_LABEL[row.level].toLowerCase()}{' '}
                default. Overrides apply immediately.
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
                    <tc-button
                        variant="secondary"
                        size="sm"
                        outline
                        onClick={clear}
                        disabled={busy || undefined}
                    >
                        Clear override
                    </tc-button>
                )}
            </div>
        </div>
    )
}

// ── per-user realm grant editor (multiple_realms.md §F.2) ──────────────────────────

/**
 * Owner control over which realms a user may use and which is their operating default.
 * Non-owners never switch (§0.6), so for a user the grant set governs ACCESS and bounds
 * which realm the owner can make their default. PUTs the whole set + default at once.
 */
function RealmsEditor({
    row,
    realms,
    onSaved,
}: {
    row: AdminUserRow
    realms: Realm[]
    onSaved: () => void
}) {
    const toast = useToast()
    const [granted, setGranted] = useState<Set<string>>(
        () => new Set(row.realmGrants.map((g) => g.realmId)),
    )
    const [defaultId, setDefaultId] = useState<string>(
        () => row.realmGrants.find((g) => g.isDefault)?.realmId ?? '',
    )
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const realmsUrl = `/api/admin/users/${encodeURIComponent(String(row.user.githubId))}/realms`

    const toggle = useCallback((id: string, on: boolean) => {
        setGranted((prev) => {
            const next = new Set(prev)
            if (on) next.add(id)
            else next.delete(id)
            return next
        })
        // Clear the default if it was just un-granted.
        setDefaultId((d) => (on || d !== id ? d : ''))
    }, [])

    // Default options = the currently-granted realms (plus a "no default" sentinel).
    const grantedList = realms.filter((r) => granted.has(r.id))
    const defaultOptions: SelectOption[] = [
        { value: '', label: 'No default' },
        ...grantedList.map((r) => ({ value: r.id, label: r.name })),
    ]

    const save = useCallback(async () => {
        setError(null)
        const realmIds = [...granted]
        const defaultRealmId = defaultId && granted.has(defaultId) ? defaultId : null
        setBusy(true)
        try {
            const res = await fetch(realmsUrl, {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ realmIds, defaultRealmId }),
            })
            if (!res.ok) {
                const body = (await res.json().catch(() => null)) as { error?: string } | null
                setError(
                    body?.error === 'realm_has_user_sites'
                        ? `Can’t revoke a realm — ${row.user.login} still owns sites there. Delete them first.`
                        : `Couldn’t save realms${body?.error ? `: ${body.error}` : ` (error ${res.status})`}.`,
                )
                return
            }
            toast.show(`Saved realm access for ${row.user.login}.`, { variant: 'success' })
            onSaved()
        } catch {
            setError('Couldn’t save realms — network error.')
        } finally {
            setBusy(false)
        }
    }, [granted, defaultId, realmsUrl, onSaved, toast, row.user.login])

    return (
        <div className="perch-admin-limits">
            <p className="perch-admin-hint">
                Which realms {row.user.login} may use, and which is their operating default. They
                don’t switch — they always operate on the default realm among their grants.
            </p>
            {error && <tc-banner variant="danger">{error}</tc-banner>}
            <div className="perch-admin-realm-grants">
                {realms.map((r) => (
                    <CheckField
                        key={r.id}
                        inline
                        checked={granted.has(r.id)}
                        disabled={busy}
                        label={r.isDefault ? `${r.name} (default realm)` : r.name}
                        onChecked={(on) => toggle(r.id, on)}
                    />
                ))}
            </div>
            <div className="perch-admin-limits-grid">
                <SelectField
                    size="sm"
                    label="Their default realm"
                    value={defaultId}
                    options={defaultOptions}
                    disabled={busy || grantedList.length === 0}
                    onValue={setDefaultId}
                />
            </div>
            <div className="perch-admin-tier-actions">
                <tc-button variant="primary" size="sm" onClick={save} disabled={busy || undefined}>
                    {busy ? 'Saving…' : 'Save realms'}
                </tc-button>
            </div>
        </div>
    )
}

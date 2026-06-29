'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { TableColumn } from '@toolcase/web-components'
import { ROLE_RANK } from '@/server/domain/types'
import { useMe } from '@/lib/me-context'
import { LoadingState, ErrorState } from '@/components/states'
import { DataTable } from '@/components/DataTable'
import { SubTabBar, type SubTab } from '@/components/SubTabBar'
import { escapeHtml } from '@/lib/tc'

// The four routing sub-pages, surfaced as a Wharf-style tc-tab-bar above the body
// (P5) instead of four flat sidebar items.
const ROUTING_TABS: SubTab[] = [
    { id: 'proxies', label: 'Proxies', icon: 'globe', href: '/proxies' },
    { id: 'upstreams', label: 'Upstreams', icon: 'server', href: '/upstreams' },
    { id: 'streams', label: 'Streams', icon: 'cable', href: '/streams' },
    { id: 'stream-upstreams', label: 'Stream upstreams', icon: 'network', href: '/stream-upstreams' },
]

// Shared plumbing for the maintainer routing pages (Proxies, Upstreams) — the
// maintainer counterpart to `components/admin/shared.tsx`. Same gate shape, one
// rank up from owner-only: confirm the caller is a `maintainer` *or above* (so
// owners pass too), redirect anyone below away before requesting data, and render
// a consistent loading/error frame. Every backing `/api/routing/**` route is
// independently `authorize('maintainer')`-gated server-side, so this is a UX
// nicety, not the security boundary. The role comes from `useMe()` (plan WS-3).

/** Reject a non-OK response so a failed fetch surfaces as the error phase. */
export const json = <T,>(r: Response): Promise<T> => (r.ok ? (r.json() as Promise<T>) : Promise.reject(r))

export type RoutingDataState<T> =
    | { phase: 'loading' }
    | { phase: 'forbidden' }
    | { phase: 'error' }
    | { phase: 'ready'; data: T }

/**
 * Confirm the caller meets the `maintainer` rank, then load a routing dataset via
 * `fetcher`. Anyone below maintainer is redirected to the dashboard and never sees
 * routing data. `reload` re-runs the fetcher and swaps in fresh data (after a
 * mutation, or via the error Retry). `fetcher` MUST be stable (wrap in
 * `useCallback`) — it is intentionally omitted from the effect deps.
 */
export function useMaintainerData<T>(fetcher: () => Promise<T | null>): {
    state: RoutingDataState<T>
    reload: () => Promise<void>
} {
    const router = useRouter()
    const me = useMe()
    const [state, setState] = useState<RoutingDataState<T>>({ phase: 'loading' })

    useEffect(() => {
        if (ROLE_RANK[me.role] < ROLE_RANK.maintainer) {
            setState({ phase: 'forbidden' })
            router.replace('/')
            return
        }
        let cancelled = false
        void fetcher().then((data) => {
            if (cancelled) return
            setState(data ? { phase: 'ready', data } : { phase: 'error' })
        })
        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [me.role, router])

    const reload = useCallback(async () => {
        setState({ phase: 'loading' })
        const data = await fetcher()
        setState(data ? { phase: 'ready', data } : { phase: 'error' })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return { state, reload }
}

/**
 * Frame one routing page: a titled header plus the body for the current load
 * phase. `children` renders the ready data; loading/forbidden show shimmer
 * skeletons and error shows a banner with an in-place Retry (plan WS-4). Mirrors
 * `admin/shared.tsx`'s `AdminPage` so the routing pages stay visually consistent
 * with the admin surface (reuses the same `.perch-admin-*` layout classes).
 */
export function RoutingPage<T>({
    title,
    subtitle,
    icon,
    iconColor = 'cyan',
    state,
    onRetry,
    children,
}: {
    title: string
    subtitle?: string
    /** Lucide glyph (kebab-case) for the header icon chip — mirrors the side-nav icon. */
    icon?: string
    /** Header icon chip tint (tc-rich-page-header palette). */
    iconColor?: string
    state: RoutingDataState<T>
    onRetry?: () => void
    children: (data: T) => ReactNode
}) {
    let body: ReactNode
    if (state.phase === 'ready') {
        body = children(state.data)
    } else if (state.phase === 'error') {
        body = (
            <ErrorState
                title="Couldn’t load this page"
                message="The routing data didn’t come back. This is usually temporary."
                onRetry={onRetry}
            />
        )
    } else {
        body = <LoadingState shape="rows" count={4} />
    }

    // Same attribute-driven tc-rich-page-header as the admin frame — keeps the
    // maintainer routing pages visually consistent with the owner admin surface.
    return (
        <section className="perch-admin">
            <tc-rich-page-header
                title-text={title}
                description={subtitle}
                icon-name={icon}
                icon-color={iconColor}
            />
            <SubTabBar tabs={ROUTING_TABS} />
            <RoutingTestButton />
            {body}
        </section>
    )
}

/** One resource verdict from the managed-mode dry run (`POST /nginx/test`). */
interface NginxTestResource {
    kind: string
    key: string
    state: 'active' | 'disabled'
    reason?: string
}

interface NginxTestResponse {
    managed: boolean
    resources?: NginxTestResource[]
    error?: string
}

/**
 * Managed-mode "Test config" dry run (Phase E). POSTs `/api/routing/nginx-test` and
 * renders the per-resource pass/fail set so a maintainer can preview the daemon's
 * `nginx -t` verdict before trusting a live apply. Shows a muted note when managed mode
 * is off (the toggles still save; they're just inert until managed). Shared across all
 * four routing pages via {@link RoutingPage}.
 */
function RoutingTestButton() {
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<NginxTestResponse | null>(null)
    const [failed, setFailed] = useState(false)

    const run = useCallback(async () => {
        setBusy(true)
        setFailed(false)
        try {
            const res = await fetch('/api/routing/nginx-test', { method: 'POST' })
            if (!res.ok) {
                setResult(null)
                setFailed(true)
                return
            }
            setResult((await res.json()) as NginxTestResponse)
        } catch {
            setResult(null)
            setFailed(true)
        } finally {
            setBusy(false)
        }
    }, [])

    const disabled = result?.resources?.filter((r) => r.state === 'disabled') ?? []

    return (
        <div className="perch-routing-test">
            <tc-button variant="secondary" outline size="sm" onClick={run} disabled={busy || undefined}>
                {busy ? 'Testing…' : 'Test config'}
            </tc-button>
            {failed && <tc-banner variant="danger">Couldn’t run the dry run — the deploy engine didn’t answer.</tc-banner>}
            {result && !result.managed && (
                <tc-banner variant="info">
                    Managed mode is off — TLS &amp; security toggles and streams are inert until nginxpilot runs in
                    managed mode. Settings still save.
                </tc-banner>
            )}
            {result?.managed && disabled.length === 0 && (
                <tc-banner variant="success">All resources pass nginx&nbsp;-t.</tc-banner>
            )}
            {result?.managed && disabled.length > 0 && (
                <tc-banner variant="danger">
                    {disabled.length} resource{disabled.length === 1 ? '' : 's'} would be disabled by nginx&nbsp;-t:
                    <ul className="perch-admin-list">
                        {disabled.map((r) => (
                            <li key={`${r.kind}:${r.key}`}>
                                <span className="perch-admin-mono">
                                    {r.kind} {r.key}
                                </span>
                                {r.reason ? ` — ${r.reason}` : ''}
                            </li>
                        ))}
                    </ul>
                </tc-banner>
            )}
        </div>
    )
}

/**
 * Relocation-safe `tc-table` listing for the four routing surfaces (proxies,
 * upstreams, streams, stream upstreams) — each is a "mono name · descriptive hint
 * · Remove" row. The table renders the whole listing from its `columns`/`data`
 * properties (no slotted children); the Remove button is a delegated `<button>`.
 *
 * @param items   the rows; each yields a stable `name` (the delete key) and a `hint`.
 * @param onRemove invoked with the row's `name` when its Remove button is clicked.
 */
export interface RoutingListItem extends Record<string, unknown> {
    name: string
    hint: string
}

export function RoutingListTable({
    items,
    busy,
    onRemove,
}: {
    items: RoutingListItem[]
    busy: boolean
    onRemove: (name: string) => void
}) {
    const columns = useMemo<TableColumn[]>(
        () => [
            {
                key: 'name',
                header: 'Name',
                render: (row: RoutingListItem) =>
                    `<span class="perch-admin-mono">${escapeHtml(row.name)}</span> ` +
                    `<span class="perch-admin-hint">${escapeHtml(row.hint)}</span>`,
            },
            {
                key: 'action',
                header: '',
                align: 'right',
                render: (row: RoutingListItem) =>
                    `<button type="button" class="btn btn-sm btn-outline-danger" data-action="remove"` +
                    ` data-name="${escapeHtml(row.name)}"${busy ? ' disabled' : ''}>Remove</button>`,
            },
        ],
        [busy],
    )
    const onAction = useCallback(
        (action: string, dataset: DOMStringMap) => {
            if (action === 'remove' && dataset.name) onRemove(dataset.name)
        },
        [onRemove],
    )
    return (
        <DataTable<RoutingListItem>
            columns={columns}
            rows={items}
            rowKey={(row) => row.name}
            onAction={onAction}
        />
    )
}

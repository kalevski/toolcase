'use client'

// Notes list (spec §4.5, §9): a `tc-advanced-table` (built-in filter toolbar,
// loading overlay, paginated footer) over the notes API. Search lives in the
// table toolbar; the date range (tc-date-picker ×2) and the multi-tag AND
// filter (tc-chip-group) sit above it. Body rows are injected through the
// element-owned `rows` HTML string — the relocation-safe tc-advanced-table
// contract (see quaykeeper's /admin/sites) — so every interpolated value is
// escaped and row actions are plain `data-action` buttons caught by one
// delegated listener on the host.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AdvancedTableColumn, AdvancedTableFilter } from '@toolcase/web-components'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTc, escapeHtml, escapeSnippetHtml } from '@/lib/tc'
import { iconBtnHtml } from '@/lib/action-icons'
import { useMe } from '@/lib/me-context'
import { useToast } from '@/components/Toast'
import { DateField } from '@/components/fields'
import { LoadingState, ErrorState, EmptyState } from '@/components/states'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { NoteListItem, TagCount } from '@/server/domain/types'

interface NotesResponse {
    items: NoteListItem[]
    total: number
    page: number
    pageSize: number
}

const COLUMNS: AdvancedTableColumn[] = [
    { key: 'date', label: 'Date', width: '6.5rem' },
    { key: 'title', label: 'Title' },
    { key: 'tags', label: 'Tags' },
    { key: 'updated', label: 'Updated', width: '6.5rem' },
    { key: 'actions', label: '', align: 'right' },
]

const FILTERS: AdvancedTableFilter[] = [
    { key: 'q', label: 'Search', type: 'text', placeholder: 'Search titles and content…' },
]

function rowsHtml(items: NoteListItem[], isAdmin: boolean): string {
    if (items.length === 0) {
        return `<tr><td colspan="5" class="voxscribe-table-empty-cell"><tc-empty-state icon="search-x">No matches.</tc-empty-state></td></tr>`
    }
    return items
        .map((n) => {
            const owner =
                isAdmin && n.ownerLogin ? ` <span class="voxscribe-muted">@${escapeHtml(n.ownerLogin)}</span>` : ''
            const snippet = n.snippet ? `<div class="voxscribe-snippet">${escapeSnippetHtml(n.snippet)}</div>` : ''
            const tags = n.tags
                .map((t) => `<tc-badge variant="secondary" text="${escapeHtml(t)}"></tc-badge>`)
                .join(' ')
            const actions = [
                iconBtnHtml({ icon: 'view', label: 'Open', data: { action: 'open', id: n.id } }),
                iconBtnHtml({ icon: 'download', label: 'Download .md', data: { action: 'download', id: n.id } }),
                iconBtnHtml({ icon: 'remove', label: 'Delete', danger: true, data: { action: 'delete', id: n.id } }),
            ].join('')
            return (
                `<tr>` +
                `<td class="voxscribe-cell-mono">${escapeHtml(n.noteDate)}</td>` +
                `<td><a href="/notes/${escapeHtml(n.id)}" data-action="open" data-id="${escapeHtml(n.id)}">${escapeHtml(n.title)}</a>${owner}${snippet}</td>` +
                `<td><span class="voxscribe-tag-row">${tags}</span></td>` +
                `<td class="voxscribe-cell-mono">${escapeHtml(String(n.updatedAt).slice(0, 10))}</td>` +
                `<td><div class="voxscribe-row-actions">${actions}</div></td>` +
                `</tr>`
            )
        })
        .join('')
}

export function NotesClient() {
    const router = useRouter()
    const toast = useToast()
    const me = useMe()
    const [data, setData] = useState<NotesResponse | null>(null)
    const [tags, setTags] = useState<TagCount[]>([])
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [q, setQ] = useState('')
    const [page, setPage] = useState(1)
    const [deleting, setDeleting] = useState<NoteListItem | null>(null)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    const load = useCallback(async () => {
        setError(null)
        setBusy(true)
        const params = new URLSearchParams()
        if (selectedTags.length) params.set('tags', selectedTags.join(','))
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        if (q.trim()) params.set('q', q.trim())
        params.set('page', String(page))
        try {
            const [notes, tagList] = await Promise.all([
                apiFetch<NotesResponse>(`/api/notes?${params.toString()}`),
                apiFetch<{ tags: TagCount[] }>('/api/tags'),
            ])
            setData(notes)
            setTags(tagList.tags)
        } catch (err) {
            setError(describeApiError(err))
        } finally {
            setBusy(false)
        }
    }, [selectedTags, from, to, q, page])

    useEffect(() => {
        if (debounce.current) clearTimeout(debounce.current)
        debounce.current = setTimeout(() => void load(), q ? 250 : 0)
        return () => {
            if (debounce.current) clearTimeout(debounce.current)
        }
    }, [load, q])

    const onAction = useCallback(
        (action: string, dataset: DOMStringMap, event: Event) => {
            const id = dataset.id
            if (!id) return
            if (action === 'open') {
                event.preventDefault()
                router.push(`/notes/${id}`)
            } else if (action === 'download') {
                window.location.href = `/api/notes/${id}/download`
            } else if (action === 'delete') {
                const item = data?.items.find((n) => n.id === id)
                if (item) setDeleting(item)
            }
        },
        [router, data],
    )

    const confirmDelete = useCallback(async () => {
        if (!deleting) return
        setDeleteBusy(true)
        try {
            await apiFetch(`/api/notes/${deleting.id}`, { method: 'DELETE' })
            toast.show('Note deleted', { variant: 'success' })
            setDeleting(null)
            void load()
        } catch (err) {
            toast.show(describeApiError(err), { variant: 'error' })
        } finally {
            setDeleteBusy(false)
        }
    }, [deleting, toast, load])

    const pageSize = data?.pageSize ?? 25

    const tableProps = useMemo(
        () => ({
            columns: COLUMNS,
            filters: FILTERS,
            filterValues: { q },
            rows: data ? rowsHtml(data.items, me.role === 'admin') : '',
            total: data?.total ?? 0,
            limit: pageSize,
            offset: data ? (data.page - 1) * pageSize : 0,
        }),
        [q, data, me.role, pageSize],
    )

    // Delegated `data-action` clicks (the buttons live inside the injected tbody
    // HTML, so a host-level listener is the only way to reach them), plus the
    // table's own toolbar/pagination CustomEvents.
    const tableRef = useTc<HTMLElement>(tableProps, {
        click: (event: Event) => {
            const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
            if (!el) return
            const action = el.getAttribute('data-action')
            if (action) onAction(action, el.dataset, event)
        },
        'tc-filter-change': (event: Event) => {
            const { key, value } = ((event as CustomEvent).detail ?? {}) as { key?: string; value?: string }
            if (key === 'q') {
                setQ(value ?? '')
                setPage(1)
            }
        },
        'tc-page-change': (event: Event) => {
            const offset = Number(((event as CustomEvent).detail ?? {}).offset) || 0
            setPage(Math.floor(offset / pageSize) + 1)
        },
    })

    // Tag toggles with AND semantics — a note matches only if it carries every
    // selected tag. tc-chip-group flips the chip's own `selected` before the
    // event fires; the items property below re-asserts our state as the truth.
    const chipItems = useMemo(
        () =>
            tags.map((t) => ({
                id: t.name,
                label: t.name,
                count: t.count,
                selected: selectedTags.includes(t.name),
            })),
        [tags, selectedTags],
    )
    const chipRef = useTc<HTMLElement>(
        useMemo(() => ({ items: chipItems }), [chipItems]),
        {
            'tc-toggle': (event: Event) => {
                const id = (event as CustomEvent).detail?.id as string | undefined
                if (!id) return
                setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
                setPage(1)
            },
        },
    )

    const hasFilters = Boolean(selectedTags.length || from || to || q.trim())

    return (
        <div className="voxscribe-page">
            <div className="voxscribe-page-head">
                <h1>Notes</h1>
                <Link href="/notes/new" className="btn btn-primary">
                    New note
                </Link>
            </div>

            <div className="voxscribe-notes-range">
                <DateField label="From" value={from} onValue={(v) => { setFrom(v); setPage(1) }} max={to || undefined} />
                <DateField label="To" value={to} onValue={(v) => { setTo(v); setPage(1) }} min={from || undefined} />
            </div>
            {tags.length > 0 && (
                <div className="voxscribe-notes-tagbar">
                    <tc-chip-group ref={chipRef} title="Filter by tags (all selected tags must match)" />
                    {selectedTags.length > 0 && (
                        <tc-button variant="secondary" outline size="sm" onClick={() => { setSelectedTags([]); setPage(1) }}>
                            Clear tags
                        </tc-button>
                    )}
                </div>
            )}

            {error ? (
                <ErrorState message={error} onRetry={load} />
            ) : !data ? (
                <LoadingState shape="rows" count={6} />
            ) : data.items.length === 0 && !hasFilters ? (
                <EmptyState
                    icon="notebook-pen"
                    title="No notes yet"
                    description="Date-stamped markdown notes, filterable by tags — standups, meetings, anything."
                >
                    <Link href="/notes/new" className="btn btn-primary">
                        Write your first note
                    </Link>
                </EmptyState>
            ) : (
                <tc-advanced-table ref={tableRef} loading={busy || undefined} />
            )}

            <ConfirmDialog
                open={Boolean(deleting)}
                title="Delete note"
                message={deleting ? `Delete “${deleting.title}” (${deleting.noteDate})? This cannot be undone.` : ''}
                confirmLabel={deleteBusy ? 'Deleting…' : 'Delete'}
                danger
                onConfirm={confirmDelete}
                onCancel={() => setDeleting(null)}
            />
        </div>
    )
}

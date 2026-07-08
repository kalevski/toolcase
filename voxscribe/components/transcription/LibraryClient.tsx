'use client'

// Library (spec §4.3): DataTable with filters (status/language/model), FTS
// search with snippets, live status chips (SSE), pagination, row actions
// (open / download / retry / delete).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { TableColumn } from '@toolcase/web-components'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { escapeHtml, escapeSnippetHtml } from '@/lib/tc'
import { iconBtnHtml } from '@/lib/action-icons'
import { useJobEvents } from '@/lib/sse'
import { useToast } from '@/components/Toast'
import { useMe } from '@/lib/me-context'
import { DataTable } from '@/components/DataTable'
import { TextField, SelectField } from '@/components/fields'
import { LoadingState, ErrorState, EmptyState } from '@/components/states'
import { TypeToConfirmModal } from '@/components/TypeToConfirmModal'
import { humanBytes, humanDuration } from '@/server/domain/format'
import { WHISPER_LANGUAGES } from '@/server/domain/upload-validation'
import { statusChipHtml } from './StatusChip'
import type { TranscriptionListItem } from '@/server/domain/types'

interface ListResponse {
    items: TranscriptionListItem[]
    total: number
    page: number
    pageSize: number
}

const STATUS_OPTIONS = [
    { value: '', label: 'Any status' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'done', label: 'Done' },
    { value: 'failed', label: 'Failed' },
]

const LANGUAGE_OPTIONS = [
    { value: '', label: 'Any language' },
    ...WHISPER_LANGUAGES.filter((l) => l !== 'auto').map((code) => ({ value: code, label: code })),
]

export function LibraryClient() {
    const router = useRouter()
    const toast = useToast()
    const me = useMe()
    const [data, setData] = useState<ListResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState('')
    const [language, setLanguage] = useState('')
    // Model filter is plumbed through the API; the UI exposes status/language/
    // search (a model dropdown needs the models list — kept minimal for now).
    const [model] = useState('')
    const [q, setQ] = useState('')
    const [page, setPage] = useState(1)
    const [deleting, setDeleting] = useState<TranscriptionListItem | null>(null)
    const [deleteBusy, setDeleteBusy] = useState(false)
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    const load = useCallback(async () => {
        setError(null)
        const params = new URLSearchParams()
        if (status) params.set('status', status)
        if (language) params.set('language', language)
        if (model) params.set('model', model)
        if (q.trim()) params.set('q', q.trim())
        params.set('page', String(page))
        try {
            setData(await apiFetch<ListResponse>(`/api/transcriptions?${params.toString()}`))
        } catch (err) {
            setError(describeApiError(err))
        }
    }, [status, language, model, q, page])

    // Debounce the search box; other filters load immediately.
    useEffect(() => {
        if (debounce.current) clearTimeout(debounce.current)
        debounce.current = setTimeout(() => void load(), q ? 250 : 0)
        return () => {
            if (debounce.current) clearTimeout(debounce.current)
        }
    }, [load, q])

    // Live status updates: patch rows in place; refetch on terminal transitions
    // so new uploads and finished jobs appear with fresh metadata.
    useJobEvents((event) => {
        if (event.replay) return
        setData((prev) => {
            if (!prev) return prev
            const idx = prev.items.findIndex((t) => t.id === event.id)
            if (idx === -1) return prev
            const items = [...prev.items]
            items[idx] = { ...items[idx], status: event.status, progress: event.progress }
            return { ...prev, items }
        })
        if (event.status === 'done' || event.status === 'failed' || event.status === 'pending') void load()
    })

    const columns = useMemo<TableColumn[]>(
        () => [
            {
                key: 'title',
                header: 'Title',
                render: (row: any) => {
                    const t = row as TranscriptionListItem
                    // The FTS snippet is RAW transcript content with <mark> wrappers —
                    // escape-first, then re-enable only the mark tokens.
                    const snippet = t.snippet ? `<div class="voxscribe-snippet">${escapeSnippetHtml(t.snippet)}</div>` : ''
                    const owner = t.ownerLogin && me.role === 'admin' ? ` <span class="voxscribe-muted">@${escapeHtml(t.ownerLogin)}</span>` : ''
                    return `<a href="/transcriptions/${escapeHtml(t.id)}" data-action="open" data-id="${escapeHtml(t.id)}">${escapeHtml(t.title)}</a>${owner}${snippet}`
                },
            },
            { key: 'duration', header: 'Duration', render: (row: any) => escapeHtml(humanDuration((row as TranscriptionListItem).durationSeconds)) },
            {
                key: 'language',
                header: 'Language',
                render: (row: any) => {
                    const t = row as TranscriptionListItem
                    return escapeHtml(t.detectedLanguage ?? (t.language === 'auto' ? 'auto' : t.language))
                },
            },
            { key: 'model', header: 'Model' },
            {
                key: 'status',
                header: 'Status',
                render: (row: any) => {
                    const t = row as TranscriptionListItem
                    return statusChipHtml(t.status, t.progress, t.queuePosition)
                },
            },
            { key: 'size', header: 'Size', render: (row: any) => escapeHtml(humanBytes((row as TranscriptionListItem).mediaBytes)) },
            { key: 'created', header: 'Created', render: (row: any) => escapeHtml(String((row as TranscriptionListItem).createdAt).slice(0, 10)) },
            {
                key: 'actions',
                header: '',
                render: (row: any) => {
                    const t = row as TranscriptionListItem
                    const buttons = [
                        iconBtnHtml({ icon: 'view', label: 'Open', data: { action: 'open', id: t.id } }),
                        ...(t.status === 'done'
                            ? [iconBtnHtml({ icon: 'download', label: 'Download transcript (.txt)', data: { action: 'download', id: t.id } })]
                            : []),
                        ...(t.status === 'failed'
                            ? [iconBtnHtml({ icon: 'retry', label: 'Retry', data: { action: 'retry', id: t.id } })]
                            : []),
                        ...(t.status !== 'processing'
                            ? [iconBtnHtml({ icon: 'remove', label: 'Delete', danger: true, data: { action: 'delete', id: t.id } })]
                            : []),
                    ]
                    return `<div class="voxscribe-row-actions">${buttons.join('')}</div>`
                },
            },
        ],
        [me.role],
    )

    const onAction = useCallback(
        (action: string, dataset: DOMStringMap, event: Event) => {
            const id = dataset.id
            if (!id) return
            if (action === 'open') {
                event.preventDefault()
                router.push(`/transcriptions/${id}`)
            } else if (action === 'download') {
                window.location.href = `/api/transcriptions/${id}/transcript?format=txt`
            } else if (action === 'retry') {
                void apiFetch(`/api/transcriptions/${id}/retry`, { method: 'POST' })
                    .then(() => {
                        toast.show('Retry queued', { variant: 'success' })
                        void load()
                    })
                    .catch((err) => toast.show(describeApiError(err), { variant: 'error' }))
            } else if (action === 'delete') {
                const item = data?.items.find((t) => t.id === id)
                if (item) setDeleting(item)
            }
        },
        [router, toast, load, data],
    )

    const confirmDelete = useCallback(async () => {
        if (!deleting) return
        setDeleteBusy(true)
        try {
            await apiFetch(`/api/transcriptions/${deleting.id}`, { method: 'DELETE' })
            toast.show('Transcription deleted', { variant: 'success' })
            setDeleting(null)
            void load()
        } catch (err) {
            toast.show(describeApiError(err), { variant: 'error' })
        } finally {
            setDeleteBusy(false)
        }
    }, [deleting, toast, load])

    const rows = useMemo(() => (data?.items ?? []) as unknown as Record<string, unknown>[], [data])
    const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
    const hasFilters = Boolean(status || language || model || q.trim())

    return (
        <div className="voxscribe-page">
            <div className="voxscribe-page-head">
                <h1>Library</h1>
                <Link href="/new" className="btn btn-primary">
                    New transcription
                </Link>
            </div>

            <div className="voxscribe-filters">
                <TextField value={q} onValue={(v) => { setQ(v); setPage(1) }} type="search" placeholder="Search titles and spoken content…" ariaLabel="Search" />
                <SelectField value={status} onValue={(v) => { setStatus(v); setPage(1) }} options={STATUS_OPTIONS} ariaLabel="Status filter" />
                <SelectField value={language} onValue={(v) => { setLanguage(v); setPage(1) }} options={LANGUAGE_OPTIONS} ariaLabel="Language filter" />
            </div>

            {error ? (
                <ErrorState message={error} onRetry={load} />
            ) : !data ? (
                <LoadingState shape="rows" count={6} />
            ) : data.items.length === 0 && !hasFilters ? (
                <EmptyState icon="mic" title="No transcriptions yet" description="Upload your first audio to get started.">
                    <Link href="/new" className="btn btn-primary">
                        Upload your first audio
                    </Link>
                </EmptyState>
            ) : (
                <>
                    <DataTable columns={columns} rows={rows} rowKey={(row) => String(row.id)} emptyMessage="No matches." onAction={onAction} />
                    {totalPages > 1 && (
                        <div className="voxscribe-pager">
                            <tc-button variant="secondary" outline size="sm" disabled={page <= 1 || undefined} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                ← Prev
                            </tc-button>
                            <span>
                                Page {data.page} of {totalPages}
                            </span>
                            <tc-button variant="secondary" outline size="sm" disabled={page >= totalPages || undefined} onClick={() => setPage((p) => p + 1)}>
                                Next →
                            </tc-button>
                        </div>
                    )}
                </>
            )}

            {deleting && (
                <TypeToConfirmModal
                    title="Delete transcription"
                    prompt="This removes the audio, all transcript artifacts and the library entry. It cannot be undone."
                    expected={deleting.title}
                    busy={deleteBusy}
                    onConfirm={confirmDelete}
                    onClose={() => setDeleting(null)}
                />
            )}
        </div>
    )
}

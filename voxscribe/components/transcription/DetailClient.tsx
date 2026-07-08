'use client'

// Transcription detail (spec §4.4): inline-editable title, status + metadata,
// synced player, transcript tabs (Text / Segments / Raw JSON), download menu,
// danger zone (retry when failed, type-to-confirm delete). SSE keeps status
// and progress live; a terminal transition re-fetches the artifacts.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, describeApiError, ApiError } from '@/lib/fetcher'
import { useJobEvents } from '@/lib/sse'
import { useMe } from '@/lib/me-context'
import { useToast } from '@/components/Toast'
import { TextField } from '@/components/fields'
import { LoadingState, ErrorState } from '@/components/states'
import { TypeToConfirmModal } from '@/components/TypeToConfirmModal'
import { IconBtn } from '@/lib/action-icons'
import { humanBytes, humanDuration } from '@/server/domain/format'
import { StatusChip } from './StatusChip'
import { PlayerWithTranscript } from './PlayerWithTranscript'
import { DownloadMenu } from './DownloadMenu'
import type { TranscriptionDetail } from '@/server/domain/types'

type Tab = 'text' | 'segments' | 'json'

export function DetailClient({ id }: { id: string }) {
    const router = useRouter()
    const toast = useToast()
    const me = useMe()
    const [detail, setDetail] = useState<TranscriptionDetail | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [notFound, setNotFound] = useState(false)
    const [tab, setTab] = useState<Tab>('text')
    const [editingTitle, setEditingTitle] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [busy, setBusy] = useState(false)

    const load = useCallback(async () => {
        setError(null)
        try {
            setDetail(await apiFetch<TranscriptionDetail>(`/api/transcriptions/${id}`))
        } catch (err) {
            if (err instanceof ApiError && err.kind === 'notfound') setNotFound(true)
            else setError(describeApiError(err))
        }
    }, [id])

    useEffect(() => {
        void load()
    }, [load])

    useJobEvents((event) => {
        if (event.replay || event.id !== id) return
        if (event.status === 'done' || event.status === 'failed') {
            void load()
        } else {
            setDetail((prev) => (prev ? { ...prev, status: event.status, progress: event.progress } : prev))
        }
    })

    const saveTitle = useCallback(async () => {
        if (editingTitle === null || !detail) return
        const title = editingTitle.trim()
        if (!title || title === detail.title) {
            setEditingTitle(null)
            return
        }
        try {
            await apiFetch(`/api/transcriptions/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            })
            setDetail((prev) => (prev ? { ...prev, title } : prev))
            setEditingTitle(null)
            toast.show('Renamed', { variant: 'success' })
        } catch (err) {
            toast.show(describeApiError(err), { variant: 'error' })
        }
    }, [editingTitle, detail, id, toast])

    const retry = useCallback(async () => {
        setBusy(true)
        try {
            await apiFetch(`/api/transcriptions/${id}/retry`, { method: 'POST' })
            toast.show('Retry queued', { variant: 'success' })
            void load()
        } catch (err) {
            toast.show(describeApiError(err), { variant: 'error' })
        } finally {
            setBusy(false)
        }
    }, [id, toast, load])

    const doDelete = useCallback(async () => {
        setBusy(true)
        try {
            await apiFetch(`/api/transcriptions/${id}`, { method: 'DELETE' })
            toast.show('Transcription deleted', { variant: 'success' })
            router.push('/transcriptions')
        } catch (err) {
            toast.show(describeApiError(err), { variant: 'error' })
            setBusy(false)
        }
    }, [id, toast, router])

    const copyText = useCallback(async () => {
        if (!detail) return
        await navigator.clipboard.writeText(detail.text)
        toast.show('Copied to clipboard', { variant: 'success' })
    }, [detail, toast])

    if (notFound) return <ErrorState title="Not found" message="This transcription doesn’t exist or isn’t yours." />
    if (error) return <ErrorState message={error} onRetry={load} />
    if (!detail) return <LoadingState shape="detail" />

    return (
        <div className="voxscribe-page">
            <div className="voxscribe-detail-head">
                {editingTitle !== null ? (
                    <div className="voxscribe-title-edit">
                        <TextField value={editingTitle} onValue={setEditingTitle} ariaLabel="Title" />
                        <tc-button variant="primary" size="sm" onClick={saveTitle}>
                            Save
                        </tc-button>
                        <tc-button variant="secondary" outline size="sm" onClick={() => setEditingTitle(null)}>
                            Cancel
                        </tc-button>
                    </div>
                ) : (
                    <h1>
                        {detail.title}{' '}
                        <IconBtn icon="edit" label="Rename" onClick={() => setEditingTitle(detail.title)} />
                    </h1>
                )}
                <StatusChip status={detail.status} progress={detail.progress} queuePosition={detail.queuePosition} />
            </div>

            {detail.status === 'processing' && (
                <tc-progress value={detail.progress} max={100} striped animated />
            )}
            {detail.status === 'failed' && detail.error && (
                <tc-banner variant="error">
                    <strong>Failed:</strong> {detail.error}
                </tc-banner>
            )}

            <dl className="voxscribe-meta-grid">
                <dt>Duration</dt>
                <dd>{humanDuration(detail.durationSeconds)}</dd>
                <dt>Size</dt>
                <dd>{humanBytes(detail.mediaBytes)}</dd>
                <dt>Language</dt>
                <dd>
                    {detail.language}
                    {detail.detectedLanguage ? ` (detected: ${detail.detectedLanguage})` : ''}
                </dd>
                <dt>Model</dt>
                <dd>{detail.model}</dd>
                <dt>Created</dt>
                <dd>{detail.createdAt.slice(0, 16).replace('T', ' ')}</dd>
                {detail.finishedAt && (
                    <>
                        <dt>Finished</dt>
                        <dd>{detail.finishedAt.slice(0, 16).replace('T', ' ')}</dd>
                    </>
                )}
                {detail.translate && (
                    <>
                        <dt>Task</dt>
                        <dd>translate → English</dd>
                    </>
                )}
                {me.role === 'admin' && detail.ownerLogin && (
                    <>
                        <dt>Owner</dt>
                        <dd>@{detail.ownerLogin}</dd>
                    </>
                )}
            </dl>

            <PlayerWithTranscript id={id} segments={detail.segments} />

            {detail.status === 'done' && (
                <>
                    <div className="voxscribe-tabs" role="tablist">
                        {(['text', 'segments', 'json'] as Tab[]).map((t) => (
                            <button
                                key={t}
                                role="tab"
                                aria-selected={tab === t}
                                className={`btn btn-sm ${tab === t ? 'btn-secondary' : 'btn-outline-secondary'}`}
                                onClick={() => setTab(t)}
                            >
                                {t === 'text' ? 'Text' : t === 'segments' ? 'Segments' : 'Raw JSON'}
                            </button>
                        ))}
                    </div>
                    {tab === 'text' && (
                        <div className="voxscribe-transcript-text">
                            <tc-button variant="secondary" outline size="sm" onClick={copyText}>
                                Copy to clipboard
                            </tc-button>
                            <pre>{detail.text}</pre>
                        </div>
                    )}
                    {tab === 'segments' && (
                        <div className="voxscribe-transcript-text">
                            <pre>
                                {detail.segments
                                    .map((s) => `[${s.start.toFixed(1)}s → ${s.end.toFixed(1)}s] ${s.text}`)
                                    .join('\n')}
                            </pre>
                        </div>
                    )}
                    {tab === 'json' && (
                        <div className="voxscribe-transcript-text">
                            <a className="btn btn-sm btn-outline-secondary" href={`/api/transcriptions/${id}/transcript?format=json`} download>
                                Download raw JSON
                            </a>
                        </div>
                    )}
                </>
            )}

            <h2>Downloads</h2>
            <DownloadMenu id={id} done={detail.status === 'done'} />

            <h2>Danger zone</h2>
            <div className="voxscribe-actions-row">
                {detail.status === 'failed' && (
                    <tc-button variant="warning" outline loading={busy || undefined} onClick={retry}>
                        Retry
                    </tc-button>
                )}
                {detail.status !== 'processing' && (
                    <tc-button variant="danger" outline onClick={() => setConfirmDelete(true)}>
                        Delete transcription
                    </tc-button>
                )}
            </div>

            {confirmDelete && (
                <TypeToConfirmModal
                    title="Delete transcription"
                    prompt="This removes the audio, all transcript artifacts and the library entry. It cannot be undone."
                    expected={detail.title}
                    busy={busy}
                    onConfirm={doDelete}
                    onClose={() => setConfirmDelete(false)}
                />
            )}
        </div>
    )
}

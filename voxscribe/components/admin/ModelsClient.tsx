'use client'

// Admin → Models (spec §5.5, §9): catalog with disk state; Download streams the
// ggml blob from Hugging Face into the model dir (progress polled from
// GET /api/models while a download is in flight); delete unused models.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useToast } from '@/components/Toast'
import { LoadingState, ErrorState } from '@/components/states'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { humanBytes } from '@/server/domain/format'
import type { ModelInfo } from '@/server/domain/types'

interface ModelsResponse {
    models: ModelInfo[]
    defaultModel: string
}

const POLL_MS = 2_000

export function ModelsClient() {
    const toast = useToast()
    const [data, setData] = useState<ModelsResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [removing, setRemoving] = useState<string | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const load = useCallback(async () => {
        setError(null)
        try {
            const res = await apiFetch<ModelsResponse>('/api/models')
            setData(res)
            // Keep polling while any download is in flight (spec §9).
            if (timer.current) clearTimeout(timer.current)
            if (res.models.some((m) => m.downloading !== undefined)) {
                timer.current = setTimeout(() => void load(), POLL_MS)
            }
        } catch (err) {
            setError(describeApiError(err))
        }
    }, [])

    useEffect(() => {
        void load()
        return () => {
            if (timer.current) clearTimeout(timer.current)
        }
    }, [load])

    const download = useCallback(
        async (name: string) => {
            try {
                await apiFetch(`/api/models/${name}/download`, { method: 'POST' })
                toast.show(`Downloading ${name}…`, { variant: 'info' })
                void load()
            } catch (err) {
                toast.show(describeApiError(err), { variant: 'error' })
            }
        },
        [toast, load],
    )

    const doDelete = useCallback(async () => {
        if (!removing) return
        try {
            await apiFetch(`/api/models/${removing}`, { method: 'DELETE' })
            toast.show(`Deleted ${removing}`, { variant: 'success' })
        } catch (err) {
            toast.show(describeApiError(err), { variant: 'error' })
        } finally {
            setRemoving(null)
            void load()
        }
    }, [removing, toast, load])

    const rows = useMemo(() => data?.models ?? [], [data])

    if (error) return <ErrorState message={error} onRetry={load} />
    if (!data) return <LoadingState shape="rows" count={4} />

    return (
        <div className="voxscribe-page">
            <h1>Models</h1>
            <p className="voxscribe-muted">
                ggml blobs live in the workspace volume, not the image. <code>large</code> is not offered — it
                does not fit the RAM budget.
            </p>
            <div className="voxscribe-model-list">
                {rows.map((m) => (
                    <div className="voxscribe-card voxscribe-model-card" key={m.name}>
                        <div className="voxscribe-model-head">
                            <strong>{m.name}</strong>
                            {m.name === data.defaultModel && <tc-badge variant="info" text="default" />}
                            {!m.allowed && <tc-badge variant="secondary" text="not in allow-list" />}
                            {/* One JSX position, three shapes: drive the copy through the `text`
                                ATTRIBUTE (never children) and key each branch. tc-badge re-parents
                                its light-DOM children on connect, so letting React diff children
                                across branch flips throws removeChild NotFoundError the moment a
                                download completes (downloading → on disk). */}
                            {m.present ? (
                                <tc-badge key="present" variant="success" text={`on disk · ${humanBytes(m.diskBytes ?? 0)}`} />
                            ) : m.downloading !== undefined ? (
                                <tc-badge key="downloading" variant="info" text={`downloading ${m.downloading}%`} />
                            ) : (
                                <tc-badge key="absent" variant="secondary" text="absent" />
                            )}
                        </div>
                        <div className="voxscribe-muted">
                            download {humanBytes(m.sizeBytes)} · peak RAM {m.ramHint}
                        </div>
                        {m.downloading !== undefined && <tc-progress value={m.downloading} max={100} striped animated />}
                        <div className="voxscribe-actions-row">
                            {!m.present && m.downloading === undefined && (
                                <tc-button variant="primary" size="sm" onClick={() => download(m.name)}>
                                    Download
                                </tc-button>
                            )}
                            {m.present && (
                                <tc-button variant="danger" outline size="sm" onClick={() => setRemoving(m.name)}>
                                    Delete
                                </tc-button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <ConfirmDialog
                open={Boolean(removing)}
                title="Delete model"
                message={`Delete the ${removing} model blob? Jobs that request it will fail until it is re-downloaded.`}
                confirmLabel="Delete"
                danger
                onConfirm={doDelete}
                onCancel={() => setRemoving(null)}
            />
        </div>
    )
}

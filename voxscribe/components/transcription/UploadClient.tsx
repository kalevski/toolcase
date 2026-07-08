'use client'

// Upload page (spec §9 /new): drag-drop multi-file, per-file title/language/
// model/translate, submit → one POST per file (each an independent job). A 409
// duplicate offers "open existing / transcribe anyway" (re-submit with force).
// Option fields are appended BEFORE the file part — the API parses streaming
// and needs them first.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useToast } from '@/components/Toast'
import { TextField, SelectField, CheckField } from '@/components/fields'
import { ErrorState, LoadingState } from '@/components/states'
import { WHISPER_LANGUAGES, titleFromFilename, isAcceptedExtension, extensionOf, ACCEPTED_EXTENSIONS } from '@/server/domain/upload-validation'
import { humanBytes } from '@/server/domain/format'
import type { ModelInfo } from '@/server/domain/types'

interface ModelsResponse {
    models: ModelInfo[]
    available: string[]
    defaultModel: string
}

// While no model is offerable the page re-checks on an interval (and on tab
// focus), so it flips to the upload form by itself once an admin's download
// lands — no manual reload.
const NO_MODEL_POLL_MS = 3_000

interface FileEntry {
    file: File
    title: string
    language: string
    model: string
    translate: boolean
    status: 'ready' | 'uploading' | 'done' | 'error' | 'duplicate'
    message?: string
    duplicateOf?: string
    resultId?: string
}

const LANGUAGE_OPTIONS = WHISPER_LANGUAGES.map((code) => ({
    value: code,
    label: code === 'auto' ? 'Auto-detect' : code,
}))

export function UploadClient() {
    const router = useRouter()
    const toast = useToast()
    const [models, setModels] = useState<ModelsResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [entries, setEntries] = useState<FileEntry[]>([])
    const [busy, setBusy] = useState(false)
    const [dragOver, setDragOver] = useState(false)

    const loadModels = useCallback(async () => {
        setError(null)
        try {
            setModels(await apiFetch<ModelsResponse>('/api/models'))
        } catch (err) {
            setError(describeApiError(err))
        }
    }, [])

    useEffect(() => {
        void loadModels()
    }, [loadModels])

    // The one-shot fetch used to freeze this page on the "no model yet" banner
    // even after an admin finished a download. While nothing is offerable, poll
    // and re-check when the tab regains visibility.
    const noModels = models !== null && models.available.length === 0
    useEffect(() => {
        if (!noModels) return
        const timer = setInterval(() => void loadModels(), NO_MODEL_POLL_MS)
        const onVisible = () => {
            if (!document.hidden) void loadModels()
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            clearInterval(timer)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [noModels, loadModels])

    const defaultModel = useMemo(() => {
        if (!models) return ''
        return models.available.includes(models.defaultModel) ? models.defaultModel : (models.available[0] ?? '')
    }, [models])

    const addFiles = useCallback(
        (files: FileList | File[]) => {
            const next: FileEntry[] = []
            for (const file of Array.from(files)) {
                const ext = extensionOf(file.name)
                if (!ext || !isAcceptedExtension(ext)) {
                    toast.show(`${file.name}: unsupported file type`, { variant: 'warning' })
                    continue
                }
                next.push({
                    file,
                    title: titleFromFilename(file.name),
                    language: 'auto',
                    model: defaultModel,
                    translate: false,
                    status: 'ready',
                })
            }
            if (next.length) setEntries((prev) => [...prev, ...next])
        },
        [defaultModel, toast],
    )

    const patch = (index: number, changes: Partial<FileEntry>) => {
        setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...changes } : e)))
    }

    const uploadOne = useCallback(async (entry: FileEntry, index: number, force: boolean): Promise<FileEntry> => {
        // Options BEFORE the file: busboy consumes the parts in order and the
        // service starts streaming the file as soon as it appears.
        const form = new FormData()
        form.append('title', entry.title)
        form.append('language', entry.language)
        form.append('model', entry.model)
        form.append('translate', entry.translate ? 'true' : 'false')
        if (force) form.append('force', 'true')
        form.append('file', entry.file, entry.file.name)

        const res = await fetch('/api/transcriptions', { method: 'POST', body: form })
        const body = await res.json().catch(() => ({}))
        if (res.status === 201) return { ...entry, status: 'done', resultId: body.id }
        if (res.status === 409 && body.code === 'duplicate') {
            return { ...entry, status: 'duplicate', duplicateOf: body.duplicateOf, message: body.error }
        }
        return { ...entry, status: 'error', message: body.error ?? `upload failed (${res.status})` }
    }, [])

    const submit = useCallback(async () => {
        setBusy(true)
        let queued = 0
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i]
            if (entry.status !== 'ready' && entry.status !== 'error') continue
            patch(i, { status: 'uploading', message: undefined })
            const result = await uploadOne(entry, i, false)
            patch(i, result)
            if (result.status === 'done') queued++
        }
        setBusy(false)
        if (queued > 0) {
            toast.show(`${queued} file${queued > 1 ? 's' : ''} queued for transcription`, { variant: 'success' })
            // Stay on the page only if something needs attention (dup/error).
            setEntries((prev) => {
                const attention = prev.filter((e) => e.status === 'duplicate' || e.status === 'error')
                if (attention.length === 0) router.push('/transcriptions')
                return attention.length === 0 ? prev : attention
            })
        }
    }, [entries, uploadOne, toast, router])

    const transcribeAnyway = useCallback(
        async (index: number) => {
            const entry = entries[index]
            patch(index, { status: 'uploading', message: undefined })
            const result = await uploadOne(entry, index, true)
            patch(index, result)
            if (result.status === 'done') toast.show('Queued for transcription', { variant: 'success' })
        },
        [entries, uploadOne, toast],
    )

    if (error) return <ErrorState message={error} onRetry={loadModels} />
    if (!models) return <LoadingState shape="detail" />

    if (models.available.length === 0) {
        // Say what is actually wrong: a download in flight and an on-disk model
        // outside the allow-list are different problems from "nothing fetched
        // yet". Key each banner — tc-banner captures its children on connect, so
        // React must remount it (not diff children) when the state changes.
        const downloading = models.models.find((m) => m.downloading !== undefined)
        const presentButNotAllowed = models.models.some((m) => m.present && !m.allowed)
        return (
            <div className="voxscribe-page">
                <h1>New transcription</h1>
                {downloading ? (
                    <tc-banner key="downloading" variant="info">
                        The <strong>{downloading.name}</strong> model is downloading ({downloading.downloading}%). This
                        page updates by itself as soon as it is ready.
                    </tc-banner>
                ) : presentButNotAllowed ? (
                    <tc-banner key="not-allowed" variant="warning">
                        A model is on disk but not in the allow-list, so it can’t be offered here. An admin can add it
                        to <code>VOXSCRIBE_ALLOWED_MODELS</code> or fetch an allowed one under{' '}
                        <Link href="/admin/models">Admin → Models</Link>.
                    </tc-banner>
                ) : (
                    <tc-banner key="absent" variant="warning">
                        No whisper model is downloaded yet. An admin can fetch one under{' '}
                        <Link href="/admin/models">Admin → Models</Link>.
                    </tc-banner>
                )}
            </div>
        )
    }

    const modelOptions = models.available.map((m) => ({ value: m, label: m }))
    const uploadable = entries.some((e) => e.status === 'ready' || e.status === 'error')

    return (
        <div className="voxscribe-page">
            <h1>New transcription</h1>

            <div
                className={`voxscribe-dropzone${dragOver ? ' voxscribe-dropzone-over' : ''}`}
                onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    addFiles(e.dataTransfer.files)
                }}
            >
                <p>Drag audio or video files here, or</p>
                <label className="btn btn-primary">
                    Choose files
                    <input
                        type="file"
                        multiple
                        hidden
                        accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
                        onChange={(e) => {
                            if (e.target.files) addFiles(e.target.files)
                            e.target.value = ''
                        }}
                    />
                </label>
                <p className="voxscribe-muted">
                    {ACCEPTED_EXTENSIONS.join(', ')} — video is accepted, the audio track is extracted.
                </p>
            </div>

            {entries.map((entry, i) => (
                <div className="voxscribe-card voxscribe-upload-entry" key={`${entry.file.name}-${i}`}>
                    <div className="voxscribe-upload-entry-head">
                        <strong>{entry.file.name}</strong>
                        <span className="voxscribe-muted">{humanBytes(entry.file.size)}</span>
                        {entry.status === 'uploading' && <tc-spinner type="border" size="sm" />}
                        {entry.status === 'done' && <tc-badge variant="success" text="queued" />}
                        {entry.status === 'error' && <tc-badge variant="danger" text="failed" />}
                        {entry.status === 'duplicate' && <tc-badge variant="warning" text="duplicate" />}
                        {(entry.status === 'ready' || entry.status === 'error') && (
                            <tc-button
                                variant="secondary"
                                outline
                                size="sm"
                                onClick={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
                            >
                                Remove
                            </tc-button>
                        )}
                    </div>
                    {(entry.status === 'ready' || entry.status === 'error') && (
                        <div className="voxscribe-upload-entry-fields">
                            <TextField label="Title" value={entry.title} onValue={(v) => patch(i, { title: v })} />
                            <SelectField
                                label="Language"
                                value={entry.language}
                                options={LANGUAGE_OPTIONS}
                                onValue={(v) => patch(i, { language: v })}
                            />
                            <SelectField
                                label="Model"
                                value={entry.model}
                                options={modelOptions}
                                onValue={(v) => patch(i, { model: v })}
                            />
                            <CheckField
                                label="Translate to English"
                                checked={entry.translate}
                                onChecked={(v) => patch(i, { translate: v })}
                            />
                        </div>
                    )}
                    {entry.message && entry.status === 'error' && (
                        <tc-banner variant="error">{entry.message}</tc-banner>
                    )}
                    {entry.status === 'duplicate' && (
                        <tc-banner variant="warning">
                            You already transcribed this file.{' '}
                            <Link href={`/transcriptions/${entry.duplicateOf}`}>Open existing</Link>{' '}
                            <tc-button variant="warning" outline size="sm" onClick={() => transcribeAnyway(i)}>
                                Transcribe anyway
                            </tc-button>
                        </tc-banner>
                    )}
                    {entry.status === 'done' && entry.resultId && (
                        <p>
                            <Link href={`/transcriptions/${entry.resultId}`}>Open transcription</Link>
                        </p>
                    )}
                </div>
            ))}

            {entries.length > 0 && (
                <div className="voxscribe-actions-row">
                    <tc-button variant="primary" loading={busy || undefined} disabled={!uploadable || undefined} onClick={submit}>
                        Upload & queue
                    </tc-button>
                </div>
            )}
        </div>
    )
}

'use client'

// Note editor (spec §4.5, §9): create + view/edit. Title (tc-input), date
// (tc-date-picker, defaults today in the user's timezone — the server never
// guesses), tags (tc-tag-input with autocomplete from /api/tags + create-on-
// type), and content in a tc-markdown-editor (Write/Preview tabs + formatting
// toolbar; its internal preview renderer is escape-first, so admins can safely
// view other users' notes).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, describeApiError, ApiError } from '@/lib/fetcher'
import { useMe } from '@/lib/me-context'
import { useToast } from '@/components/Toast'
import { TextField, DateField, TagsField, MarkdownField } from '@/components/fields'
import { LoadingState, ErrorState } from '@/components/states'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { validateNote, normalizeTag, TAG_PATTERN, NOTE_MAX_TAGS } from '@/server/domain/note-validation'
import type { NoteDetail, TagCount } from '@/server/domain/types'

function todayLocal(): string {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function NoteEditorClient({ id }: { id?: string }) {
    const router = useRouter()
    const toast = useToast()
    const me = useMe()
    const isNew = !id

    const [loaded, setLoaded] = useState(isNew)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [notFound, setNotFound] = useState(false)
    const [ownerLogin, setOwnerLogin] = useState<string | undefined>(undefined)

    const [title, setTitle] = useState('')
    const [date, setDate] = useState(todayLocal())
    const [tags, setTags] = useState<string[]>([])
    const [content, setContent] = useState('')
    const [suggestions, setSuggestions] = useState<TagCount[]>([])
    const [busy, setBusy] = useState(false)
    const [fieldError, setFieldError] = useState<string | null>(null)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const load = useCallback(async () => {
        setLoadError(null)
        try {
            const [tagList, note] = await Promise.all([
                apiFetch<{ tags: TagCount[] }>('/api/tags'),
                id ? apiFetch<NoteDetail>(`/api/notes/${id}`) : Promise.resolve(null),
            ])
            setSuggestions(tagList.tags)
            if (note) {
                setTitle(note.title)
                setDate(note.noteDate)
                setTags(note.tags)
                setContent(note.content)
                setOwnerLogin(note.ownerLogin)
            }
            setLoaded(true)
        } catch (err) {
            if (err instanceof ApiError && err.kind === 'notfound') setNotFound(true)
            else setLoadError(describeApiError(err))
        }
    }, [id])

    useEffect(() => {
        void load()
    }, [load])

    // tc-tag-input is controlled: normalize every committed tag with the SAME
    // rule the API enforces (so 'Team X' lands as the chip 'team-x'), drop
    // anything that doesn't survive normalization, and dedupe + sort.
    const onTags = useCallback((raw: string[]) => {
        const next: string[] = []
        for (const t of raw) {
            const tag = normalizeTag(t)
            if (TAG_PATTERN.test(tag) && !next.includes(tag)) next.push(tag)
        }
        setTags(next.sort())
    }, [])

    const tagRecommendations = useMemo(() => suggestions.map((s) => s.name), [suggestions])

    const save = useCallback(async () => {
        // Client-side pass with the SAME validator the API enforces (spec §6.3).
        const valid = validateNote({ title, date, tags, content })
        if (!valid.ok) {
            setFieldError(valid.error.message)
            return
        }
        setFieldError(null)
        setBusy(true)
        try {
            if (isNew) {
                const { id: newId } = await apiFetch<{ id: string }>('/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, date, tags, content }),
                })
                toast.show('Note created', { variant: 'success' })
                router.push(`/notes/${newId}`)
            } else {
                await apiFetch(`/api/notes/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, date, tags, content }),
                })
                toast.show('Note saved', { variant: 'success' })
            }
        } catch (err) {
            toast.show(describeApiError(err), { variant: 'error' })
        } finally {
            setBusy(false)
        }
    }, [isNew, id, title, date, tags, content, toast, router])

    const doDelete = useCallback(async () => {
        if (!id) return
        setBusy(true)
        try {
            await apiFetch(`/api/notes/${id}`, { method: 'DELETE' })
            toast.show('Note deleted', { variant: 'success' })
            router.push('/notes')
        } catch (err) {
            toast.show(describeApiError(err), { variant: 'error' })
            setBusy(false)
        }
    }, [id, toast, router])

    if (notFound) return <ErrorState title="Not found" message="This note doesn’t exist or isn’t yours." />
    if (loadError) return <ErrorState message={loadError} onRetry={load} />
    if (!loaded) return <LoadingState shape="detail" />

    return (
        <div className="voxscribe-page">
            <div className="voxscribe-page-head">
                <h1>{isNew ? 'New note' : 'Edit note'}</h1>
                {!isNew && (
                    <a className="btn btn-sm btn-outline-secondary" href={`/api/notes/${id}/download`} download>
                        Download .md
                    </a>
                )}
            </div>
            {me.role === 'admin' && ownerLogin && ownerLogin !== me.login && (
                <tc-banner variant="info">Owned by @{ownerLogin}</tc-banner>
            )}

            <div className="voxscribe-note-form">
                <div className="voxscribe-note-meta">
                    <TextField label="Title" value={title} onValue={setTitle} placeholder="e.g. Daily standup" required />
                    <DateField label="Date" value={date} onValue={setDate} />
                </div>
                <TagsField
                    label="Tags"
                    tags={tags}
                    onTags={onTags}
                    recommendations={tagRecommendations}
                    maxTags={NOTE_MAX_TAGS}
                    placeholder="Add tags (e.g. standup, team-x)…"
                    disabled={busy}
                />
                <MarkdownField
                    label="Content"
                    value={content}
                    onValue={setContent}
                    height={420}
                    placeholder={'# Notes\n\n- what happened\n- decisions\n- follow-ups'}
                    disabled={busy}
                />

                {fieldError && <tc-banner variant="error">{fieldError}</tc-banner>}

                <div className="voxscribe-actions-row">
                    <tc-button variant="primary" loading={busy || undefined} onClick={save}>
                        {isNew ? 'Create note' : 'Save changes'}
                    </tc-button>
                    <tc-button variant="secondary" outline disabled={busy || undefined} onClick={() => router.push('/notes')}>
                        Back to notes
                    </tc-button>
                    {!isNew && (
                        <tc-button variant="danger" outline disabled={busy || undefined} onClick={() => setConfirmDelete(true)}>
                            Delete
                        </tc-button>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={confirmDelete}
                title="Delete note"
                message={`Delete “${title}” (${date})? This cannot be undone.`}
                confirmLabel="Delete"
                danger
                onConfirm={doDelete}
                onCancel={() => setConfirmDelete(false)}
            />
        </div>
    )
}

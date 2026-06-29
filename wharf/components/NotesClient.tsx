'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, describeApiError, isAuthError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'
import type { NoteMeta, ProjectDetail } from '@/server/domain/types'

export function NotesClient({ projectId }: { projectId: string }) {
    const router = useRouter()
    const [detail, setDetail] = useState<ProjectDetail | null>(null)
    const [notes, setNotes] = useState<NoteMeta[] | null>(null)
    const [err, setErr] = useState<string | null>(null)

    // Create form.
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const titleRef = useRef(title)
    titleRef.current = title
    const contentRef = useRef(content)
    contentRef.current = content

    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const d = await apiFetch<ProjectDetail>(`/api/projects/${projectId}`, { signal })
                const n = await apiFetch<NoteMeta[]>(`/api/projects/${projectId}/notes`, { signal })
                if (signal?.aborted) return
                setDetail(d)
                setNotes(n)
            } catch (e) {
                if (signal?.aborted) return
                setErr(isAuthError(e) ? 'You don’t have access to this project.' : describeApiError(e))
            }
        },
        [projectId],
    )

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    // developer+ may read/create/edit/delete notes; access alone implies the right.
    const canEdit = detail !== null

    const create = async () => {
        const t = titleRef.current.trim()
        if (!t) return
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/notes`, {
                method: 'POST',
                body: JSON.stringify({ title: t, content: contentRef.current }),
            })
            setTitle('')
            setContent('')
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const titleTc = useTc<HTMLElement>(
        useMemo(() => ({ value: title }), [title]),
        { 'tc-change': (e: Event) => setTitle(detailValue<string>(e) ?? '') },
    )

    if (err && !detail) return <tc-banner variant="error">{err}</tc-banner>
    if (!detail || notes === null) {
        return (
            <div className="wharf-status-line">
                <tc-spinner type="border" size="sm" /> Loading…
            </div>
        )
    }

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="StickyNote"
                icon-color="violet"
                title-text="Notes"
                sub="Sensitive free-form data — masked, revealable"
                description="Free-form sensitive notes for this project. Content is encrypted at rest and masked by default — reveal is audited."
            >
                <tc-button
                    slot="actions"
                    variant="secondary"
                    outline
                    size="sm"
                    onClick={() => router.push(`/projects/${projectId}`)}
                >
                    ← Project
                </tc-button>
            </tc-rich-page-header>


            {err && <tc-banner variant="error">{err}</tc-banner>}

            {canEdit && (
                <tc-section-card title="New note" icon="StickyNote">
                    <div className="wharf-section-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <tc-input ref={titleTc} label="Title" placeholder="e.g. Production DB credentials" />
                            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Content</span>
                                <textarea
                                    className="form-control"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    rows={4}
                                    placeholder="Sensitive free-form text…"
                                    style={{ font: 'inherit', padding: '0.5rem', resize: 'vertical' }}
                                />
                            </label>
                            <div>
                                <tc-button variant="primary" onClick={create} disabled={!title.trim()}>
                                    Add note
                                </tc-button>
                            </div>
                        </div>
                    </div>
                </tc-section-card>
            )}

            {notes.length === 0 ? (
                <tc-empty-state icon="StickyNote">
                    <h2>No notes</h2>
                    <p>{canEdit ? 'Add a note above to store sensitive free-form data.' : 'No notes yet.'}</p>
                </tc-empty-state>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {notes.map((note) => (
                        <NoteCard
                            key={note.id}
                            projectId={projectId}
                            note={note}
                            canEdit={canEdit}
                            onChanged={load}
                            onError={setErr}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function NoteCard({
    projectId,
    note,
    canEdit,
    onChanged,
    onError,
}: {
    projectId: string
    note: NoteMeta
    canEdit: boolean
    onChanged: () => Promise<void>
    onError: (msg: string | null) => void
}) {
    const [revealed, setRevealed] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editTitle, setEditTitle] = useState(note.title)
    const [editContent, setEditContent] = useState('')
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const editTitleRef = useRef(editTitle)
    editTitleRef.current = editTitle
    const editContentRef = useRef(editContent)
    editContentRef.current = editContent

    const reveal = async () => {
        setBusy(true)
        onError(null)
        try {
            const { content } = await apiFetch<{ content: string }>(
                `/api/projects/${projectId}/notes/${note.id}/reveal`,
            )
            setRevealed(content)
        } catch (e) {
            onError(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const startEdit = async () => {
        // Editing needs the current plaintext; fetch (and audit) the reveal.
        setBusy(true)
        onError(null)
        try {
            const { content } = await apiFetch<{ content: string }>(
                `/api/projects/${projectId}/notes/${note.id}/reveal`,
            )
            setEditTitle(note.title)
            setEditContent(content)
            setEditing(true)
        } catch (e) {
            onError(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const saveEdit = async () => {
        const t = editTitleRef.current.trim()
        if (!t) return
        setBusy(true)
        onError(null)
        try {
            await apiFetch(`/api/projects/${projectId}/notes/${note.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ title: t, content: editContentRef.current }),
            })
            setEditing(false)
            setRevealed(null)
            await onChanged()
        } catch (e) {
            onError(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const remove = async () => {
        setBusy(true)
        onError(null)
        try {
            await apiFetch(`/api/projects/${projectId}/notes/${note.id}`, { method: 'DELETE' })
            await onChanged()
        } catch (e) {
            onError(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const editTitleTc = useTc<HTMLElement>(
        useMemo(() => ({ value: editTitle }), [editTitle]),
        { 'tc-change': (e: Event) => setEditTitle(detailValue<string>(e) ?? '') },
    )

    const confirmTc = useTc<HTMLElement>(
        useMemo(() => ({ open: confirmingDelete }), [confirmingDelete]),
        {
            'tc-confirm': () => {
                setConfirmingDelete(false)
                void remove()
            },
            'tc-cancel': () => setConfirmingDelete(false),
        },
    )

    const updatedLabel = `updated ${new Date(note.updatedAt).toLocaleString()}`

    return (
        <tc-section-card title={note.title} icon="StickyNote">
            <span slot="action" style={{ fontSize: '0.75rem', color: 'var(--tc-text-faint)' }}>
                {updatedLabel}
            </span>
            <div className="wharf-section-body">
                {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <tc-input ref={editTitleTc} label="Title" />
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Content</span>
                            <textarea
                                className="form-control"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                rows={4}
                                style={{ font: 'inherit', padding: '0.5rem', resize: 'vertical' }}
                            />
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <tc-button size="sm" variant="primary" onClick={saveEdit} disabled={busy || !editTitle.trim()}>
                                Save
                            </tc-button>
                            <tc-button
                                size="sm"
                                variant="secondary"
                                outline
                                onClick={() => setEditing(false)}
                                disabled={busy}
                            >
                                Cancel
                            </tc-button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div>
                            {revealed === null ? (
                                <code className="wharf-mono" style={{ color: 'var(--tc-text-faint)' }}>
                                    ••••••••••••
                                </code>
                            ) : (
                                <pre className="wharf-pre" style={{ margin: 0 }}>
                                    {revealed}
                                </pre>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                            {revealed === null ? (
                                <tc-button size="sm" variant="secondary" outline onClick={reveal} disabled={busy}>
                                    Reveal
                                </tc-button>
                            ) : (
                                <tc-button
                                    size="sm"
                                    variant="secondary"
                                    outline
                                    onClick={() => setRevealed(null)}
                                    disabled={busy}
                                >
                                    Hide
                                </tc-button>
                            )}
                            {canEdit && (
                                <>
                                    <tc-button size="sm" variant="secondary" outline onClick={startEdit} disabled={busy}>
                                        Edit
                                    </tc-button>
                                    <tc-button
                                        size="sm"
                                        variant="danger"
                                        outline
                                        onClick={() => setConfirmingDelete(true)}
                                        disabled={busy}
                                    >
                                        Delete
                                    </tc-button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            <tc-confirm-dialog
                ref={confirmTc}
                eyebrow="Delete note"
                dialog-title="Delete this note?"
                message={`“${note.title}” will be permanently removed. This cannot be undone.`}
                confirm-label="Delete"
                cancel-label="Cancel"
                danger
            />
        </tc-section-card>
    )
}

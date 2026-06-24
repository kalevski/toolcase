'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import { useTc, useTcEvents, detailValue } from '@/lib/tc'
import type { NoteDoc } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { useConfirm, usePrompt } from '../ConfirmModal'
import { helpTexts } from '../helpTexts'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

// tc-advanced-table header descriptors; rows stay slotted React <tr> so the
// per-row Delete button and row-open navigation keep their handlers.
const ADV_COLUMNS = [
    { key: 'id', label: 'File', width: '30%' },
    { key: 'title', label: 'Title' },
    { key: 'updated', label: 'Updated', width: '9rem' },
    { key: 'actions', label: '', width: '7rem' },
]

function relativeTime(iso: string): string {
    const delta = Date.now() - new Date(iso).getTime()
    if (!Number.isFinite(delta) || delta < 0) return 'just now'
    const minutes = Math.floor(delta / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

type Col = { key: string; header: string; width?: string; render: (n: NoteDoc) => React.ReactNode }

export function NotesClient() {
    const { project, notes, agentSessions, refreshNotes } = useProject()
    const confirm = useConfirm()
    const prompt = usePrompt()

    // editor state: which note is open + its loaded/edited content
    const [openId, setOpenId] = useState<string | null>(null)
    const [loaded, setLoaded] = useState<{ id: string; content: string } | null>(null)
    const [editor, setEditor] = useState('')
    const [saving, setSaving] = useState(false)

    const editorRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setEditor(detailValue<string>(e)) })

    const noteAgentRunning = agentSessions['note-writer']?.status === 'running'
    const dirtyEditor = loaded !== null && editor !== loaded.content

    // The id of the note whose content we currently want loaded. Lets a slow
    // fetch bail if a newer openNote()/reload superseded it (avoids showing one
    // note's body under another's title on rapid switches).
    const targetRef = useRef<string | null>(null)

    const loadNote = useCallback(
        async (id: string) => {
            targetRef.current = id
            const d = await fetch(`/api/projects/${project}/notes/${id}`).then((r) =>
                r.ok ? r.json() : Promise.reject(),
            )
            if (targetRef.current !== id) return // superseded by a newer selection
            setLoaded({ id, content: d.content })
            setEditor(d.content)
        },
        [project],
    )

    const openNote = async (id: string) => {
        if (id === openId) return
        if (dirtyEditor) {
            const ok = await confirm({
                title: 'Discard unsaved changes?',
                body: `${openId} has unsaved edits. Switching notes discards them.`,
                confirmLabel: 'Discard & switch',
                confirmVariant: 'warning',
            })
            if (!ok) return
        }
        setOpenId(id)
        setLoaded(null)
        setEditor('')
        try {
            await loadNote(id)
        } catch {
            toast.error('Failed to load note.')
            setOpenId(null)
        }
    }

    // C3 — deep link from the search palette (?open=<id>)
    const searchParams = useSearchParams()
    useEffect(() => {
        const open = searchParams.get('open')
        if (open && notes.some((n) => n.id === open)) void openNote(open)
        // eslint-disable-next-line
    }, [searchParams])

    // While the notes agent runs it may rewrite the open note; when it finishes
    // (list refresh fires), re-pull the open note's content from disk.
    useEffect(() => {
        if (!openId || noteAgentRunning) return
        if (!notes.some((n) => n.id === openId)) {
            // the agent (or another tab) deleted it
            setOpenId(null)
            setLoaded(null)
            return
        }
        if (!dirtyEditor) {
            void loadNote(openId).catch(() => toast.error('Failed to refresh note content.'))
        }
        // eslint-disable-next-line
    }, [notes, noteAgentRunning])

    const onNew = async () => {
        const slug = await prompt({
            title: 'New note',
            label: 'Filename (kebab-case, .md is appended)',
            placeholder: 'deploy-checklist',
        })
        if (!slug) return
        if (!SLUG_RE.test(slug)) {
            toast.error('Use lowercase letters, digits and dashes (start with a letter or digit).')
            return
        }
        const id = `${slug}.md`
        if (notes.some((n) => n.id === id)) {
            toast.error(`${id} already exists.`)
            return
        }
        const res = await fetch(`/api/projects/${project}/notes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `# ${slug}\n\n` }),
        })
        if (!res.ok) {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to create note')
            return
        }
        await refreshNotes()
        setOpenId(id)
        setLoaded({ id, content: `# ${slug}\n\n` })
        setEditor(`# ${slug}\n\n`)
    }

    const onSave = async () => {
        if (!openId) return
        setSaving(true)
        try {
            const res = await fetch(`/api/projects/${project}/notes/${openId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editor }),
            })
            if (res.status === 409) {
                toast.error(helpTexts.notes.agentRunning)
                return
            }
            if (!res.ok) {
                toast.error('Failed to save note.')
                return
            }
            setLoaded({ id: openId, content: editor })
            toast.success('Note saved')
            void refreshNotes()
        } finally {
            setSaving(false)
        }
    }

    const onDelete = async (id: string) => {
        const ok = await confirm({
            title: `Delete ${id}?`,
            body: 'The note file is removed permanently.',
            confirmLabel: 'Delete note',
            confirmVariant: 'danger',
        })
        if (!ok) return
        const res = await fetch(`/api/projects/${project}/notes/${id}`, { method: 'DELETE' })
        if (res.status === 409) {
            toast.error(helpTexts.notes.agentRunning)
            return
        }
        if (!res.ok) {
            toast.error('Failed to delete note.')
            return
        }
        if (openId === id) {
            setOpenId(null)
            setLoaded(null)
        }
        toast.success(`Deleted ${id}`)
        void refreshNotes()
    }

    const columns: Col[] = [
        { key: 'id', header: 'File', width: '30%', render: (n) => <code>notes/{n.id}</code> },
        { key: 'title', header: 'Title', render: (n) => n.title },
        { key: 'updated', header: 'Updated', width: '9rem', render: (n) => <tc-text variant="muted">{relativeTime(n.updatedAt)}</tc-text> },
        {
            key: 'actions',
            header: '',
            width: '7rem',
            render: (n) => (
                <tc-button
                    size="sm"
                    variant="danger"
                    outline
                    disabled={noteAgentRunning || undefined}
                    onClick={(e) => {
                        e.stopPropagation()
                        void onDelete(n.id)
                    }}
                >
                    Delete
                </tc-button>
            ),
        },
    ]

    const tableKey = notes.map((n) => n.id).join('_')
    const tableRef = useTc<HTMLElement>({ columns: ADV_COLUMNS })

    return (
        <tc-stack gap="1.25rem">
            <tc-card>
                <div slot="header" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <tc-heading as="h3">Notes</tc-heading>
                    <tc-button size="sm" variant="primary" style={{ marginLeft: 'auto' }} onClick={() => void onNew()}>
                        <tc-icon name="Plus" /> New note
                    </tc-button>
                </div>
                <tc-advanced-table key={tableKey} ref={tableRef}>
                    {notes.length === 0 && (
                        <tr>
                            <td colSpan={4} style={{ textAlign: 'center', opacity: 0.6 }}>
                                No notes yet — create one, or let the notes agent (Agents page) write one.
                            </td>
                        </tr>
                    )}
                    {notes.map((n) => (
                        <tr
                            key={n.id}
                            style={{ cursor: 'pointer' }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Open notes/${n.id}`}
                            onClick={() => void openNote(n.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    void openNote(n.id)
                                }
                            }}
                        >
                            {columns.map((c) => (
                                <td key={c.key}>{c.render(n)}</td>
                            ))}
                        </tr>
                    ))}
                </tc-advanced-table>
                <div className="tf-card-body">
                    <tc-helper-text text={helpTexts.notes.storage} />
                </div>
            </tc-card>

            {openId && (
                <tc-card>
                    <tc-heading slot="header" as="h3">
                        Edit — {openId}
                    </tc-heading>
                    <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                        {noteAgentRunning && <tc-helper-text variant="warning" text={helpTexts.notes.agentRunning} />}
                        {loaded === null ? (
                            <tc-text variant="muted">Loading…</tc-text>
                        ) : (
                            <tc-markdown-editor ref={editorRef} value={editor} height="420" disabled={noteAgentRunning || undefined} />
                        )}
                        <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                            <tc-button
                                variant="primary"
                                loading={saving || undefined}
                                disabled={noteAgentRunning || !dirtyEditor || undefined}
                                onClick={() => void onSave()}
                            >
                                Save
                            </tc-button>
                            <tc-button
                                variant="secondary"
                                outline
                                disabled={!dirtyEditor || undefined}
                                onClick={() => loaded && setEditor(loaded.content)}
                            >
                                Discard local changes
                            </tc-button>
                        </tc-stack>
                    </tc-stack>
                </tc-card>
            )}
        </tc-stack>
    )
}

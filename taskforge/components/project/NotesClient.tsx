'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    Card,
    Heading,
    Text,
    Table,
    Button,
    MarkdownEditor,
    HelperText,
    toast,
    type TableColumn,
} from '@/components/ui'
import type { NoteDoc } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { useConfirm, usePrompt } from '../ConfirmModal'
import { helpTexts } from '../helpTexts'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

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

export function NotesClient() {
    const { project, notes, agentSessions, refreshNotes } = useProject()
    const confirm = useConfirm()
    const prompt = usePrompt()

    // editor state: which note is open + its loaded/edited content
    const [openId, setOpenId] = useState<string | null>(null)
    const [loaded, setLoaded] = useState<{ id: string; content: string } | null>(null)
    const [editor, setEditor] = useState('')
    const [saving, setSaving] = useState(false)

    const noteAgentRunning = agentSessions['note-writer'].status === 'running'
    const dirtyEditor = loaded !== null && editor !== loaded.content

    const loadNote = useCallback(
        async (id: string) => {
            const d = await fetch(`/api/projects/${project}/notes/${id}`).then((r) =>
                r.ok ? r.json() : Promise.reject(),
            )
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
            void loadNote(openId).catch(() => {})
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

    const columns: TableColumn<NoteDoc>[] = [
        { key: 'id', header: 'File', width: '30%', render: (n) => <code>notes/{n.id}</code> },
        { key: 'title', header: 'Title', render: (n) => n.title },
        { key: 'updated', header: 'Updated', width: '9rem', render: (n) => <Text variant="muted">{relativeTime(n.updatedAt)}</Text> },
        {
            key: 'actions',
            header: '',
            width: '7rem',
            render: (n) => (
                <Button
                    size="small"
                    variant="danger"
                    outline
                    disabled={noteAgentRunning}
                    onClick={(e) => {
                        e.stopPropagation()
                        void onDelete(n.id)
                    }}
                >
                    Delete
                </Button>
            ),
        },
    ]

    return (
        <div className="tf-stack">
            <Card
                header={
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Heading as="h3">Notes</Heading>
                        <Button size="small" variant="primary" style={{ marginLeft: 'auto' }} onClick={() => void onNew()} startIcon={<span>＋</span>}>
                            New note
                        </Button>
                    </div>
                }
            >
                <Table
                    columns={columns}
                    data={notes}
                    rowKey={(n) => n.id}
                    hoverable
                    emptyMessage="No notes yet — create one, or let the notes agent (Agents page) write one."
                    onRowClick={(n) => void openNote(n.id)}
                />
                <div className="tf-card-body">
                    <HelperText text={helpTexts.notes.storage} />
                </div>
            </Card>

            {openId && (
                <Card header={<Heading as="h3">Edit — {openId}</Heading>}>
                    <div className="tf-card-body tf-stack-sm">
                        {noteAgentRunning && <HelperText variant="warning" text={helpTexts.notes.agentRunning} />}
                        {loaded === null ? (
                            <Text variant="muted">Loading…</Text>
                        ) : (
                            <MarkdownEditor
                                value={editor}
                                onChange={setEditor}
                                height={420}
                                disabled={noteAgentRunning}
                            />
                        )}
                        <div className="tf-actions">
                            <Button
                                variant="primary"
                                loading={saving}
                                disabled={noteAgentRunning || !dirtyEditor}
                                onClick={() => void onSave()}
                            >
                                Save
                            </Button>
                            <Button
                                variant="secondary"
                                outline
                                disabled={!dirtyEditor}
                                onClick={() => loaded && setEditor(loaded.content)}
                            >
                                Discard local changes
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}

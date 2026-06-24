'use client'

// C2 — knowledge docs at parity with notes: readable AND editable (Edit toggle,
// MarkdownEditor, save rebuilds the index). The app-owned index stays read-only.

import React, { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { useTc, useTcEvents, detailValue } from '@/lib/tc'
import { useProject } from '../ProjectContext'
import { helpTexts } from '../helpTexts'

export function KnowledgeDrawer({ project, docId, onClose }: { project: string; docId: string | null; onClose: () => void }) {
    const { busy, setKnowledge } = useProject()
    // Result is stamped with the doc it belongs to, so `content` derives its own
    // staleness: when `docId` changes, content falls back to null (and an in-flight
    // response can never render under the wrong doc) — no prop-change reset effect.
    const [result, setResult] = useState<{ id: string; content: string } | null>(null)
    const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null)
    const [saving, setSaving] = useState(false)
    const content = result?.id === docId ? result.content : null
    const loading = docId !== null && content === null
    const editDraft = editing?.id === docId ? editing.draft : null
    const isIndex = docId?.toLowerCase() === 'index.md'

    // Drive the drawer open state via property; route its close affordances back.
    const drawerRef = useTc<HTMLElement>({ open: docId !== null }, { 'tc-close': () => onClose() })
    const editorRef = useTcEvents<HTMLElement>({
        'tc-change': (e) => docId && setEditing({ id: docId, draft: detailValue<string>(e) }),
    })

    useEffect(() => {
        if (!docId) return
        let cancelled = false
        fetch(`/api/projects/${project}/knowledge/${docId}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => {
                if (!cancelled) setResult({ id: docId, content: d.content })
            })
            .catch(() => {
                if (!cancelled) setResult({ id: docId, content: 'Failed to load document.' })
            })
        return () => {
            cancelled = true
        }
    }, [project, docId])

    const onSave = async () => {
        if (!docId || editDraft === null) return
        setSaving(true)
        try {
            const res = await fetch(`/api/projects/${project}/knowledge/${docId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editDraft }),
            })
            if (res.status === 409) {
                toast.error(helpTexts.knowledge.busy)
                return
            }
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to save doc')
                return
            }
            const data = await res.json()
            setResult({ id: docId, content: editDraft })
            setEditing(null)
            setKnowledge(data.docs)
            toast.success('Knowledge doc saved — index rebuilt')
        } finally {
            setSaving(false)
        }
    }

    return (
        <tc-drawer ref={drawerRef} side="right" size="large" title={docId ?? ''}>
            <div style={{ padding: '1.25rem' }}>
                <tc-stack direction="horizontal" gap="0.75rem" wrap align="center" style={{ marginBottom: '0.75rem' }}>
                    <tc-badge variant="secondary">knowledge/{docId}</tc-badge>
                    {docId && !isIndex && editDraft === null && (
                        <tc-button
                            size="sm"
                            variant="secondary"
                            outline
                            style={{ marginLeft: 'auto' }}
                            disabled={busy || content === null || undefined}
                            title={helpTexts.knowledge.edit}
                            onClick={() => content !== null && setEditing({ id: docId, draft: content })}
                        >
                            <tc-icon name="Pencil" /> Edit
                        </tc-button>
                    )}
                </tc-stack>
                {loading && (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <tc-spinner />
                    </div>
                )}
                {editDraft !== null && docId ? (
                    <tc-stack gap="0.75rem">
                        <tc-helper-text text={helpTexts.knowledge.edit} />
                        <tc-markdown-editor ref={editorRef} value={editDraft} height="440" />
                        <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                            <tc-button variant="primary" loading={saving || undefined} disabled={saving || undefined} onClick={() => void onSave()}>
                                Save
                            </tc-button>
                            <tc-button variant="secondary" outline onClick={() => setEditing(null)}>
                                Cancel
                            </tc-button>
                        </tc-stack>
                    </tc-stack>
                ) : (
                    content !== null && (
                        <pre
                            style={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '0.85rem',
                                marginTop: '1rem',
                            }}
                        >
                            {content}
                        </pre>
                    )
                )}
            </div>
        </tc-drawer>
    )
}

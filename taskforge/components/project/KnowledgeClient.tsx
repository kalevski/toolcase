'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import { useTc } from '@/lib/tc'
import type { KnowledgeDoc } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { usePrompt } from '../ConfirmModal'
import { KnowledgeDrawer } from './KnowledgeDrawer'
import { helpTexts } from '../helpTexts'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

type Col = { key: string; header: string; width?: string; render: (d: KnowledgeDoc) => React.ReactNode }

// tc-advanced-table header descriptors; rows are slotted React <tr> so the
// per-row Remove button and row-open navigation keep their handlers.
const ADV_COLUMNS = [
    { key: 'id', label: 'File', width: '26%' },
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'About' },
    { key: 'actions', label: '', width: '7rem' },
]

export function KnowledgeClient() {
    const { project, knowledge, busy, onRemoveKnowledge, setKnowledge } = useProject()
    const prompt = usePrompt()
    const searchParams = useSearchParams()
    const [openDoc, setOpenDoc] = useState<string | null>(null)

    // C3 — deep link from the search palette (?open=<id>)
    useEffect(() => {
        const open = searchParams.get('open')
        if (open && knowledge.some((d) => d.id === open)) setOpenDoc(open)
    }, [searchParams, knowledge])

    // C2 — manual doc creation
    const onNewDoc = async () => {
        const slug = await prompt({
            title: 'New knowledge doc',
            label: 'Filename (kebab-case, .md is appended)',
            placeholder: 'auth-flow',
        })
        if (!slug) return
        if (!SLUG_RE.test(slug)) {
            toast.error('Use lowercase letters, digits and dashes.')
            return
        }
        const res = await fetch(`/api/projects/${project}/knowledge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, content: `# ${slug}\n\nOne-sentence summary goes here.\n\n` }),
        })
        if (!res.ok) {
            toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to create doc')
            return
        }
        const data = await res.json()
        setKnowledge(data.docs)
        setOpenDoc(data.id)
        toast.success(`Created knowledge/${data.id}`)
    }

    const columns: Col[] = [
        { key: 'id', header: 'File', width: '26%', render: (d) => <code>knowledge/{d.id}</code> },
        { key: 'title', header: 'Title', render: (d) => d.title },
        {
            key: 'description',
            header: 'About',
            render: (d) =>
                d.isIndex ? <tc-tag static variant="info">index</tc-tag> : <tc-text variant="muted">{d.description || '—'}</tc-text>,
        },
        {
            key: 'actions',
            header: '',
            width: '7rem',
            render: (d) =>
                d.isIndex ? null : (
                    <tc-button
                        size="sm"
                        variant="danger"
                        outline
                        aria-label={`Remove ${d.id}`}
                        disabled={busy || undefined}
                        onClick={(e) => {
                            e.stopPropagation()
                            void onRemoveKnowledge(d.id)
                        }}
                    >
                        Remove
                    </tc-button>
                ),
        },
    ]

    const tableKey = knowledge.map((d) => d.id).join('_')
    const tableRef = useTc<HTMLElement>({ columns: ADV_COLUMNS })

    return (
        <tc-stack gap="1.25rem">
            <tc-card>
                <div slot="header" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <tc-heading as="h3">Knowledge base</tc-heading>
                    <tc-button
                        size="sm"
                        variant="primary"
                        style={{ marginLeft: 'auto' }}
                        disabled={busy || undefined}
                        title={helpTexts.knowledge.newDoc}
                        onClick={() => void onNewDoc()}
                    >
                        <tc-icon name="Plus" /> New doc
                    </tc-button>
                </div>
                <tc-advanced-table key={tableKey} ref={tableRef}>
                    {knowledge.length === 0 && (
                        <tr>
                            <td colSpan={4} style={{ textAlign: 'center', opacity: 0.6 }}>
                                No knowledge yet — use the knowledge analyzer on the Agents page, or create a doc by hand.
                            </td>
                        </tr>
                    )}
                    {knowledge.map((d) => (
                        <tr
                            key={d.id}
                            style={{ cursor: 'pointer' }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Open knowledge/${d.id}`}
                            onClick={() => setOpenDoc(d.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setOpenDoc(d.id)
                                }
                            }}
                        >
                            {columns.map((c) => (
                                <td key={c.key}>{c.render(d)}</td>
                            ))}
                        </tr>
                    ))}
                </tc-advanced-table>
            </tc-card>

            {knowledge.length > 0 && (
                <tc-text variant="muted">
                    Stored at the project root under <code>knowledge/</code> (alongside <code>repo/</code>). Click a row
                    to read a doc; <code>index.md</code> is rebuilt automatically.{' '}
                    <tc-badge variant="secondary">{knowledge.length} file(s)</tc-badge>
                </tc-text>
            )}

            <KnowledgeDrawer project={project} docId={openDoc} onClose={() => setOpenDoc(null)} />
        </tc-stack>
    )
}

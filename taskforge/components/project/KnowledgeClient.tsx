'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import type { KnowledgeDoc } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { usePrompt } from '../ConfirmModal'
import { KnowledgeDrawer } from './KnowledgeDrawer'
import { helpTexts } from '../helpTexts'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

type Col = { key: string; header: string; width?: string; render: (d: KnowledgeDoc) => React.ReactNode }

export function KnowledgeClient() {
    const { project, knowledge, busy, onRemoveKnowledge, setKnowledge } = useProject()
    const prompt = usePrompt()
    const searchParams = useSearchParams()
    const [openDoc, setOpenDoc] = useState<string | null>(null)

    // C3 — deep link from the search palette (?open=<id>)
    useEffect(() => {
        const open = searchParams.get('open')
        if (open) setOpenDoc(open)
    }, [searchParams])

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

    return (
        <div className="tf-stack">
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
                        <span>＋</span> New doc
                    </tc-button>
                </div>
                <table className="table table-hover">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                                    {c.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {knowledge.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} style={{ textAlign: 'center', opacity: 0.6 }}>
                                    No knowledge yet — use the knowledge analyzer on the Agents page, or create a doc by hand.
                                </td>
                            </tr>
                        ) : (
                            knowledge.map((d) => (
                                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setOpenDoc(d.id)}>
                                    {columns.map((c) => (
                                        <td key={c.key}>{c.render(d)}</td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </tc-card>

            {knowledge.length > 0 && (
                <tc-text variant="muted">
                    Stored at the project root under <code>knowledge/</code> (alongside <code>repo/</code>). Click a row
                    to read a doc; <code>index.md</code> is rebuilt automatically.{' '}
                    <tc-badge variant="secondary">{knowledge.length} file(s)</tc-badge>
                </tc-text>
            )}

            <KnowledgeDrawer project={project} docId={openDoc} onClose={() => setOpenDoc(null)} />
        </div>
    )
}

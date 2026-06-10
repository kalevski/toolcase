'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, Heading, Text, Table, Tag, Badge, Button, toast, type TableColumn } from '@toolcase/react-components'
import type { KnowledgeDoc } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { usePrompt } from '../ConfirmModal'
import { KnowledgeDrawer } from './KnowledgeDrawer'
import { helpTexts } from '../helpTexts'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

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

    const columns: TableColumn<KnowledgeDoc>[] = [
        { key: 'id', header: 'File', width: '26%', render: (d) => <code>knowledge/{d.id}</code> },
        { key: 'title', header: 'Title', render: (d) => d.title },
        {
            key: 'description',
            header: 'About',
            render: (d) =>
                d.isIndex ? (
                    <Tag variant="info">index</Tag>
                ) : (
                    <Text variant="muted">{d.description || '—'}</Text>
                ),
        },
        {
            key: 'actions',
            header: '',
            width: '7rem',
            render: (d) =>
                d.isIndex ? null : (
                    <Button
                        size="small"
                        variant="danger"
                        outline
                        aria-label={`Remove ${d.id}`}
                        disabled={busy}
                        onClick={(e) => {
                            e.stopPropagation()
                            void onRemoveKnowledge(d.id)
                        }}
                    >
                        Remove
                    </Button>
                ),
        },
    ]

    return (
        <div className="tf-stack">
            <Card
                header={
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Heading as="h3">Knowledge base</Heading>
                        <Button
                            size="small"
                            variant="primary"
                            style={{ marginLeft: 'auto' }}
                            disabled={busy}
                            title={helpTexts.knowledge.newDoc}
                            onClick={() => void onNewDoc()}
                            startIcon={<span>＋</span>}
                        >
                            New doc
                        </Button>
                    </div>
                }
            >
                <Table
                    columns={columns}
                    data={knowledge}
                    rowKey={(d) => d.id}
                    hoverable
                    emptyMessage="No knowledge yet — use the knowledge analyzer on the Agents page, or create a doc by hand."
                    onRowClick={(d) => setOpenDoc(d.id)}
                />
            </Card>

            {knowledge.length > 0 && (
                <Text variant="muted">
                    Stored at the project root under <code>knowledge/</code> (alongside <code>repo/</code>). Click a row
                    to read a doc; <code>index.md</code> is rebuilt automatically.{' '}
                    <Badge variant="secondary">{knowledge.length} file(s)</Badge>
                </Text>
            )}

            <KnowledgeDrawer project={project} docId={openDoc} onClose={() => setOpenDoc(null)} />
        </div>
    )
}

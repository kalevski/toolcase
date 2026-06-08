'use client'

import React, { useState } from 'react'
import {
    Card,
    Heading,
    Text,
    Table,
    Tag,
    Badge,
    Button,
    Select,
    Textarea,
    type TableColumn,
} from '@toolcase/react-components'
import type { KnowledgeDoc } from '@/server/types'
import { useProject } from '../ProjectContext'
import { KnowledgeDrawer } from './KnowledgeDrawer'

export function KnowledgeClient() {
    const {
        project,
        knowledge,
        running,
        knowledgePrompt,
        setKnowledgePrompt,
        knowledgeModel,
        setKnowledgeModel,
        modelOptions,
        generatingKnowledge,
        onAddKnowledge,
        onRemoveKnowledge,
    } = useProject()
    const [openDoc, setOpenDoc] = useState<string | null>(null)

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
                        disabled={running || generatingKnowledge}
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
            <Card header={<Heading as="h3">Knowledge base</Heading>}>
                <Table
                    columns={columns}
                    data={knowledge}
                    rowKey={(d) => d.id}
                    hoverable
                    emptyMessage="No knowledge yet — describe an aspect of the repo to analyze below."
                    onRowClick={(d) => setOpenDoc(d.id)}
                />
            </Card>

            <Card header={<Heading as="h3">Knowledge analyzer</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <Textarea
                        label="Describe what to analyze — Claude reads the repo source, picks a filename, and writes one doc."
                        rows={4}
                        placeholder="e.g. How does the SSE streaming pipeline deliver run logs to the client?"
                        value={knowledgePrompt}
                        disabled={generatingKnowledge || running}
                        onChange={(e) => setKnowledgePrompt(e.target.value)}
                    />
                    <div className="tf-form-row">
                        <div style={{ minWidth: 200 }}>
                            <Select
                                label="Model"
                                options={modelOptions}
                                value={knowledgeModel}
                                disabled={generatingKnowledge || running}
                                onChange={(e) => setKnowledgeModel(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="primary"
                            loading={generatingKnowledge}
                            disabled={running || !knowledgePrompt.trim()}
                            onClick={onAddKnowledge}
                        >
                            Analyze &amp; add doc
                        </Button>
                    </div>
                </div>
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

'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heading, Button, Table, IconButton, EmptyState, toast, type TableColumn } from '@toolcase/react-components'
import type { SkillSummary } from '@/server/domain/types'
import { useConfirm } from './ConfirmModal'

export function SkillsClient({ skills }: { skills: SkillSummary[] }) {
    const router = useRouter()
    const confirm = useConfirm()
    const [rows, setRows] = useState(skills)

    const onDelete = async (name: string) => {
        const ok = await confirm({
            title: `Delete skill "${name}"?`,
            body: 'This removes the skill directory and its SKILL.md. This cannot be undone.',
            confirmLabel: 'Delete',
            confirmVariant: 'danger',
        })
        if (!ok) return
        const res = await fetch(`/api/skills/${name}`, { method: 'DELETE' })
        if (res.ok) {
            setRows((r) => r.filter((s) => s.name !== name))
            toast.success(`Deleted ${name}`)
        } else {
            toast.error('Delete failed')
        }
    }

    const columns: TableColumn<SkillSummary>[] = [
        { key: 'name', header: 'Name', render: (s) => <code>{s.name}</code> },
        { key: 'description', header: 'Description', render: (s) => s.description || <em>—</em> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (s) => (
                <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
                    <IconButton icon="pencil" label="Edit" variant="secondary" outline onClick={() => router.push(`/skills/${s.name}`)} />
                    <IconButton icon="trash" label="Delete" variant="danger" outline onClick={() => onDelete(s.name)} />
                </span>
            ),
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <Heading as="h1">Skills</Heading>
                <div style={{ flex: 1 }} />
                <Button variant="primary" onClick={() => router.push('/skills/new')} startIcon={<span>＋</span>}>
                    New skill
                </Button>
            </div>

            {rows.length === 0 ? (
                <EmptyState icon="lightbulb">
                    <h3>No skills yet</h3>
                    <p>Create a user-level skill that Claude will auto-discover while solving tasks.</p>
                </EmptyState>
            ) : (
                <Table columns={columns} data={rows} rowKey={(s) => s.name} hoverable />
            )}
        </div>
    )
}

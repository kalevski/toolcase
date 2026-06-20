'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { tcIcon } from '@/lib/icons'
import type { SkillSummary } from '@/server/domain/types'
import { useConfirm } from './ConfirmModal'
import { helpTexts } from './helpTexts'

type Col = { key: string; header: string; align?: 'right'; render: (s: SkillSummary) => React.ReactNode }

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

    const columns: Col[] = [
        { key: 'name', header: 'Name', render: (s) => <code>{s.name}</code> },
        { key: 'description', header: 'Description', render: (s) => s.description || <em>—</em> },
        {
            key: 'actions',
            header: '',
            align: 'right',
            render: (s) => (
                <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
                    <tc-icon-button icon={tcIcon('pencil')} label="Edit" variant="secondary" outline onClick={() => router.push(`/skills/${s.name}`)} />
                    <tc-icon-button icon={tcIcon('trash')} label="Delete" variant="danger" outline onClick={() => onDelete(s.name)} />
                </span>
            ),
        },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <tc-heading as="h1">Skills</tc-heading>
                <div style={{ flex: 1 }} />
                <tc-button variant="primary" onClick={() => router.push('/skills/new')}>
                    <span>＋</span> New skill
                </tc-button>
            </div>

            <tc-helper-text text={helpTexts.skills.shared} />

            {rows.length === 0 ? (
                <tc-empty-state icon={tcIcon('lightbulb')}>
                    <h3>No skills yet</h3>
                    <p>Create a user-level skill that Claude will auto-discover while solving tasks.</p>
                </tc-empty-state>
            ) : (
                <table className="table table-hover">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>
                                    {c.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((s) => (
                            <tr key={s.name}>
                                {columns.map((c) => (
                                    <td key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>
                                        {c.render(s)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )
}

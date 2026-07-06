'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { escapeHtml, useTc } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import type { SkillSummary } from '@/server/domain/types'
import { useConfirm } from './ConfirmModal'
import { helpTexts } from './helpTexts'

// tc-advanced-table header descriptors. Body rows are fed through the `rows`
// HTML-string property (the component owns its <tbody>; React <tr> children
// would be relocated out from under the reconciler and break SSR hydration —
// <tr> can't be parsed outside a <table>). Row actions are data-action buttons
// resolved by one delegated click listener on the host.
const ADV_COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'actions', label: '', align: 'right' as const },
]

/** The injected tbody HTML — every interpolated value is escaped. */
function skillRowsHtml(rows: SkillSummary[]): string {
    return rows
        .map(
            (s) =>
                `<tr>` +
                `<td><code>${escapeHtml(s.name)}</code></td>` +
                `<td>${s.description ? escapeHtml(s.description) : '<em>—</em>'}</td>` +
                `<td style="text-align: right"><span style="display: inline-flex; gap: 0.4rem">` +
                `<tc-icon-button icon="${tcIcon('pencil')}" label="Edit" variant="secondary" outline data-action="edit" data-name="${escapeHtml(s.name)}"></tc-icon-button>` +
                `<tc-icon-button icon="${tcIcon('trash')}" label="Delete" variant="danger" outline data-action="delete" data-name="${escapeHtml(s.name)}"></tc-icon-button>` +
                `</span></td>` +
                `</tr>`,
        )
        .join('')
}

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
        try {
            await apiFetch(`/api/skills/${name}`, { method: 'DELETE' })
            setRows((r) => r.filter((s) => s.name !== name))
            toast.success(`Deleted ${name}`)
        } catch (e) {
            toast.error(describeApiError(e))
        }
    }

    const onDelegated = (event: Event) => {
        const el = (event.target as HTMLElement)?.closest?.('[data-action]') as HTMLElement | null
        if (!el) return
        const action = el.getAttribute('data-action')
        const name = el.getAttribute('data-name')
        if (!name) return
        if (action === 'edit') router.push(`/skills/${name}`)
        else if (action === 'delete') void onDelete(name)
    }

    const tableProps = useMemo(() => ({ columns: ADV_COLUMNS, rows: skillRowsHtml(rows) }), [rows])
    const tableRef = useTc<HTMLElement>(tableProps, { click: onDelegated })

    return (
        <div className="taskforge-page">
            <tc-rich-page-header
                title-text="Skills"
                icon-name="Lightbulb"
                icon-color="amber"
                description={helpTexts.skills.shared}
            >
                <tc-button slot="actions" variant="primary" onClick={() => router.push('/skills/new')}>
                    <tc-icon name="Plus" /> New skill
                </tc-button>
            </tc-rich-page-header>

            {rows.length === 0 ? (
                <tc-empty-state icon={tcIcon('lightbulb')}>
                    <h3>No skills yet</h3>
                    <p>Create a user-level skill that Claude will auto-discover while solving tasks.</p>
                </tc-empty-state>
            ) : (
                <tc-advanced-table ref={tableRef} />
            )}
        </div>
    )
}

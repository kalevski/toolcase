'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { escapeHtml, useTc } from '@/lib/tc'
import type { KnowledgeDoc } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { usePrompt } from '../ConfirmModal'
import { KnowledgeDrawer } from './KnowledgeDrawer'
import { helpTexts } from '../helpTexts'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

// tc-advanced-table header descriptors. Body rows are fed through the `rows`
// HTML-string property (the component owns its <tbody>; React <tr> children
// would be relocated out from under the reconciler and break SSR hydration).
// Row-open navigation and the Remove button are delegated data-* events.
const ADV_COLUMNS = [
    { key: 'id', label: 'File', width: '26%' },
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'About' },
    { key: 'actions', label: '', width: '7rem' },
]

/** The injected tbody HTML — every interpolated value is escaped. */
function knowledgeRowsHtml(docs: KnowledgeDoc[], busy: boolean): string {
    if (docs.length === 0) {
        return (
            `<tr><td colspan="4" style="text-align: center; opacity: 0.6">` +
            `No knowledge yet — use the knowledge analyzer on the Agents page, or create a doc by hand.</td></tr>`
        )
    }
    return docs
        .map((d) => {
            const about = d.isIndex
                ? '<tc-tag static variant="info">index</tc-tag>'
                : `<tc-text variant="muted">${escapeHtml(d.description || '—')}</tc-text>`
            const actions = d.isIndex
                ? ''
                : `<tc-button size="sm" variant="danger" outline aria-label="Remove ${escapeHtml(d.id)}"${busy ? ' disabled' : ''} data-action="remove" data-id="${escapeHtml(d.id)}">Remove</tc-button>`
            return (
                `<tr data-open="${escapeHtml(d.id)}" tabindex="0" role="button" aria-label="Open knowledge/${escapeHtml(d.id)}" style="cursor: pointer">` +
                `<td><code>knowledge/${escapeHtml(d.id)}</code></td>` +
                `<td>${escapeHtml(d.title)}</td>` +
                `<td>${about}</td>` +
                `<td>${actions}</td></tr>`
            )
        })
        .join('')
}

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
        try {
            const data = await apiFetch<{ docs: KnowledgeDoc[]; id: string }>(`/api/projects/${project}/knowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, content: `# ${slug}\n\nOne-sentence summary goes here.\n\n` }),
            })
            setKnowledge(data.docs)
            setOpenDoc(data.id)
            toast.success(`Created knowledge/${data.id}`)
        } catch (e) {
            toast.error(describeApiError(e))
        }
    }

    // Delegated row interactions: the Remove button wins over row-open.
    const onTableClick = (event: Event) => {
        const target = event.target as HTMLElement
        const action = target.closest?.('[data-action="remove"]') as HTMLElement | null
        if (action) {
            const id = action.getAttribute('data-id')
            if (id) void onRemoveKnowledge(id)
            return
        }
        const row = target.closest?.('tr[data-open]') as HTMLElement | null
        if (row) setOpenDoc(row.getAttribute('data-open'))
    }
    const onTableKeydown = (event: Event) => {
        const e = event as KeyboardEvent
        if (e.key !== 'Enter' && e.key !== ' ') return
        const row = e.target as HTMLElement
        if (!row.matches?.('tr[data-open]')) return
        e.preventDefault()
        setOpenDoc(row.getAttribute('data-open'))
    }

    const tableProps = useMemo(
        () => ({ columns: ADV_COLUMNS, rows: knowledgeRowsHtml(knowledge, busy) }),
        [knowledge, busy],
    )
    const tableRef = useTc<HTMLElement>(tableProps, { click: onTableClick, keydown: onTableKeydown })

    return (
        <div className="taskforge-page">
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
                <tc-advanced-table ref={tableRef} />
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

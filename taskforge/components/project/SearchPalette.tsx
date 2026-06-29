'use client'

// C3 / Modernization — workspace search palette (Cmd/Ctrl+K). Promoted to the
// shared `tc-command-palette` so all three control panels share one global
// search surface (design-system §7). The palette filters the project's in-memory
// tasks / knowledge / notes (loaded into ProjectContext server-side) by title +
// id + description keywords; selecting a result deep-links into the owning page
// via `?open=<id>` (picked up by the target client).
//
// Note vs. the previous bespoke palette: tc-command-palette owns its own input
// and filters its `items` client-side (label + keywords), so this drops the
// per-keystroke server FTS5 snippet search. The doc bodies aren't loaded on the
// client anyway, and title/id/description keyword matching covers the common
// "jump to a task/doc/note" case while unifying the surface across apps.

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CommandPaletteItem } from '@toolcase/web-components'
import { useTc } from '@/lib/tc'
import type { SearchDocType } from '@/server/domain/types'
import { useProject } from '../ProjectContext'

const TYPE_LABEL: Record<SearchDocType, string> = {
    task: 'Tasks',
    knowledge: 'Knowledge',
    note: 'Notes',
}

const TYPE_ICON: Record<SearchDocType, string> = {
    task: 'list-checks',
    knowledge: 'book-text',
    note: 'sticky-note',
}

const PAGE_FOR: Record<SearchDocType, string> = {
    task: 'tasks',
    knowledge: 'knowledge',
    note: 'notes',
}

// Encode the doc type into the command id so tc-select can route without a
// lookup table: `<type>:<docId>`.
function itemId(type: SearchDocType, docId: string): string {
    return `${type}:${docId}`
}

export function SearchPalette() {
    const { project, tasks, knowledge, notes } = useProject()
    const router = useRouter()
    const [open, setOpen] = useState(false)

    // global hotkey — ⌘/Ctrl+K toggles; Esc is handled by the palette itself.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setOpen((v) => !v)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const items = useMemo<CommandPaletteItem[]>(() => {
        const out: CommandPaletteItem[] = []
        for (const t of tasks) {
            out.push({
                id: itemId('task', t.id),
                label: t.title || t.id,
                group: TYPE_LABEL.task,
                icon: TYPE_ICON.task,
                keywords: [t.id, t.status, t.severity ?? '', t.project ?? ''].filter(Boolean),
            })
        }
        for (const k of knowledge) {
            out.push({
                id: itemId('knowledge', k.id),
                label: k.title || k.id,
                group: TYPE_LABEL.knowledge,
                icon: TYPE_ICON.knowledge,
                keywords: [k.id, k.description].filter(Boolean),
            })
        }
        for (const n of notes) {
            out.push({
                id: itemId('note', n.id),
                label: n.title || n.id,
                group: TYPE_LABEL.note,
                icon: TYPE_ICON.note,
                keywords: [n.id],
            })
        }
        return out
    }, [tasks, knowledge, notes])

    const onSelect = useCallback(
        (e: Event) => {
            const item = (e as CustomEvent).detail?.item as CommandPaletteItem | undefined
            if (!item) return
            const sep = item.id.indexOf(':')
            const type = item.id.slice(0, sep) as SearchDocType
            const docId = item.id.slice(sep + 1)
            setOpen(false)
            router.push(`/projects/${project}/${PAGE_FOR[type]}?open=${encodeURIComponent(docId)}`)
        },
        [project, router],
    )

    const paletteRef = useTc<HTMLElement>(
        useMemo(() => ({ items, open }), [items, open]),
        {
            'tc-select': onSelect,
            'tc-close': () => setOpen(false),
        },
    )

    return <tc-command-palette ref={paletteRef} placeholder={`Search ${project} tasks, knowledge, notes…`} />
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTc } from '@/lib/tc'
import { useMe } from '@/lib/me-context'

// Global command palette. Cmd/Ctrl-K opens a fuzzy jump-to over every page the
// signed-in user can reach (role-gated, mirroring the side-nav).

interface CmdItem {
    id: string
    label: string
    group?: string
    icon?: string
    keywords?: string[]
    href: string
}

export function CommandPalette() {
    const me = useMe()
    const router = useRouter()
    const [open, setOpen] = useState(false)

    const items = useMemo<CmdItem[]>(() => {
        const list: CmdItem[] = [
            { id: 'dashboard', label: 'Dashboard', group: 'Navigate', icon: 'layout-dashboard', href: '/' },
            { id: 'new', label: 'New transcription', group: 'Navigate', icon: 'upload', href: '/new', keywords: ['upload'] },
            { id: 'library', label: 'Library', group: 'Navigate', icon: 'library', href: '/transcriptions', keywords: ['transcriptions', 'search'] },
            { id: 'notes', label: 'Notes', group: 'Navigate', icon: 'notebook-pen', href: '/notes', keywords: ['tags', 'markdown'] },
            { id: 'note-new', label: 'New note', group: 'Navigate', icon: 'notebook-pen', href: '/notes/new', keywords: ['standup', 'meeting'] },
        ]
        if (me.role === 'admin') {
            list.push(
                { id: 'admin-users', label: 'Admin · Users', group: 'Admin', icon: 'users', href: '/admin/users' },
                { id: 'admin-models', label: 'Admin · Models', group: 'Admin', icon: 'box', href: '/admin/models' },
                { id: 'admin-settings', label: 'Admin · Settings', group: 'Admin', icon: 'settings', href: '/admin/settings', keywords: ['theme', 'brand'] },
                { id: 'admin-audit', label: 'Admin · Audit', group: 'Admin', icon: 'scroll-text', href: '/admin/audit' },
            )
        }
        return list
    }, [me.role])

    // Cmd/Ctrl-K toggles the palette from anywhere.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                setOpen((o) => !o)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const ref = useTc<HTMLElement>(useMemo(() => ({ items }), [items]), {
        'tc-select': (e: Event) => {
            const item = (e as CustomEvent).detail?.item as CmdItem | undefined
            setOpen(false)
            if (item?.href) router.push(item.href)
        },
        'tc-close': () => setOpen(false),
    })

    return <tc-command-palette ref={ref} open={open || undefined} placeholder="Jump to…" />
}

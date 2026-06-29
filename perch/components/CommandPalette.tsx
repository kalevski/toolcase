'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTc } from '@/lib/tc'
import { useMe } from '@/lib/me-context'
import { ROLE_RANK } from '@/server/domain/types'

// Global command palette (plan WS-5). Cmd/Ctrl-K opens a fuzzy jump-to over every
// page the signed-in user can reach (role-gated, mirroring the side-nav). The
// element is imperative: `items` is a JS property, `open` an attribute, and it
// reports `tc-select` / `tc-close` CustomEvents — all bridged through lib/tc.ts.

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
            { id: 'sites', label: 'Sites', group: 'Navigate', icon: 'layout-dashboard', href: '/' },
            { id: 'plans', label: 'Plans', group: 'Navigate', icon: 'credit-card', href: '/plans' },
        ]
        if (ROLE_RANK[me.role] >= ROLE_RANK.maintainer) {
            list.push(
                { id: 'proxies', label: 'Proxies', group: 'Routing', icon: 'globe', href: '/proxies' },
                { id: 'upstreams', label: 'Upstreams', group: 'Routing', icon: 'server', href: '/upstreams' },
                { id: 'streams', label: 'Streams', group: 'Routing', icon: 'cable', href: '/streams' },
                {
                    id: 'stream-upstreams',
                    label: 'Stream upstreams',
                    group: 'Routing',
                    icon: 'network',
                    href: '/stream-upstreams',
                },
            )
        }
        if (me.role === 'owner') {
            list.push(
                { id: 'admin-sites', label: 'Admin · Sites', group: 'Admin', icon: 'layout-dashboard', href: '/admin/sites' },
                { id: 'admin-users', label: 'Admin · Users', group: 'Admin', icon: 'users', href: '/admin/users' },
                { id: 'admin-realms', label: 'Admin · Realms', group: 'Admin', icon: 'server', href: '/admin/realms' },
                { id: 'admin-domains', label: 'Admin · Domains', group: 'Admin', icon: 'globe', href: '/admin/domains' },
                { id: 'admin-plans', label: 'Admin · Plans', group: 'Admin', icon: 'credit-card', href: '/admin/plans' },
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

    // `items` is set as a property; `tc-select` / `tc-close` close the palette (it
    // does not self-close), and a selection navigates.
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

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTc } from '@/lib/tc'
import { useMe } from '@/lib/me-context'
import { apiFetch } from '@/lib/fetcher'
import type { ProjectSummary } from '@/server/domain/types'

// Global command palette (W2). Cmd/Ctrl-K opens a fuzzy jump-to over every place
// the signed-in user can reach: each visible project (and its config sub-pages),
// plus the owner-only Admin pages. The element is imperative — `items` is a JS
// property, `open` an attribute, and it reports `tc-select` / `tc-close`
// CustomEvents — all bridged through lib/tc.ts. Perch ships the same pattern.

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
    const [projects, setProjects] = useState<ProjectSummary[]>([])
    const isOwner = me.role === 'owner'

    // Re-fetch the visible project list on mount (cheap; the shell already does
    // its own copy — palette stays self-contained so it can mount once globally).
    useEffect(() => {
        const ctrl = new AbortController()
        apiFetch<ProjectSummary[]>('/api/projects', { signal: ctrl.signal })
            .then(setProjects)
            .catch(() => {
                /* palette still offers admin/static jumps without the project list */
            })
        return () => ctrl.abort()
    }, [])

    const items = useMemo<CmdItem[]>(() => {
        const list: CmdItem[] = []

        for (const p of projects) {
            const base = `/projects/${p.project.id}`
            const canManage = p.effectiveRole !== 'developer'
            const ownerScoped = isOwner
            const group = p.project.name
            // The project root, then its config sub-pages — gated by the same rules
            // the side-nav tab-bar uses so the palette never offers a 403.
            list.push({
                id: `${p.project.id}`,
                label: p.project.name,
                group,
                icon: 'box',
                keywords: [p.project.slug, 'project', 'overview'],
                href: base,
            })
            list.push({
                id: `${p.project.id}:env`,
                label: `${p.project.name} · Env vars`,
                group,
                icon: 'file-text',
                keywords: [p.project.slug, 'environment', 'variables', 'config'],
                href: `${base}/env`,
            })
            list.push({
                id: `${p.project.id}:flags`,
                label: `${p.project.name} · Flags`,
                group,
                icon: 'flag',
                keywords: [p.project.slug, 'feature', 'flags'],
                href: `${base}/flags`,
            })
            list.push({
                id: `${p.project.id}:notes`,
                label: `${p.project.name} · Notes`,
                group,
                icon: 'sticky-note',
                keywords: [p.project.slug, 'notes'],
                href: `${base}/notes`,
            })
            if (canManage) {
                list.push({
                    id: `${p.project.id}:secrets`,
                    label: `${p.project.name} · Secrets`,
                    group,
                    icon: 'key-round',
                    keywords: [p.project.slug, 'secrets', 'keys'],
                    href: `${base}/secrets`,
                })
                list.push({
                    id: `${p.project.id}:docker`,
                    label: `${p.project.name} · Docker`,
                    group,
                    icon: 'container',
                    keywords: [p.project.slug, 'docker', 'container', 'compose'],
                    href: `${base}/docker`,
                })
                list.push({
                    id: `${p.project.id}:audit`,
                    label: `${p.project.name} · Audit`,
                    group,
                    icon: 'scroll-text',
                    keywords: [p.project.slug, 'audit', 'log', 'activity'],
                    href: `${base}/audit`,
                })
            }
            if (ownerScoped) {
                list.push({
                    id: `${p.project.id}:members`,
                    label: `${p.project.name} · Members`,
                    group,
                    icon: 'users',
                    keywords: [p.project.slug, 'members', 'access', 'roles'],
                    href: `${base}/members`,
                })
            }
        }

        if (isOwner) {
            list.push(
                { id: 'new-project', label: 'Create project', group: 'Actions', icon: 'plus', keywords: ['new', 'add', 'create'], href: '/projects/new' },
                { id: 'admin-users', label: 'Admin · Users', group: 'Admin', icon: 'users', keywords: ['users', 'roles', 'owner', 'guest'], href: '/admin/users' },
                { id: 'admin-audit', label: 'Admin · Audit', group: 'Admin', icon: 'scroll-text', keywords: ['audit', 'log', 'activity'], href: '/admin/audit' },
                { id: 'admin-backups', label: 'Admin · Backups', group: 'Admin', icon: 'database-backup', keywords: ['backups', 'snapshots', 'restore'], href: '/admin/backups' },
                { id: 'admin-settings', label: 'Admin · Settings', group: 'Admin', icon: 'settings', keywords: ['settings', 'branding', 'theme'], href: '/admin/settings' },
            )
        }

        return list
    }, [projects, isOwner])

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

    return <tc-command-palette ref={ref} open={open || undefined} placeholder="Jump to a project, page or action…" />
}

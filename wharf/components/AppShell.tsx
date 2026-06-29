'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { SideNavItem, SideNavSection, TabBarItem } from '@toolcase/web-components'
import { useTc, useTcProps } from '@/lib/tc'
import { apiFetch } from '@/lib/fetcher'
import { useBranding } from '@/lib/branding-context'
import { CommandPalette } from './CommandPalette'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'
import { type MeResponse, type ProjectSummary } from '@/server/domain/types'

// Human labels for project sub-routes / admin pages, for the breadcrumb trail.
const PROJECT_SEGMENT_LABELS: Record<string, string> = {
    env: 'Env vars',
    flags: 'Flags',
    notes: 'Notes',
    secrets: 'Secrets',
    docker: 'Docker',
    audit: 'Audit',
    members: 'Members',
    instances: 'Instance',
}
const ADMIN_SEGMENT_LABELS: Record<string, string> = {
    users: 'Users',
    audit: 'Audit',
    backups: 'Backups',
    settings: 'Settings',
}

/** Sentinel side-nav key for the owner-only "Create project" action. */
const CREATE_VALUE = '__create__'

/**
 * The authenticated frame. `tc-dashboard-layout` is the responsive shell with
 * named slots: `brand`, `sidebar-menu`, `sidebar-panel`. The sidebar lists every
 * project the caller can see (one `tc-side-nav` item each) plus an owner-only
 * "Create project" action and the owner-only Admin section. When a project is open
 * its sections (Overview, Env vars, …) render as a `tc-tab-bar` above the page
 * content and drive navigation across all of that project's pages.
 */
export function AppShell({ me, children }: { me: MeResponse; children: ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const branding = useBranding()
    const [projects, setProjects] = useState<ProjectSummary[]>([])

    useEffect(() => {
        const ctrl = new AbortController()
        apiFetch<ProjectSummary[]>('/api/projects', { signal: ctrl.signal })
            .then(setProjects)
            .catch(() => {
                /* sidebar still renders without the project list */
            })
        return () => ctrl.abort()
    }, [])

    // Active project id from the URL (/projects/<id>/…), else '' (no project).
    const activeProjectId = useMemo(() => {
        const m = /^\/projects\/([^/]+)/.exec(pathname)
        return m ? m[1] : ''
    }, [pathname])

    const active = useMemo(
        () => projects.find((p) => p.project.id === activeProjectId),
        [projects, activeProjectId],
    )
    const canManage = active ? active.effectiveRole !== 'developer' : false
    const isOwner = me.role === 'owner'

    // ── breadcrumb trail (nested routes only) ──────────────────────────────────
    const crumbs = useMemo<Crumb[]>(() => {
        if (pathname.startsWith('/admin/')) {
            const seg = pathname.split('/')[2]
            const trail: Crumb[] = [{ label: 'Admin' }]
            if (seg && ADMIN_SEGMENT_LABELS[seg]) trail.push({ label: ADMIN_SEGMENT_LABELS[seg] })
            return trail
        }
        if (activeProjectId) {
            const base = `/projects/${activeProjectId}`
            const trail: Crumb[] = [
                { label: 'Projects', href: '/' },
                { label: active?.project.name ?? 'Project', href: base },
            ]
            const seg = pathname.slice(base.length).split('/').filter(Boolean)[0]
            if (seg && PROJECT_SEGMENT_LABELS[seg]) trail.push({ label: PROJECT_SEGMENT_LABELS[seg] })
            return trail
        }
        if (pathname === '/projects/new') return [{ label: 'Projects', href: '/' }, { label: 'New project' }]
        return []
    }, [pathname, activeProjectId, active])

    // With no "all projects" view, landing on the dashboard root with at least one
    // visible project selects (navigates to) the first one.
    useEffect(() => {
        if (pathname === '/' && projects.length > 0) {
            router.replace(`/projects/${projects[0].project.id}`)
        }
    }, [pathname, projects, router])

    // ── sidebar: one nav item per project, then "Create project", then Admin ──────
    const sections = useMemo<SideNavSection[]>(() => {
        const out: SideNavSection[] = []

        const projectItems: SideNavItem[] = projects.map((p) => ({
            key: p.project.id,
            label: p.project.name,
            icon: 'box',
            href: `/projects/${p.project.id}`,
            active: p.project.id === activeProjectId,
        }))
        if (isOwner) {
            projectItems.push({
                key: CREATE_VALUE,
                label: 'Create project',
                icon: 'plus',
                href: '/projects/new',
                active: pathname === '/projects/new',
            })
        }
        out.push({ key: 'projects', title: 'Projects', items: projectItems })

        if (isOwner) {
            out.push({
                key: 'admin',
                title: 'Admin',
                items: [
                    { key: 'admin-users', label: 'Users', icon: 'users', href: '/admin/users', active: pathname.startsWith('/admin/users') },
                    { key: 'admin-audit', label: 'Audit', icon: 'scroll-text', href: '/admin/audit', active: pathname.startsWith('/admin/audit') },
                    { key: 'admin-backups', label: 'Backups', icon: 'database-backup', href: '/admin/backups', active: pathname.startsWith('/admin/backups') },
                    { key: 'admin-settings', label: 'Settings', icon: 'settings', href: '/admin/settings', active: pathname.startsWith('/admin/settings') },
                ],
            })
        }
        return out
    }, [projects, activeProjectId, isOwner, pathname])

    const onItemClick = useCallback(
        (event: Event, item: SideNavItem) => {
            if (item.href) {
                event.preventDefault()
                router.push(item.href)
            }
        },
        [router],
    )

    // ── project tabs: the open project's sections, gated by effective role ─────────
    // Each tab maps to a route; the active tab is derived from the current path.
    // No tab icons: tc-tab-bar renders icon SVGs without a sizing class, so a
    // glyph would render unsized. Labels only.
    const tabDefs = useMemo(() => {
        if (!active) return []
        const base = `/projects/${active.project.id}`
        const defs: Array<TabBarItem & { href: string; show: boolean }> = [
            { id: 'overview', label: 'Overview', href: base, show: true },
            { id: 'env', label: 'Env vars', href: `${base}/env`, show: true },
            { id: 'flags', label: 'Flags', href: `${base}/flags`, show: true },
            { id: 'notes', label: 'Notes', href: `${base}/notes`, show: true },
            { id: 'secrets', label: 'Secrets', href: `${base}/secrets`, show: canManage },
            { id: 'docker', label: 'Docker', href: `${base}/docker`, show: canManage },
            { id: 'audit', label: 'Audit', href: `${base}/audit`, show: canManage },
            { id: 'members', label: 'Members', href: `${base}/members`, show: isOwner },
        ]
        return defs.filter((d) => d.show)
    }, [active, canManage, isOwner])

    const tabItems = useMemo<TabBarItem[]>(
        () => tabDefs.map(({ id, label }) => ({ id, label })),
        [tabDefs],
    )

    // Longest-prefix match: `overview` is the bare base, so it only wins on an exact
    // match; every other section wins on a path prefix. Unmatched (e.g. an instance
    // detail page) highlights nothing.
    const activeTabId = useMemo(() => {
        if (!active) return ''
        const base = `/projects/${active.project.id}`
        if (pathname === base) return 'overview'
        const hit = tabDefs.find((d) => d.id !== 'overview' && pathname.startsWith(d.href))
        return hit?.id ?? ''
    }, [active, tabDefs, pathname])

    const onTabChange = useCallback(
        (e: Event) => {
            const id = (e as CustomEvent).detail?.id as string | undefined
            const href = tabDefs.find((d) => d.id === id)?.href
            if (href && href !== pathname) router.push(href)
        },
        [tabDefs, pathname, router],
    )

    const onSignOut = useCallback(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
    }, [router])

    const sideNavRef = useTcProps<HTMLElement>(useMemo(() => ({ sections, onItemClick }), [sections, onItemClick]))
    const tabBarRef = useTc<HTMLElement>(
        useMemo(() => ({ tabs: tabItems, activeId: activeTabId }), [tabItems, activeTabId]),
        { 'tc-change': onTabChange },
    )
    const userRef = useTcProps<HTMLElement>(useMemo(() => ({ onIconClick: onSignOut }), [onSignOut]))

    return (
        <>
            <a href="#wharf-main" className="wharf-skip-link">
                Skip to content
            </a>
            <tc-dashboard-layout>
                <tc-brand
                    slot="brand"
                    primary-text={branding.appName}
                    secondary-text={branding.secondaryText || undefined}
                    color={branding.brandColor}
                />
                <div slot="sidebar-menu" className="wharf-sidebar-menu">
                    <tc-side-nav ref={sideNavRef} />
                </div>
                <tc-user-panel
                    slot="sidebar-panel"
                    ref={userRef}
                    username={me.login}
                    avatar-src={me.avatarUrl}
                    plan={me.role === 'owner' ? 'Owner' : 'Member'}
                    icon="log-out"
                    icon-label="Sign out"
                />
                <div className="wharf-shell-content" id="wharf-main">
                    <Breadcrumbs key={pathname} trail={crumbs} />
                    {tabItems.length > 0 && (
                        <div className="wharf-project-tabs">
                            <tc-tab-bar ref={tabBarRef} />
                        </div>
                    )}
                    {children}
                </div>
            </tc-dashboard-layout>
            {/* Cmd/Ctrl-K jump-to; renders hidden until invoked. */}
            <CommandPalette />
        </>
    )
}

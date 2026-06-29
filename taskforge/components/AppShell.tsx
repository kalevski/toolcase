'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { SideNavItem, SideNavSection } from '@toolcase/web-components'
import { useTcProps } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
import { useBranding } from '@/lib/branding-context'
import type { EngineState, MeResponse, ProjectNavItem } from '@/server/domain/types'

const STATE_ICON: Record<EngineState, string> = {
    RUNNING: 'play-circle-fill',
    SLEEPING: 'moon-fill',
    STOPPING: 'pause-circle-fill',
    IDLE: 'folder2',
}

/** Whether a project gets a state badge in the sidebar (IDLE shows none). */
const STATE_HAS_BADGE: Record<EngineState, boolean> = {
    RUNNING: true,
    SLEEPING: true,
    STOPPING: true,
    IDLE: false,
}

/** Derive the active project + top-level section from the URL. The project's
 *  sub-pages no longer live in the sidebar — they render as a `tc-tab-bar`
 *  above the page body (see `ProjectTabs`), matching the Wharf project pattern. */
function deriveActive(pathname: string): {
    activeProject: string | null
    section: 'dashboard' | 'skills' | 'users' | 'accounts' | 'audit' | 'health' | 'settings' | null
} {
    const m = pathname.match(/^\/projects\/([^/]+)(?:\/(tasks|knowledge|notes|runs|run|git|agents|settings))?\/?$/)
    if (m) {
        return { activeProject: decodeURIComponent(m[1]), section: null }
    }
    if (pathname.startsWith('/skills')) return { activeProject: null, section: 'skills' }
    if (pathname.startsWith('/users')) return { activeProject: null, section: 'users' }
    if (pathname.startsWith('/accounts')) return { activeProject: null, section: 'accounts' }
    if (pathname.startsWith('/audit')) return { activeProject: null, section: 'audit' }
    if (pathname.startsWith('/health')) return { activeProject: null, section: 'health' }
    if (pathname.startsWith('/settings')) return { activeProject: null, section: 'settings' }
    return { activeProject: null, section: 'dashboard' }
}

export function AppShell({
    me,
    projects,
    children,
}: {
    me: MeResponse
    projects: ProjectNavItem[]
    children: React.ReactNode
}) {
    const router = useRouter()
    const pathname = usePathname()
    const branding = useBranding()
    const { activeProject, section } = deriveActive(pathname)

    // Projects are a first-class nav list: each row links to its overview,
    // highlights when active, and shows a state badge when its engine isn't idle.
    const projectsSection: SideNavSection = {
        key: 'projects',
        title: `Projects${projects.length ? ` · ${projects.length}` : ''}`,
        items: projects.length
            ? projects.map((p) => {
                  const badge = STATE_HAS_BADGE[p.state]
                      ? p.state.toLowerCase()
                      : p.agentBusy
                        ? 'agent'
                        : undefined
                  return {
                      key: `project-${p.name}`,
                      label: p.name,
                      icon: tcIcon(STATE_ICON[p.state]),
                      href: `/projects/${p.name}`,
                      active: p.name === activeProject,
                      badge,
                  } as SideNavItem
              })
            : [{ key: 'no-projects', label: 'No projects yet', icon: tcIcon('plus-circle'), href: '/' }],
    }

    const generalSection: SideNavSection = {
        key: 'general',
        title: 'General',
        items: [
            { key: 'dashboard', label: 'Dashboard', icon: tcIcon('grid-1x2'), href: '/', active: section === 'dashboard' },
            { key: 'skills', label: 'Skills', icon: tcIcon('lightbulb'), href: '/skills', active: section === 'skills' },
            ...(me.role === 'admin'
                ? [
                      { key: 'users', label: 'Users', icon: tcIcon('people'), href: '/users', active: section === 'users' } as SideNavItem,
                      { key: 'accounts', label: 'Accounts', icon: tcIcon('key'), href: '/accounts', active: section === 'accounts' } as SideNavItem,
                      { key: 'audit', label: 'Audit log', icon: tcIcon('journal-check'), href: '/audit', active: section === 'audit' } as SideNavItem,
                      { key: 'health', label: 'Health', icon: tcIcon('heart-pulse'), href: '/health', active: section === 'health' } as SideNavItem,
                      { key: 'settings', label: 'Settings', icon: tcIcon('gear'), href: '/settings', active: section === 'settings' } as SideNavItem,
                  ]
                : []),
        ],
    }

    const sections: SideNavSection[] = [generalSection, projectsSection]

    const onItemClick = (event: Event, item: SideNavItem) => {
        if (item.href) {
            event.preventDefault()
            router.push(item.href)
        }
    }

    const onSignOut = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
    }

    const sideNavRef = useTcProps<HTMLElement>({ sections, onItemClick })
    const userRef = useTcProps<HTMLElement>({ onIconClick: onSignOut })

    return (
        <tc-dashboard-layout>
            <tc-brand
                slot="brand"
                primary-text="Task Forge"
                secondary-text={branding.secondaryText || undefined}
                color="#6c5ce7"
            />
            <div slot="sidebar-menu" className="tf-sidebar-menu">
                <tc-side-nav ref={sideNavRef} />
            </div>
            <tc-user-panel
                slot="navbar-right"
                ref={userRef}
                username={me.login}
                avatar-src={me.avatarUrl}
                plan={me.role}
                icon={tcIcon('box-arrow-right')}
                icon-label="Sign out"
            />
            <div className="tf-content">{children}</div>
        </tc-dashboard-layout>
    )
}

'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { SideNavItem, SideNavSection } from '@toolcase/web-components'
import { useTcProps } from '@/lib/tc'
import { tcIcon } from '@/lib/icons'
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

const USER_MENU = [{ key: 'logout', label: 'Logout', icon: tcIcon('box-arrow-right') }]

type ProjectSub = 'overview' | 'tasks' | 'agents' | 'knowledge' | 'notes' | 'run' | 'runs' | 'git' | 'settings'

/** Derive the active project + sub-page (or top-level section) from the URL. */
function deriveActive(pathname: string): {
    activeProject: string | null
    sub: ProjectSub | null
    section: 'dashboard' | 'skills' | 'users' | 'accounts' | 'audit' | 'health' | null
} {
    const m = pathname.match(/^\/projects\/([^/]+)(?:\/(tasks|knowledge|notes|runs|run|git|agents|settings))?\/?$/)
    if (m) {
        return { activeProject: decodeURIComponent(m[1]), sub: (m[2] as ProjectSub) ?? 'overview', section: null }
    }
    if (pathname.startsWith('/skills')) return { activeProject: null, sub: null, section: 'skills' }
    if (pathname.startsWith('/users')) return { activeProject: null, sub: null, section: 'users' }
    if (pathname.startsWith('/accounts')) return { activeProject: null, sub: null, section: 'accounts' }
    if (pathname.startsWith('/audit')) return { activeProject: null, sub: null, section: 'audit' }
    if (pathname.startsWith('/health')) return { activeProject: null, sub: null, section: 'health' }
    return { activeProject: null, sub: null, section: 'dashboard' }
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
    const { activeProject, sub, section } = deriveActive(pathname)

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

    const projectSection: SideNavSection | null = activeProject
        ? {
              key: 'project',
              title: activeProject,
              items: [
                  { key: 'overview', label: 'Overview', icon: tcIcon('speedometer2'), href: `/projects/${activeProject}`, active: sub === 'overview' },
                  { key: 'tasks', label: 'Tasks', icon: tcIcon('list-task'), href: `/projects/${activeProject}/tasks`, active: sub === 'tasks' },
                  { key: 'knowledge', label: 'Knowledge', icon: tcIcon('journal-text'), href: `/projects/${activeProject}/knowledge`, active: sub === 'knowledge' },
                  { key: 'agents', label: 'Agents', icon: tcIcon('robot'), href: `/projects/${activeProject}/agents`, active: sub === 'agents' },
                  { key: 'notes', label: 'Notes', icon: tcIcon('stickies'), href: `/projects/${activeProject}/notes`, active: sub === 'notes' },
                  { key: 'run', label: 'Run', icon: tcIcon('play-circle'), href: `/projects/${activeProject}/run`, active: sub === 'run' },
                  { key: 'runs', label: 'Run history', icon: tcIcon('clock-history'), href: `/projects/${activeProject}/runs`, active: sub === 'runs' },
                  { key: 'git', label: 'Git', icon: tcIcon('diagram-2'), href: `/projects/${activeProject}/git`, active: sub === 'git' },
                  { key: 'settings', label: 'Settings', icon: tcIcon('sliders'), href: `/projects/${activeProject}/settings`, active: sub === 'settings' },
              ],
          }
        : null

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
                  ]
                : []),
        ],
    }

    const sections: SideNavSection[] = [generalSection, projectsSection, ...(projectSection ? [projectSection] : [])]

    const onItemClick = (event: Event, item: SideNavItem) => {
        if (item.href) {
            event.preventDefault()
            router.push(item.href)
        }
    }

    const onMenuClick = async (key: string) => {
        if (key === 'logout') {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
        }
    }

    const sideNavRef = useTcProps<HTMLElement>({ sections, onItemClick })
    const userRef = useTcProps<HTMLElement>({ menuItems: USER_MENU, onMenuClick })

    return (
        <tc-dashboard-layout>
            <tc-brand slot="brand" primary-text="Task Forge" color="#6c5ce7" />
            <div slot="sidebar-menu" className="tf-sidebar-menu">
                <tc-side-nav ref={sideNavRef} />
            </div>
            <tc-user-panel
                slot="navbar-right"
                ref={userRef}
                username={me.login}
                avatar-src={me.avatarUrl}
                plan={me.role}
            />
            <div className="tf-content">{children}</div>
        </tc-dashboard-layout>
    )
}

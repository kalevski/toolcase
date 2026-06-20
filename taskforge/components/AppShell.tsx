'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
    DashboardLayout,
    Brand,
    SideNav,
    Badge,
    UserPanel,
    type BadgeProps,
    type SideNavItem,
    type SideNavSection,
} from '@/components/ui'
import type { EngineState, MeResponse, ProjectNavItem } from '@/server/domain/types'

const STATE_ICON: Record<EngineState, string> = {
    RUNNING: 'play-circle-fill',
    SLEEPING: 'moon-fill',
    STOPPING: 'pause-circle-fill',
    IDLE: 'folder2',
}

/** Badge shown next to a project in the sidebar when its engine isn't idle. */
const STATE_BADGE: Record<EngineState, BadgeProps['variant'] | null> = {
    RUNNING: 'success',
    SLEEPING: 'info',
    STOPPING: 'warning',
    IDLE: null,
}

type ProjectSub = 'overview' | 'tasks' | 'agents' | 'knowledge' | 'notes' | 'run' | 'runs' | 'git' | 'settings'

/** Derive the active project + sub-page (or top-level section) from the URL. */
function deriveActive(pathname: string): {
    activeProject: string | null
    sub: ProjectSub | null
    section: 'dashboard' | 'skills' | 'users' | 'audit' | 'health' | null
} {
    const m = pathname.match(/^\/projects\/([^/]+)(?:\/(tasks|knowledge|notes|runs|run|git|agents|settings))?\/?$/)
    if (m) {
        return { activeProject: decodeURIComponent(m[1]), sub: (m[2] as ProjectSub) ?? 'overview', section: null }
    }
    if (pathname.startsWith('/skills')) return { activeProject: null, sub: null, section: 'skills' }
    if (pathname.startsWith('/users')) return { activeProject: null, sub: null, section: 'users' }
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

    // Projects are a first-class nav list (replaces the old dropdown): each row
    // links straight to its overview, highlights when active, and shows a state
    // badge when its engine isn't idle.
    const projectsSection: SideNavSection = {
        key: 'projects',
        title: `Projects${projects.length ? ` · ${projects.length}` : ''}`,
        items: projects.length
            ? projects.map((p) => {
                  const variant = STATE_BADGE[p.state]
                  // Engine state wins; an agent session badges the row when the engine is idle.
                  const badge = variant ? (
                      <Badge variant={variant} size="sm" pill>
                          {p.state.toLowerCase()}
                      </Badge>
                  ) : p.agentBusy ? (
                      <Badge variant="info" size="sm" pill>
                          agent
                      </Badge>
                  ) : undefined
                  return {
                      key: `project-${p.name}`,
                      label: p.name,
                      icon: STATE_ICON[p.state],
                      href: `/projects/${p.name}`,
                      active: p.name === activeProject,
                      badge,
                  } as SideNavItem
              })
            : [{ key: 'no-projects', label: 'No projects yet', icon: 'plus-circle', href: '/' }],
    }

    const projectSection: SideNavSection | null = activeProject
        ? {
              key: 'project',
              title: activeProject,
              items: [
                  {
                      key: 'overview',
                      label: 'Overview',
                      icon: 'speedometer2',
                      href: `/projects/${activeProject}`,
                      active: sub === 'overview',
                  },
                  {
                      key: 'tasks',
                      label: 'Tasks',
                      icon: 'list-task',
                      href: `/projects/${activeProject}/tasks`,
                      active: sub === 'tasks',
                  },
                  {
                      key: 'knowledge',
                      label: 'Knowledge',
                      icon: 'journal-text',
                      href: `/projects/${activeProject}/knowledge`,
                      active: sub === 'knowledge',
                  },
                  {
                      key: 'agents',
                      label: 'Agents',
                      icon: 'robot',
                      href: `/projects/${activeProject}/agents`,
                      active: sub === 'agents',
                  },
                  {
                      key: 'notes',
                      label: 'Notes',
                      icon: 'stickies',
                      href: `/projects/${activeProject}/notes`,
                      active: sub === 'notes',
                  },
                  {
                      key: 'run',
                      label: 'Run',
                      icon: 'play-circle',
                      href: `/projects/${activeProject}/run`,
                      active: sub === 'run',
                  },
                  {
                      key: 'runs',
                      label: 'Run history',
                      icon: 'clock-history',
                      href: `/projects/${activeProject}/runs`,
                      active: sub === 'runs',
                  },
                  {
                      key: 'git',
                      label: 'Git',
                      icon: 'diagram-2',
                      href: `/projects/${activeProject}/git`,
                      active: sub === 'git',
                  },
                  {
                      key: 'settings',
                      label: 'Settings',
                      icon: 'sliders',
                      href: `/projects/${activeProject}/settings`,
                      active: sub === 'settings',
                  },
              ],
          }
        : null

    const generalSection: SideNavSection = {
        key: 'general',
        title: 'General',
        items: [
            { key: 'dashboard', label: 'Dashboard', icon: 'grid-1x2', href: '/', active: section === 'dashboard' },
            { key: 'skills', label: 'Skills', icon: 'lightbulb', href: '/skills', active: section === 'skills' },
            ...(me.role === 'admin'
                ? [
                      {
                          key: 'users',
                          label: 'Users',
                          icon: 'people',
                          href: '/users',
                          active: section === 'users',
                      } as SideNavItem,
                      {
                          key: 'audit',
                          label: 'Audit log',
                          icon: 'journal-check',
                          href: '/audit',
                          active: section === 'audit',
                      } as SideNavItem,
                      {
                          key: 'health',
                          label: 'Health',
                          icon: 'heart-pulse',
                          href: '/health',
                          active: section === 'health',
                      } as SideNavItem,
                  ]
                : []),
        ],
    }

    const sections: SideNavSection[] = [
        generalSection,
        projectsSection,
        ...(projectSection ? [projectSection] : []),
    ]

    const onItemClick = (e: React.MouseEvent<HTMLAnchorElement>, item: SideNavItem) => {
        if (item.href) {
            e.preventDefault()
            router.push(item.href)
        }
    }

    const onMenuClick = async (_e: React.MouseEvent<HTMLButtonElement>, key: string) => {
        if (key === 'logout') {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.push('/login')
        }
    }

    return (
        <DashboardLayout
            brandComponent={<Brand primaryText="Task Forge" color="#6c5ce7" />}
            sidebarMenuComponent={
                <div className="tf-sidebar-menu">
                    <SideNav sections={sections} onItemClick={onItemClick} />
                </div>
            }
            navbarRightComponent={
                <UserPanel
                    username={me.login}
                    avatarSrc={me.avatarUrl}
                    plan={me.role}
                    menuItems={[{ key: 'logout', label: 'Logout', icon: 'box-arrow-right' }]}
                    onMenuClick={onMenuClick}
                />
            }
        >
            <div className="tf-content">{children}</div>
        </DashboardLayout>
    )
}

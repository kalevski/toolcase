'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
    DashboardLayout,
    Brand,
    SideNav,
    Dropdown,
    UserPanel,
    type DropdownItem,
    type SideNavItem,
    type SideNavSection,
} from '@toolcase/react-components'
import type { EngineState, MeResponse, ProjectNavItem } from '@/server/types'

const STATE_ICON: Record<EngineState, string> = {
    RUNNING: 'play-circle-fill',
    SLEEPING: 'moon-fill',
    STOPPING: 'pause-circle-fill',
    IDLE: 'folder2',
}

type ProjectSub = 'overview' | 'tasks' | 'knowledge' | 'run' | 'git'

/** Derive the active project + sub-page (or top-level section) from the URL. */
function deriveActive(pathname: string): {
    activeProject: string | null
    sub: ProjectSub | null
    section: 'dashboard' | 'skills' | 'users' | null
} {
    const m = pathname.match(/^\/projects\/([^/]+)(?:\/(tasks|knowledge|run|git))?\/?$/)
    if (m) {
        return { activeProject: decodeURIComponent(m[1]), sub: (m[2] as ProjectSub) ?? 'overview', section: null }
    }
    if (pathname.startsWith('/skills')) return { activeProject: null, sub: null, section: 'skills' }
    if (pathname.startsWith('/users')) return { activeProject: null, sub: null, section: 'users' }
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

    const projectItems: DropdownItem[] = projects.map((p) => ({
        key: p.name,
        name: p.name,
        icon: STATE_ICON[p.state],
        description: p.state === 'IDLE' ? undefined : p.state.toLowerCase(),
    }))

    const projectSection: SideNavSection | null = activeProject
        ? {
              key: 'project',
              title: 'Project',
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
                      key: 'run',
                      label: 'Run',
                      icon: 'play-circle',
                      href: `/projects/${activeProject}/run`,
                      active: sub === 'run',
                  },
                  {
                      key: 'git',
                      label: 'Git',
                      icon: 'diagram-2',
                      href: `/projects/${activeProject}/git`,
                      active: sub === 'git',
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
                  ]
                : []),
        ],
    }

    const sections: SideNavSection[] = projectSection ? [projectSection, generalSection] : [generalSection]

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
                    <div className="tf-repo-picker">
                        <span className="tf-repo-picker__label">Project</span>
                        <Dropdown
                            items={projectItems}
                            value={activeProject ?? undefined}
                            placeholder={projects.length ? 'Select a project…' : 'No projects'}
                            onChange={(key) => router.push(`/projects/${key}`)}
                        />
                    </div>
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

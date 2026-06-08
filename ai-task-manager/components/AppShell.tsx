'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
    DashboardLayout,
    Brand,
    SideNav,
    UserPanel,
    type SideNavItem,
    type SideNavSection,
} from '@toolcase/react-components'
import type { MeResponse } from '@/server/types'

export type ActiveNav = 'repos' | 'skills' | 'users'

export function AppShell({
    me,
    active,
    children,
}: {
    me: MeResponse
    active: ActiveNav
    children: React.ReactNode
}) {
    const router = useRouter()

    const sections: SideNavSection[] = [
        {
            key: 'main',
            items: [
                { key: 'repos', label: 'Repositories', icon: 'collection', href: '/', active: active === 'repos' },
                { key: 'skills', label: 'Skills', icon: 'lightbulb', href: '/skills', active: active === 'skills' },
                ...(me.role === 'admin'
                    ? [
                          {
                              key: 'users',
                              label: 'Users',
                              icon: 'people',
                              href: '/users',
                              active: active === 'users',
                          } as SideNavItem,
                      ]
                    : []),
            ],
        },
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
            brandComponent={<Brand primaryText="TaskForge" secondaryText="ai-task-manager" color="#6c5ce7" />}
            sidebarMenuComponent={<SideNav sections={sections} onItemClick={onItemClick} />}
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
            <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>{children}</div>
        </DashboardLayout>
    )
}

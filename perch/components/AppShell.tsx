'use client'

import { useMemo, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { SideNavItem, SideNavSection, UserPanelMenuItem } from '@toolcase/web-components'
import { useTcProps } from '@/lib/tc'
import type { MeResponse } from '@/server/domain/types'

// The authenticated frame (§14). `tc-dashboard-layout` is the responsive shell:
// it renders the top navbar bar and the collapsible sidebar aside (the "navbar"
// and "sidebar" of the frame), exposing named slots we populate — `brand` and
// `sidebar-menu` in the sidebar, `navbar-right` in the navbar. `tc-side-nav`
// fills the menu; `tc-user-panel` shows the avatar + plan micro-label.

// Single sign-out action in the user-panel dropdown. Icons resolve as kebab-case
// lucide names inside the component (lucideByName), so we pass lucide names.
const USER_MENU: UserPanelMenuItem[] = [{ key: 'logout', label: 'Sign out', icon: 'log-out' }]

export function AppShell({ me, children }: { me: MeResponse; children: ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()

    // Navigation is data — `tc-side-nav` takes its sections as a JS property and
    // reports clicks via `tc-item-click` / the `onItemClick` callback. Owner-only
    // rows (§6, §13) are appended only for the owner role.
    const sections = useMemo<SideNavSection[]>(() => {
        const main: SideNavSection = {
            key: 'main',
            title: 'Perch',
            items: [
                {
                    key: 'sites',
                    label: 'Sites',
                    icon: 'layout-dashboard',
                    href: '/',
                    active: pathname === '/',
                },
                {
                    key: 'plans',
                    label: 'Plans',
                    icon: 'credit-card',
                    href: '/plans',
                    active: pathname.startsWith('/plans'),
                },
            ],
        }
        const admin: SideNavSection = {
            key: 'admin',
            title: 'Admin',
            items: [
                {
                    key: 'admin',
                    label: 'Administration',
                    icon: 'shield',
                    href: '/admin',
                    active: pathname.startsWith('/admin'),
                },
            ],
        }
        return me.role === 'owner' ? [main, admin] : [main]
    }, [pathname, me.role])

    // Intercept the side-nav anchor click so navigation stays a client-side
    // router push instead of a full page load. preventDefault works because the
    // component invokes onItemClick synchronously inside its click handler.
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

    const sideNavRef = useTcProps<HTMLElement>(useMemo(() => ({ sections, onItemClick }), [sections]))
    const userRef = useTcProps<HTMLElement>(useMemo(() => ({ menuItems: USER_MENU, onMenuClick }), []))

    return (
        <tc-dashboard-layout>
            <tc-brand slot="brand" primary-text="Perch" color="#0ea5e9" />
            <div slot="sidebar-menu" className="perch-sidebar-menu">
                <tc-side-nav ref={sideNavRef} />
            </div>
            <tc-user-panel
                slot="navbar-right"
                ref={userRef}
                username={me.login}
                avatar-src={me.avatarUrl}
                plan={me.plan}
            />
            <div className="perch-shell-content">{children}</div>
        </tc-dashboard-layout>
    )
}

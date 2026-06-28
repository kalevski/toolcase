'use client'

import { useMemo, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { SideNavItem, SideNavSection } from '@toolcase/web-components'
import { useTcProps } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'
import { Breadcrumbs } from './Breadcrumbs'
import { CommandPalette } from './CommandPalette'
import { RealmSwitcher } from './RealmSwitcher'
import { ACCOUNT_LEVEL_LABEL, ROLE_RANK, type MeResponse } from '@/server/domain/types'

// The authenticated frame (§14). `tc-dashboard-layout` is the responsive shell:
// it renders the top navbar bar and the collapsible sidebar aside (the "navbar"
// and "sidebar" of the frame), exposing named slots we populate — `brand`,
// `sidebar-menu`, and `sidebar-panel` in the sidebar. `tc-side-nav` fills the
// menu; `tc-user-panel` sits in the sidebar panel, showing the avatar + plan
// micro-label. Its trailing icon button is wired as a direct sign-out action
// (`icon="log-out"`, no dropdown menu) — see `onSignOut` below.

export function AppShell({ me, children }: { me: MeResponse; children: ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const branding = useBranding()

    // Navigation is data — `tc-side-nav` takes its sections as a JS property and
    // reports clicks via `tc-item-click` / the `onItemClick` callback. The Routing
    // section is appended for `maintainer` and above; the owner-only Admin section
    // (§6, §13) only for the owner. Both gates mirror the server `authorize(...)`.
    const sections = useMemo<SideNavSection[]>(() => {
        const main: SideNavSection = {
            key: 'main',
            title: branding.appName,
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
        const routing: SideNavSection = {
            key: 'routing',
            title: 'Routing',
            items: [
                {
                    key: 'routing-proxies',
                    label: 'Proxies',
                    icon: 'globe',
                    href: '/proxies',
                    active: pathname.startsWith('/proxies'),
                },
                {
                    key: 'routing-upstreams',
                    label: 'Upstreams',
                    icon: 'server',
                    href: '/upstreams',
                    active: pathname.startsWith('/upstreams'),
                },
                {
                    key: 'routing-streams',
                    label: 'Streams',
                    icon: 'cable',
                    href: '/streams',
                    active: pathname.startsWith('/streams'),
                },
                {
                    key: 'routing-stream-upstreams',
                    label: 'Stream upstreams',
                    icon: 'network',
                    href: '/stream-upstreams',
                    active: pathname.startsWith('/stream-upstreams'),
                },
            ],
        }
        const admin: SideNavSection = {
            key: 'admin',
            title: 'Admin',
            items: [
                {
                    key: 'admin-sites',
                    label: 'Sites',
                    icon: 'layout-dashboard',
                    href: '/admin/sites',
                    active: pathname.startsWith('/admin/sites'),
                },
                {
                    key: 'admin-users',
                    label: 'Users',
                    icon: 'users',
                    href: '/admin/users',
                    active: pathname.startsWith('/admin/users'),
                },
                {
                    key: 'admin-realms',
                    label: 'Realms',
                    icon: 'server',
                    href: '/admin/realms',
                    active: pathname.startsWith('/admin/realms'),
                },
                {
                    key: 'admin-domains',
                    label: 'Domains',
                    icon: 'globe',
                    href: '/admin/domains',
                    active: pathname.startsWith('/admin/domains'),
                },
                {
                    key: 'admin-settings',
                    label: 'Settings',
                    icon: 'settings',
                    href: '/admin/settings',
                    active: pathname.startsWith('/admin/settings'),
                },
                {
                    key: 'admin-plans',
                    label: 'Plans',
                    icon: 'credit-card',
                    href: '/admin/plans',
                    active: pathname.startsWith('/admin/plans'),
                },
                {
                    key: 'admin-audit',
                    label: 'Audit',
                    icon: 'scroll-text',
                    href: '/admin/audit',
                    active: pathname.startsWith('/admin/audit'),
                },
            ],
        }
        const rank = ROLE_RANK[me.role]
        const out: SideNavSection[] = [main]
        if (rank >= ROLE_RANK.maintainer) out.push(routing)
        if (me.role === 'owner') out.push(admin)
        return out
    }, [pathname, me.role, branding.appName])

    // Intercept the side-nav anchor click so navigation stays a client-side
    // router push instead of a full page load. preventDefault works because the
    // component invokes onItemClick synchronously inside its click handler.
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

    const sideNavRef = useTcProps<HTMLElement>(useMemo(() => ({ sections, onItemClick }), [sections]))
    const userRef = useTcProps<HTMLElement>(useMemo(() => ({ onIconClick: onSignOut }), []))

    return (
        <>
            <a href="#perch-main" className="perch-skip-link">
                Skip to content
            </a>
            <tc-dashboard-layout>
                <tc-brand slot="brand" primary-text={branding.appName} color={branding.brandColor} />
                <div slot="sidebar-menu" className="perch-sidebar-menu">
                    <tc-side-nav ref={sideNavRef} />
                </div>
                <RealmSwitcher />
                <tc-user-panel
                    slot="sidebar-panel"
                    ref={userRef}
                    username={me.login}
                    avatar-src={me.avatarUrl}
                    plan={ACCOUNT_LEVEL_LABEL[me.level]}
                    icon="log-out"
                    icon-label="Sign out"
                />
                <div className="perch-shell-content" id="perch-main">
                    <Breadcrumbs />
                    {children}
                </div>
            </tc-dashboard-layout>
            {/* Cmd/Ctrl-K jump-to; renders hidden until invoked. */}
            <CommandPalette />
        </>
    )
}

'use client'

import { useCallback, useMemo, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { SideNavItem, SideNavSection } from '@toolcase/web-components'
import { useTcProps } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'
import { Breadcrumbs } from './Breadcrumbs'
import { CommandPalette } from './CommandPalette'
import { RealmSwitcher } from './RealmSwitcher'
import { ACCOUNT_LEVEL_LABEL, ROLE_RANK, type MeResponse } from '@/server/domain/types'
import { ADMIN_TABS } from './admin/shared'

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
        const rank = ROLE_RANK[me.role]
        // Resources: everything a user operates on. Static Sites for everyone;
        // Instances (Config subsystem, move_wharf_to_perch.md §10) and Databases
        // (quaykeeper_database_management.md §9) join for maintainer+ — the same gate
        // their backing /api routes enforce.
        const main: SideNavSection = {
            key: 'main',
            title: 'Resources',
            items: [
                {
                    key: 'sites',
                    label: 'Static Sites',
                    icon: 'layout-dashboard',
                    href: '/',
                    active: pathname === '/',
                },
                ...(rank >= ROLE_RANK.maintainer
                    ? [
                          {
                              key: 'instances',
                              label: 'Variables',
                              icon: 'server',
                              href: '/instances',
                              active: pathname.startsWith('/instances'),
                          },
                          {
                              key: 'db-servers',
                              label: 'Databases',
                              icon: 'database',
                              href: '/databases',
                              active: pathname.startsWith('/databases'),
                          },
                          {
                              key: 'snippets',
                              label: 'Docker snippets',
                              icon: 'container',
                              href: '/snippets',
                              active: pathname.startsWith('/snippets'),
                          },
                      ]
                    : []),
            ],
        }
        // Every routing area is its own sidebar entry (like the Admin section) —
        // one route per page, no intra-section tab bar. Pools live WITH their
        // consumers: Proxies carries the http upstream pools, Streams the L4 ones.
        const routing: SideNavSection = {
            key: 'routing',
            title: 'Routing',
            items: [
                { key: 'proxies', label: 'Proxies', icon: 'globe', href: '/proxies' },
                { key: 'redirects', label: 'Redirects', icon: 'corner-up-right', href: '/redirects' },
                { key: 'dead-hosts', label: 'Dead hosts', icon: 'ban', href: '/dead-hosts' },
                { key: 'access-lists', label: 'Access lists', icon: 'lock', href: '/access-lists' },
                { key: 'streams', label: 'Streams', icon: 'cable', href: '/streams' },
            ].map((item) => ({ ...item, active: pathname.startsWith(item.href) })),
        }
        // Every admin area is its own sidebar entry (Sites, Users, Realms, Domains,
        // Certificates, Settings, Audit) — one route per page, no intra-section tab
        // bar. ADMIN_TABS is the single source for the list.
        const admin: SideNavSection = {
            key: 'admin',
            title: 'Admin',
            items: ADMIN_TABS.map((tab) => ({
                key: tab.id,
                label: tab.label,
                icon: tab.icon,
                href: tab.href,
                active: pathname === tab.href || pathname.startsWith(`${tab.href}/`),
            })),
        }
        const out: SideNavSection[] = [main]
        if (rank >= ROLE_RANK.maintainer) out.push(routing)
        if (me.role === 'owner') out.push(admin)
        return out
    }, [pathname, me.role])

    // Intercept the side-nav anchor click so navigation stays a client-side
    // router push instead of a full page load. preventDefault works because the
    // component invokes onItemClick synchronously inside its click handler.
    const onItemClick = useCallback(
        (event: Event, item: SideNavItem) => {
            if (item.href) {
                event.preventDefault()
                router.push(item.href)
            }
        },
        [router],
    )

    const onSignOut = useCallback(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
    }, [router])

    const sideNavRef = useTcProps<HTMLElement>(useMemo(() => ({ sections, onItemClick }), [sections, onItemClick]))
    const userRef = useTcProps<HTMLElement>(useMemo(() => ({ onIconClick: onSignOut }), [onSignOut]))

    return (
        <>
            <a href="#quaykeeper-main" className="quaykeeper-skip-link">
                Skip to content
            </a>
            <tc-dashboard-layout>
                {/* The wrapper div (not tc-brand) carries the slot: the layout relocates
                    `[slot="brand"]` nodes ONCE at connect, so the stamp — which only mounts
                    after the branding fetch resolves — must appear inside an already-relocated
                    parent. The wrapper is also the stamp's position:relative anchor. */}
                <div slot="brand" className="quaykeeper-brand-stamp">
                    <tc-brand
                        primary-text={branding.appName}
                        secondary-text={branding.secondaryText || undefined}
                        color={branding.brandColor}
                    />
                    {branding.stampText && (
                        <tc-stamp label={branding.stampText} color="primary" position="top-right" />
                    )}
                </div>
                <div slot="sidebar-menu" className="quaykeeper-sidebar-menu">
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
                <div className="quaykeeper-shell-content" id="quaykeeper-main">
                    <Breadcrumbs />
                    {children}
                </div>
            </tc-dashboard-layout>
            {/* Cmd/Ctrl-K jump-to; renders hidden until invoked. */}
            <CommandPalette />
        </>
    )
}

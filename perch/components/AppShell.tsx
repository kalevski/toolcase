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
        // The four routing sub-pages and the owner admin sub-pages now live behind a
        // tc-tab-bar above each page body (P5, Wharf's project-tab pattern), so the
        // sidebar carries ONE entry per section — clicking it lands on the section's
        // first page (the tab bar handles intra-section navigation from there).
        const routing: SideNavSection = {
            key: 'routing',
            title: 'Routing',
            items: [
                {
                    key: 'routing',
                    label: 'Routing',
                    icon: 'route',
                    href: '/proxies',
                    active: ['/proxies', '/upstreams', '/streams', '/stream-upstreams'].some((p) =>
                        pathname.startsWith(p),
                    ),
                },
            ],
        }
        const admin: SideNavSection = {
            key: 'admin',
            title: 'Admin',
            items: [
                {
                    key: 'admin',
                    label: 'Admin',
                    icon: 'shield',
                    href: '/admin',
                    active: pathname.startsWith('/admin'),
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
            <a href="#perch-main" className="perch-skip-link">
                Skip to content
            </a>
            <tc-dashboard-layout>
                <tc-brand
                    slot="brand"
                    primary-text={branding.appName}
                    secondary-text={branding.secondaryText || undefined}
                    color={branding.brandColor}
                />
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

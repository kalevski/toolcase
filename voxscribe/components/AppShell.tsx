'use client'

import { useCallback, useMemo, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { SideNavItem, SideNavSection } from '@toolcase/web-components'
import { useTcProps } from '@/lib/tc'
import { MeProvider } from '@/lib/me-context'
import { useBranding } from '@/lib/branding-context'
import { CommandPalette } from './CommandPalette'
import { ROLE_LABEL, type MeResponse } from '@/server/domain/types'

// The authenticated frame (spec §9). `tc-dashboard-layout` is the responsive
// shell (top navbar + collapsible sidebar); `tc-side-nav` fills the menu,
// `tc-user-panel` sits in the sidebar panel with a direct sign-out action.
// Nav sections are rank-gated: Dashboard / New transcription / Library / Notes,
// then Admin (Users, Models, Settings, Audit) for admins. The brand reads the
// live instance branding (admin Settings) instead of hardcoded text.

export function AppShell({ me, children }: { me: MeResponse; children: ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const branding = useBranding()

    const sections = useMemo<SideNavSection[]>(() => {
        const main: SideNavSection = {
            key: 'main',
            title: 'Studio',
            items: [
                { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: '/', active: pathname === '/' },
                { key: 'new', label: 'New transcription', icon: 'upload', href: '/new', active: pathname.startsWith('/new') },
                {
                    key: 'library',
                    label: 'Library',
                    icon: 'library',
                    href: '/transcriptions',
                    active: pathname.startsWith('/transcriptions'),
                },
                { key: 'notes', label: 'Notes', icon: 'notebook-pen', href: '/notes', active: pathname.startsWith('/notes') },
            ],
        }
        const admin: SideNavSection = {
            key: 'admin',
            title: 'Admin',
            items: [
                { key: 'users', label: 'Users', icon: 'users', href: '/admin/users' },
                { key: 'models', label: 'Models', icon: 'box', href: '/admin/models' },
                { key: 'settings', label: 'Settings', icon: 'settings', href: '/admin/settings' },
                { key: 'audit', label: 'Audit', icon: 'scroll-text', href: '/admin/audit' },
            ].map((item) => ({ ...item, active: pathname.startsWith(item.href) })),
        }
        const out: SideNavSection[] = [main]
        if (me.role === 'admin') out.push(admin)
        return out
    }, [pathname, me.role])

    // Intercept the side-nav anchor click so navigation stays a client-side
    // router push instead of a full page load.
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
        <MeProvider me={me}>
            <tc-dashboard-layout>
                <div slot="brand" className="voxscribe-brand-stamp">
                    <tc-brand
                        primary-text={branding.appName}
                        secondary-text={branding.secondaryText || undefined}
                        color={branding.brandColor || undefined}
                    />
                </div>
                <div slot="sidebar-menu" className="voxscribe-sidebar-menu">
                    <tc-side-nav ref={sideNavRef} />
                </div>
                <tc-user-panel
                    slot="sidebar-panel"
                    ref={userRef}
                    username={me.login}
                    avatar-src={me.avatarUrl}
                    plan={ROLE_LABEL[me.role]}
                    icon="log-out"
                    icon-label="Sign out"
                />
                <div className="voxscribe-shell-content" id="voxscribe-main">
                    {children}
                </div>
            </tc-dashboard-layout>
            {/* Cmd/Ctrl-K jump-to; renders hidden until invoked. */}
            <CommandPalette />
        </MeProvider>
    )
}

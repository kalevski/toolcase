'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { SubTabBar } from '@/components/SubTabBar'
import { ADMIN_TABS } from './shared'

// Admin landing hub (plan WS-5 / P2). `/admin` used to bounce straight to Sites;
// this gives the owner a real entry point with one card per area. Owner-gated
// client-side (every /api/admin/** route is independently owner-gated server-side).
// The hand-rolled link-card grid is now a tc-feature-card grid laid out by tc-grid
// (both attribute-driven, no slot relocation), with the shared admin tc-tab-bar on
// top for parity with every other admin page.

// tc-feature-card resolves its `icon` attribute by a DIRECT lucide-static lookup
// (PascalCase), unlike the side-nav / tab-bar which accept kebab names.
const AREAS = [
    {
        href: '/admin/sites',
        label: 'Sites',
        icon: 'LayoutDashboard',
        desc: 'Moderate every site across all tenants — suspend or resume.',
    },
    { href: '/admin/users', label: 'Users', icon: 'Users', desc: 'Grant roles and override per-user quotas.' },
    {
        href: '/admin/realms',
        label: 'Realms',
        icon: 'Server',
        desc: 'The nginxpilot instances this control plane drives.',
    },
    { href: '/admin/domains', label: 'Domains', icon: 'Globe', desc: 'The subdomain pool, grouped by audience tier.' },
    {
        href: '/admin/certificates',
        label: 'Certificates',
        icon: 'ShieldCheck',
        desc: 'TLS certificates nginxpilot discovered, with expiry.',
    },
    {
        href: '/admin/plans',
        label: 'Plans',
        icon: 'CreditCard',
        desc: 'Map monthly sponsorship thresholds to paid plans.',
    },
    {
        href: '/admin/settings',
        label: 'Settings',
        icon: 'Settings',
        desc: 'Branding, theme, and the custom-domain server IP.',
    },
    { href: '/admin/audit', label: 'Audit', icon: 'ScrollText', desc: 'Immutable trail of every owner mutation.' },
]

export function AdminHome() {
    const me = useMe()
    const router = useRouter()

    useEffect(() => {
        if (me.role !== 'owner') router.replace('/')
    }, [me.role, router])

    if (me.role !== 'owner') return null

    return (
        <section className="perch-admin">
            <tc-rich-page-header
                title-text="Admin"
                description="Owner controls for this Perch instance."
                icon-name="shield"
                icon-color="violet"
            />
            <SubTabBar tabs={ADMIN_TABS} />
            {/* tc-grid owns the mobile-first column cascade (1 → sm 2 → lg 3);
                each card is an attribute-driven tc-feature-card. */}
            <tc-grid columns="1" columns-sm="2" columns-lg="3" gap="1rem" className="perch-admin-hub">
                {AREAS.map((a) => (
                    <tc-feature-card
                        key={a.href}
                        role="link"
                        tabIndex={0}
                        icon={a.icon}
                        title={a.label}
                        description={a.desc}
                        className="perch-admin-hub-card"
                        onClick={() => router.push(a.href)}
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                router.push(a.href)
                            }
                        }}
                    />
                ))}
            </tc-grid>
        </section>
    )
}

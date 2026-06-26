'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'

// Admin landing hub (plan WS-5). `/admin` used to bounce straight to Sites; this
// gives the owner a real entry point with one card per area. Owner-gated client-
// side (every /api/admin/** route is independently owner-gated server-side).

const AREAS = [
    { href: '/admin/sites', label: 'Sites', desc: 'Moderate every site across all tenants — suspend or resume.' },
    { href: '/admin/users', label: 'Users', desc: 'Grant roles and override per-user quotas.' },
    { href: '/admin/domains', label: 'Domains', desc: 'The subdomain pool, grouped by audience tier.' },
    { href: '/admin/plans', label: 'Plans', desc: 'Map monthly sponsorship thresholds to paid plans.' },
    { href: '/admin/audit', label: 'Audit', desc: 'Immutable trail of every owner mutation.' },
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
            <header className="perch-home-header">
                <h1 className="perch-home-title">Admin</h1>
                <p className="perch-home-lead">Owner controls for this Perch instance.</p>
            </header>
            <div className="perch-admin-hub">
                {AREAS.map((a) => (
                    <Link key={a.href} className="perch-admin-hub-card" href={a.href}>
                        <span className="perch-admin-hub-label">{a.label}</span>
                        <span className="perch-admin-hub-desc">{a.desc}</span>
                    </Link>
                ))}
            </div>
        </section>
    )
}

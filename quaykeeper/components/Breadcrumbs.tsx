'use client'

import { usePathname } from 'next/navigation'

// Breadcrumb trail under the navbar (plan WS-5). Top-level pages already carry
// their own H1, so the trail only renders for nested locations (a site detail,
// the routing pages, the admin sub-pages). tc-breadcrumb / tc-breadcrumb-item
// are declarative (href + active attributes), so this is plain JSX — no
// lib/tc.ts bridge needed. Item links navigate natively.
//
// Labels mirror the side-nav (AppShell / ADMIN_TABS) verbatim — the sidebar is
// the naming source of truth.

type Crumb = { label: string; href?: string }

const ADMIN_LABELS: Record<string, string> = {
    sites: 'Sites',
    users: 'Users',
    realms: 'NGINX Servers',
    'db-servers': 'DB Servers',
    domains: 'Domains',
    certificates: 'Certificates',
    'global-vars': 'Global variables',
    secrets: 'Secrets',
    settings: 'Settings',
    audit: 'Audit',
}

function trailFor(pathname: string): Crumb[] {
    if (pathname.startsWith('/sites/')) return [{ label: 'Static Sites', href: '/' }, { label: 'Site' }]
    if (pathname.startsWith('/instances/')) return [{ label: 'Variables', href: '/instances' }, { label: 'Instance' }]
    if (pathname.startsWith('/databases/')) return [{ label: 'Databases', href: '/databases' }, { label: 'Server' }]
    if (pathname.startsWith('/proxies')) return [{ label: 'Routing' }, { label: 'Proxies' }]
    if (pathname.startsWith('/admin')) {
        const seg = pathname.split('/')[2]
        const trail: Crumb[] = [{ label: 'Admin', href: '/admin' }]
        if (seg && ADMIN_LABELS[seg]) trail.push({ label: ADMIN_LABELS[seg] })
        return trail
    }
    return []
}

export function Breadcrumbs() {
    const pathname = usePathname()
    const trail = trailFor(pathname)
    if (trail.length < 2) return null

    return (
        <nav aria-label="Breadcrumb" className="quaykeeper-breadcrumbs">
            <tc-breadcrumb>
                {trail.map((c, i) => (
                    <tc-breadcrumb-item key={i} href={c.href} active={i === trail.length - 1 || undefined}>
                        {c.label}
                    </tc-breadcrumb-item>
                ))}
            </tc-breadcrumb>
        </nav>
    )
}

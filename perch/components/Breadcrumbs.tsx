'use client'

import { usePathname } from 'next/navigation'

// Breadcrumb trail under the navbar (plan WS-5). Top-level pages (Sites, Plans)
// already carry their own H1, so the trail only renders for nested locations
// (a site detail, the routing pages, the admin sub-pages). tc-breadcrumb /
// tc-breadcrumb-item are declarative (href + active attributes), so this is plain
// JSX — no lib/tc.ts bridge needed. Item links navigate natively.

type Crumb = { label: string; href?: string }

const ADMIN_LABELS: Record<string, string> = {
    sites: 'Sites',
    users: 'Users',
    domains: 'Domains',
    plans: 'Plans',
    audit: 'Audit',
}

function trailFor(pathname: string): Crumb[] {
    if (pathname.startsWith('/sites/')) return [{ label: 'Sites', href: '/' }, { label: 'Site' }]
    if (pathname.startsWith('/proxies')) return [{ label: 'Routing' }, { label: 'Proxies' }]
    if (pathname.startsWith('/upstreams')) return [{ label: 'Routing' }, { label: 'Upstreams' }]
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
        <nav aria-label="Breadcrumb" className="perch-breadcrumbs">
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

'use client'

// Breadcrumb trail under the shell header on nested routes (Modernization).
// tc-breadcrumb / tc-breadcrumb-item are declarative (href + active attributes),
// so this is plain JSX. The element relocates its slotted crumbs into an inner
// <ol> on connect, which fights React reconciliation across the persistent shell
// — so AppShell renders this with a key tied to the pathname for a clean remount
// on every navigation (the "keyed remount for dynamic headers" rule).

export type Crumb = { label: string; href?: string }

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
    if (trail.length < 2) return null
    return (
        <nav aria-label="Breadcrumb" className="wharf-breadcrumbs">
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

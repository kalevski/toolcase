'use client'

import { useRouter } from 'next/navigation'

// tc-nav-button is purpose-built for this exact pattern (a chevron-left icon
// button styled to the design system) — replaces the old raw
// `<button className="quaykeeper-back">` text link used identically across
// SiteDetail, DbServerDetail, and InstanceDetail.
export function BackButton({ href, label }: { href: string; label: string }) {
    const router = useRouter()
    return <tc-nav-button kind="back" label={`Back to ${label}`} onClick={() => router.push(href)} />
}

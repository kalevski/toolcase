'use client'

import { useCallback, useMemo } from 'react'
import type { ActivityItem } from '@toolcase/web-components'
import { useTcProps } from '@/lib/tc'
import type { AuditEntry } from '@/server/domain/types'
import { AdminPage, json, useOwnerData } from './shared'

// Owner-only audit feed (§12/§13). The append-only log of every owner mutation
// and quota event, newest-first, rendered as a `tc-activity-card`.

export function AdminAudit() {
    const fetcher = useCallback(async (): Promise<AuditEntry[] | null> => {
        try {
            return await fetch('/api/admin/audit', { cache: 'no-store' }).then((r) => json<AuditEntry[]>(r))
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Audit"
            subtitle="The append-only trail of owner actions and quota events. Owner-only."
            icon="scroll-text"
            iconColor="amber"
            state={state}
            onRetry={() => void reload()}
        >
            {(audit) => <AuditFeed audit={audit} />}
        </AdminPage>
    )
}

// Map an audit action to a lucide glyph (PascalCase — tc-activity-card resolves
// names against the lucide-static export map, falling back to Circle).
function auditIcon(action: string): string {
    if (action.includes('suspend')) return 'OctagonX'
    if (action.includes('base_domain')) return 'Globe'
    if (action.includes('plan_tier')) return 'CreditCard'
    if (action.includes('site')) return 'LayoutDashboard'
    return 'ScrollText'
}

function AuditFeed({ audit }: { audit: AuditEntry[] }) {
    const activities = useMemo<ActivityItem[]>(
        () =>
            audit.map((e) => {
                const actor = e.login ?? 'system'
                const detailParts = [e.detail, e.site ? `site ${e.site}` : null].filter(Boolean)
                return {
                    id: String(e.id),
                    icon: auditIcon(e.action),
                    title: `${actor} · ${e.action}`,
                    description: detailParts.join(' — ') || undefined,
                    timestamp: String(e.at).replace('T', ' ').slice(0, 19),
                }
            }),
        [audit],
    )
    const ref = useTcProps<HTMLElement>(useMemo(() => ({ activities }), [activities]))

    return (
        <tc-section-card title="Audit feed" icon="scroll-text">
            <div className="perch-admin-section">
                {audit.length === 0 ? (
                    <tc-empty-state icon="scroll-text">No audit entries yet.</tc-empty-state>
                ) : (
                    <tc-activity-card ref={ref} />
                )}
            </div>
        </tc-section-card>
    )
}

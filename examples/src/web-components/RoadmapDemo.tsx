import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const COLUMNS = [
    {
        status: 'shipped',
        items: [
            { title: 'Dark mode', description: 'System-aware theme with manual override.', tags: ['ui', 'v2.1'] },
            { title: 'CSV export', description: 'Stream large tables without blocking.', tags: ['data'] },
            { title: 'SSO login', tags: ['auth', 'enterprise'] },
        ],
    },
    {
        status: 'in-progress',
        items: [
            { title: 'Realtime presence', description: 'Cursors and selections across collaborators.', tags: ['rt'] },
            { title: 'Audit log viewer', description: 'Filterable, paginated activity stream.', tags: ['security'] },
        ],
    },
    {
        status: 'planned',
        items: [
            { title: 'Mobile app', description: 'Native iOS and Android clients.', tags: ['mobile'] },
            { title: 'Webhooks v2', tags: ['api'] },
        ],
    },
    {
        status: 'considering',
        items: [
            { title: 'Offline mode', description: 'Local-first sync with conflict resolution.', tags: ['research'] },
        ],
    },
]

const STACKED_COLUMNS = [
    {
        status: 'shipped',
        title: 'Done',
        items: [
            { title: 'Billing portal', description: 'Self-serve plan changes and invoices.', tags: ['billing'] },
        ],
    },
    {
        status: 'in-progress',
        title: 'Building now',
        items: [
            { title: 'Template gallery', description: 'Curated starting points for new projects.', tags: ['onboarding'] },
            { title: 'Bulk actions', tags: ['ux'] },
        ],
    },
    {
        status: 'considering',
        title: 'Ideas',
        items: [
            { title: 'AI summaries', description: 'One-click recaps of long threads.', tags: ['ai'] },
        ],
    },
]

const RoadmapDemo: React.FC = () => {
    const kanbanRef = useRef<any>(null)
    const stackedRef = useRef<any>(null)
    const [selected, setSelected] = useState<string>('—')

    useEffect(() => {
        if (kanbanRef.current) kanbanRef.current.columns = COLUMNS
        if (stackedRef.current) stackedRef.current.columns = STACKED_COLUMNS

        const onSelect = (e: Event) => {
            const detail = (e as CustomEvent).detail
            setSelected(`${detail.item.title} (${detail.columnStatus})`)
        }
        const kanban = kanbanRef.current
        kanban?.addEventListener('tc-select', onSelect)
        return () => kanban?.removeEventListener('tc-select', onSelect)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Roadmap"
                            description="Kanban or stacked roadmap board with status columns (shipped / in-progress / planned / considering) and per-column item counts. Status is conveyed by a dot + text label, not color alone. Items are clickable buttons that emit tc-select."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Kanban layout — four status columns, clickable items">
                                {/* @ts-ignore */}
                                <tc-roadmap
                                    ref={kanbanRef}
                                    layout="kanban"
                                    title-text="Product Roadmap — 2026"
                                />
                                <p className="mt-3 mb-0 text-body-secondary small">
                                    Last selected: <strong>{selected}</strong>
                                </p>
                            </SectionCard>

                            <SectionCard title="Stacked layout — custom column titles">
                                {/* @ts-ignore */}
                                <tc-roadmap ref={stackedRef} layout="stacked" />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RoadmapDemo

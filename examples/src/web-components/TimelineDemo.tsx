import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const ITEMS_DEFAULT = [
    {
        title: 'Project kickoff',
        date: '2026-01-10',
        description: 'Aligned on scope, timelines, and stakeholders.',
        status: 'completed',
        icon: 'FlagTriangleRight',
        badge: 'Milestone',
        meta: 'Q1 2026',
    },
    {
        title: 'Design sprint',
        date: '2026-01-24',
        description: 'Wireframes, prototypes, and design-system tokens finalized.',
        status: 'completed',
        icon: 'Pen',
        tags: ['UX', 'Figma'],
    },
    {
        title: 'Alpha release',
        date: '2026-03-01',
        description: 'Core feature set shipped to internal testers.',
        status: 'active',
        icon: 'Rocket',
        badge: 'In progress',
        progress: 65,
    },
    {
        title: 'Public beta',
        date: '2026-04-15',
        description: 'Open beta with external user group.',
        status: 'upcoming',
        tags: ['Beta', 'Users'],
    },
    {
        title: 'GA launch',
        date: '2026-06-01',
        status: 'upcoming',
        badge: 'Planned',
    },
]

const ITEMS_VARIANTS = [
    {
        title: 'Sprint planning',
        date: 'Jan 6',
        description: 'Backlog groomed and tasks assigned.',
        status: 'completed',
    },
    {
        title: 'Development',
        date: 'Jan 13',
        description: 'Feature work and code reviews.',
        status: 'active',
        progress: 40,
    },
    {
        title: 'QA & staging',
        date: 'Jan 20',
        description: 'End-to-end tests on staging environment.',
        status: 'upcoming',
    },
    { title: 'Release', date: 'Jan 27', status: 'upcoming' },
]

const ITEMS_STATUS = [
    {
        title: 'Requirements locked',
        date: '2026-05-01',
        status: 'completed',
        subtitle: 'Product team sign-off',
    },
    {
        title: 'Engineering kicked off',
        date: '2026-05-08',
        status: 'active',
        subtitle: 'Sprint 1 of 4',
        accentColor: 'var(--tc-accent)',
    },
    {
        title: 'Code freeze',
        date: '2026-05-29',
        status: 'upcoming',
        subtitle: 'No new features after this point',
    },
    {
        title: 'Launch day',
        date: '2026-06-05',
        status: 'upcoming',
        badge: 'Target',
        meta: 'v3.0.0',
    },
]

const TimelineDemo: React.FC = () => {
    const defaultRef = useTc<HTMLElement>({ items: ITEMS_DEFAULT })
    const glassRef = useTc<HTMLElement>({ items: ITEMS_VARIANTS })
    const outlinedRef = useTc<HTMLElement>({ items: ITEMS_VARIANTS })
    const elevatedRef = useTc<HTMLElement>({ items: ITEMS_VARIANTS })
    const minimalRef = useTc<HTMLElement>({ items: ITEMS_VARIANTS })
    const solidRef = useTc<HTMLElement>({ items: ITEMS_VARIANTS })
    const dashedRef = useTc<HTMLElement>({ items: ITEMS_VARIANTS })
    const statusRef = useTc<HTMLElement>({ items: ITEMS_STATUS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Timeline"
                            description="Vertical timeline of chronological events with icons, statuses, badges, tags, and progress bars. Set items via the JS items property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default variant — gradient connector">
                                {/* @ts-ignore */}
                                <tc-timeline ref={defaultRef} />
                            </tc-section-card>

                            <tc-section-card title="Statuses, accent color, and meta">
                                {/* @ts-ignore */}
                                <tc-timeline ref={statusRef} connector="solid" />
                            </tc-section-card>

                            <tc-section-card title="Variant: glass">
                                {/* @ts-ignore */}
                                <tc-timeline ref={glassRef} variant="glass" />
                            </tc-section-card>

                            <tc-section-card title="Variant: outlined">
                                {/* @ts-ignore */}
                                <tc-timeline
                                    ref={outlinedRef}
                                    variant="outlined"
                                    connector="dashed"
                                />
                            </tc-section-card>

                            <tc-section-card title="Variant: elevated">
                                {/* @ts-ignore */}
                                <tc-timeline
                                    ref={elevatedRef}
                                    variant="elevated"
                                    connector="solid"
                                />
                            </tc-section-card>

                            <tc-section-card title="Variant: minimal">
                                {/* @ts-ignore */}
                                <tc-timeline ref={minimalRef} variant="minimal" />
                            </tc-section-card>

                            <tc-section-card title="Connector: solid">
                                {/* @ts-ignore */}
                                <tc-timeline ref={solidRef} connector="solid" />
                            </tc-section-card>

                            <tc-section-card title="Connector: dashed">
                                {/* @ts-ignore */}
                                <tc-timeline ref={dashedRef} connector="dashed" />
                            </tc-section-card>

                            <tc-section-card title="Loading state — default count (3 rows)">
                                {/* @ts-ignore */}
                                <tc-timeline loading />
                            </tc-section-card>

                            <tc-section-card title="Loading state — 5 rows">
                                {/* @ts-ignore */}
                                <tc-timeline loading loading-count="5" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TimelineDemo

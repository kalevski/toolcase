import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ENTRIES_FULL = [
    {
        date: '2026-06-01',
        title: 'v3.0.0 — Major release',
        description: 'Complete redesign of the component library with new SCSS tokens, improved accessibility, and a framework-free Web Components layer.',
        tags: ['breaking', 'feature', 'a11y'],
    },
    {
        date: '2026-04-15',
        title: 'v2.8.0 — Timeline component',
        description: 'Added tc-timeline with alternating left/right layout, icon nodes, status dots, and progress bars.',
        tags: ['feature'],
    },
    {
        date: '2026-03-02',
        title: 'v2.7.0 — Form primitives',
        description: 'Shipped tc-input, tc-select, tc-check, tc-radio, tc-switch, tc-range, and tc-floating-label with full keyboard support.',
        tags: ['feature'],
    },
    {
        date: '2026-01-18',
        title: 'v2.6.2 — Accessibility fixes',
        description: 'Fixed focus-visible outlines across all interactive elements and added aria-live regions to toast notifications.',
        tags: ['fix', 'a11y'],
    },
    {
        date: '2025-12-10',
        title: 'v2.6.0 — Pagination and Navigation',
        description: 'Added tc-pagination, tc-breadcrumb, tc-nav, tc-navbar, and tc-scrollspy.',
        tags: ['feature'],
    },
]

const ENTRIES_SHORT = [
    {
        date: '2026-06-01',
        title: 'v3.0.0 — Major release',
        description: 'Complete redesign of the component library.',
        tags: ['breaking', 'feature'],
    },
    {
        date: '2026-04-15',
        title: 'v2.8.0 — Timeline component',
        description: 'Added tc-timeline with icons and progress bars.',
        tags: ['feature'],
    },
    {
        date: '2026-03-02',
        title: 'v2.7.0 — Form primitives',
        description: 'Shipped tc-input, tc-select, tc-check, and more.',
        tags: ['feature'],
    },
]

const ChangelogDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const truncatedRef = useRef<any>(null)

    useEffect(() => {
        if (fullRef.current) fullRef.current.entries = ENTRIES_FULL
        if (truncatedRef.current) truncatedRef.current.entries = ENTRIES_SHORT
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Changelog"
                            description="Vertical changelog timeline with dates, titles, descriptions, and tags. Set entries via the JS entries property. Supports max-visible truncation with a read-more link and a loading skeleton."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Full changelog (5 entries, all visible)">
                                {/* @ts-ignore */}
                                <tc-changelog ref={fullRef} />
                            </SectionCard>

                            <SectionCard title="Truncated — max-visible=2 with read-more link">
                                {/* @ts-ignore */}
                                <tc-changelog
                                    ref={truncatedRef}
                                    max-visible="2"
                                    read-more-href="#changelog"
                                    read-more-label="View full changelog →"
                                />
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-changelog loading />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChangelogDemo

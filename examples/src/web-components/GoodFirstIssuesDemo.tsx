import React, { useRef } from 'react'
import { useTc } from '@toolcase/web-components/react'

const SAMPLE_ISSUES = [
    {
        title: 'Add dark mode support to the theme switcher',
        url: 'https://github.com/kalevski/toolcase/issues/42',
        repo: 'kalevski/toolcase',
        labels: [
            { name: 'good first issue', color: '#7057ff' },
            { name: 'enhancement', color: '#a2eeef' },
        ],
        comments: 3,
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        title: 'Fix typo in README installation section',
        url: 'https://github.com/kalevski/toolcase/issues/38',
        repo: 'kalevski/toolcase',
        labels: [
            { name: 'good first issue', color: '#7057ff' },
            { name: 'documentation', color: '#0075ca' },
        ],
        comments: 1,
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        title: 'Export missing type definitions from index.ts',
        url: 'https://github.com/kalevski/toolcase/issues/31',
        repo: 'kalevski/toolcase',
        labels: [
            { name: 'good first issue', color: '#7057ff' },
            { name: 'bug', color: '#d73a4a' },
        ],
        comments: 7,
        updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        title: 'Add aria-label to icon-only buttons in Navbar',
        url: 'https://github.com/kalevski/toolcase/issues/27',
        repo: 'kalevski/toolcase',
        labels: [
            { name: 'good first issue', color: '#7057ff' },
            { name: 'accessibility', color: '#e4e669' },
        ],
        comments: 0,
        updatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
]

const GoodFirstIssuesDemo: React.FC = () => {
    const emptyDefaultRef = useRef<any>(null)
    const emptySlottedRef = useRef<any>(null)
    const lastClickRef = useRef<HTMLSpanElement>(null)

    const defaultRef = useTc<HTMLElement>({ issues: SAMPLE_ISSUES })
    const titledRef = useTc<HTMLElement>({ issues: SAMPLE_ISSUES.slice(0, 2) })
    const slottedTitleRef = useTc<HTMLElement>({ issues: SAMPLE_ISSUES.slice(0, 2) })
    const eventRef = useTc<HTMLElement>(
        { issues: SAMPLE_ISSUES.slice(0, 2) },
        {
            'tc-issue-click': (e: CustomEvent) => {
                if (lastClickRef.current) {
                    lastClickRef.current.textContent = e.detail.issue.title
                }
            },
        },
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="GoodFirstIssues"
                            description="Bordered list of GitHub good-first-issue items with title links, labels, comment count, and relative update time. Set issues via the JS issues property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (no header)">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={defaultRef} />
                            </tc-section-card>

                            <tc-section-card title="With title attribute">
                                {/* @ts-ignore */}
                                <tc-good-first-issues
                                    ref={titledRef}
                                    title="Open for contributions"
                                />
                            </tc-section-card>

                            <tc-section-card title="With slot=title">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={slottedTitleRef}>
                                    <strong slot="title">Good First Issues</strong>
                                </tc-good-first-issues>
                            </tc-section-card>

                            <tc-section-card title="Empty state — default message">
                                {/* @ts-ignore */}
                                <tc-good-first-issues
                                    ref={emptyDefaultRef}
                                    title="Contributions welcome"
                                />
                            </tc-section-card>

                            <tc-section-card title="Empty state — slot=empty">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={emptySlottedRef} title="Nothing yet">
                                    <span slot="empty">All caught up — check back later.</span>
                                </tc-good-first-issues>
                            </tc-section-card>

                            <tc-section-card title="tc-issue-click event">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={eventRef} title="Click an issue title" />
                                <p
                                    className="mt-3 mb-0"
                                    style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}
                                >
                                    Last clicked:{' '}
                                    <span ref={lastClickRef} style={{ fontStyle: 'italic' }}>
                                        —
                                    </span>
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GoodFirstIssuesDemo

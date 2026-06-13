import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

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
    const defaultRef = useRef<any>(null)
    const titledRef = useRef<any>(null)
    const slottedTitleRef = useRef<any>(null)
    const emptyDefaultRef = useRef<any>(null)
    const emptySlottedRef = useRef<any>(null)
    const eventRef = useRef<any>(null)
    const lastClickRef = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        if (defaultRef.current) {
            defaultRef.current.issues = SAMPLE_ISSUES
        }
    }, [])

    useEffect(() => {
        if (titledRef.current) {
            titledRef.current.issues = SAMPLE_ISSUES.slice(0, 2)
        }
    }, [])

    useEffect(() => {
        if (slottedTitleRef.current) {
            slottedTitleRef.current.issues = SAMPLE_ISSUES.slice(0, 2)
        }
    }, [])

    useEffect(() => {
        if (eventRef.current) {
            eventRef.current.issues = SAMPLE_ISSUES.slice(0, 2)
            eventRef.current.addEventListener('tc-issue-click', (e: CustomEvent) => {
                if (lastClickRef.current) {
                    lastClickRef.current.textContent = e.detail.issue.title
                }
            })
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="GoodFirstIssues"
                            description="Bordered list of GitHub good-first-issue items with title links, labels, comment count, and relative update time. Set issues via the JS issues property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Default (no header)">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={defaultRef} />
                            </SectionCard>

                            <SectionCard title="With title attribute">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={titledRef} title="Open for contributions" />
                            </SectionCard>

                            <SectionCard title="With slot=title">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={slottedTitleRef}>
                                    <strong slot="title">Good First Issues</strong>
                                </tc-good-first-issues>
                            </SectionCard>

                            <SectionCard title="Empty state — default message">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={emptyDefaultRef} title="Contributions welcome" />
                            </SectionCard>

                            <SectionCard title="Empty state — slot=empty">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={emptySlottedRef} title="Nothing yet">
                                    <span slot="empty">All caught up — check back later.</span>
                                </tc-good-first-issues>
                            </SectionCard>

                            <SectionCard title="tc-issue-click event">
                                {/* @ts-ignore */}
                                <tc-good-first-issues ref={eventRef} title="Click an issue title" />
                                <p className="mt-3 mb-0" style={{ fontSize: '0.875rem', color: 'var(--tc-text-muted)' }}>
                                    Last clicked: <span ref={lastClickRef} style={{ fontStyle: 'italic' }}>—</span>
                                </p>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GoodFirstIssuesDemo

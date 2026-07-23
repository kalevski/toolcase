import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const SprintChainDemo: React.FC = () => {
    const basicRef = useTc<HTMLElement>({
        items: [
            { id: 'sp1', label: 'Sprint 1' },
            { id: 'sp2', label: 'Sprint 2' },
            { id: 'sp3', label: 'Sprint 3' },
            { id: 'sp4', label: 'Sprint 4' },
        ],
    })

    const taggedRef = useTc<HTMLElement>({
        items: [
            { id: 'sp1', label: 'Sprint 1', tag: 'v1.0.0' },
            { id: 'sp2', label: 'Sprint 2', tag: 'v1.1.0' },
            { id: 'sp3', label: 'Sprint 3', tag: 'v1.2.0' },
            { id: 'sp4', label: 'Sprint 4', tag: 'v2.0.0' },
            { id: 'sp5', label: 'Sprint 5', tag: 'v2.1.0' },
        ],
    })

    const columnsRef = useTc<HTMLElement>({
        items: [
            { id: 'q1', label: 'Q1 Sprint 1', tag: 'Jan' },
            { id: 'q2', label: 'Q1 Sprint 2', tag: 'Feb' },
            { id: 'q3', label: 'Q1 Sprint 3', tag: 'Mar' },
            { id: 'q4', label: 'Q2 Sprint 1', tag: 'Apr' },
            { id: 'q5', label: 'Q2 Sprint 2', tag: 'May' },
            { id: 'q6', label: 'Q2 Sprint 3', tag: 'Jun' },
        ],
    })

    const explicitRef = useTc<HTMLElement>({
        items: [
            { id: 'a', label: 'Discovery', state: 'past' },
            { id: 'b', label: 'Design', state: 'past' },
            { id: 'c', label: 'Build', state: 'now' },
            { id: 'd', label: 'Review', state: 'future' },
            { id: 'e', label: 'Ship', state: 'future' },
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SprintChain"
                            description="Timeline/chain visualization of sprint items with past, now, and future states. Set items via the JS items property; current item derived from the current-id attribute."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic chain (current-id derives states)">
                                {/* @ts-ignore */}
                                <tc-sprint-chain ref={basicRef} current-id="sp2" />
                            </tc-section-card>

                            <tc-section-card title="With tags and header slots">
                                {/* @ts-ignore */}
                                <tc-sprint-chain ref={taggedRef} current-id="sp3">
                                    <span slot="header">Release roadmap</span>
                                    <span slot="header-end">FY 2026</span>
                                </tc-sprint-chain>
                            </tc-section-card>

                            <tc-section-card title="Multi-row with columns=3">
                                {/* @ts-ignore */}
                                <tc-sprint-chain ref={columnsRef} current-id="q4" columns="3">
                                    <span slot="header">Quarterly sprints</span>
                                </tc-sprint-chain>
                            </tc-section-card>

                            <tc-section-card title="Explicit per-item state override">
                                {/* @ts-ignore */}
                                <tc-sprint-chain ref={explicitRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SprintChainDemo

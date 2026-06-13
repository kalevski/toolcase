import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SprintChainDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const taggedRef = useRef<any>(null)
    const columnsRef = useRef<any>(null)
    const explicitRef = useRef<any>(null)

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.items = [
            { id: 'sp1', label: 'Sprint 1' },
            { id: 'sp2', label: 'Sprint 2' },
            { id: 'sp3', label: 'Sprint 3' },
            { id: 'sp4', label: 'Sprint 4' },
        ]
    }, [])

    useEffect(() => {
        if (!taggedRef.current) return
        taggedRef.current.items = [
            { id: 'sp1', label: 'Sprint 1', tag: 'v1.0.0' },
            { id: 'sp2', label: 'Sprint 2', tag: 'v1.1.0' },
            { id: 'sp3', label: 'Sprint 3', tag: 'v1.2.0' },
            { id: 'sp4', label: 'Sprint 4', tag: 'v2.0.0' },
            { id: 'sp5', label: 'Sprint 5', tag: 'v2.1.0' },
        ]
    }, [])

    useEffect(() => {
        if (!columnsRef.current) return
        columnsRef.current.items = [
            { id: 'q1', label: 'Q1 Sprint 1', tag: 'Jan' },
            { id: 'q2', label: 'Q1 Sprint 2', tag: 'Feb' },
            { id: 'q3', label: 'Q1 Sprint 3', tag: 'Mar' },
            { id: 'q4', label: 'Q2 Sprint 1', tag: 'Apr' },
            { id: 'q5', label: 'Q2 Sprint 2', tag: 'May' },
            { id: 'q6', label: 'Q2 Sprint 3', tag: 'Jun' },
        ]
    }, [])

    useEffect(() => {
        if (!explicitRef.current) return
        explicitRef.current.items = [
            { id: 'a', label: 'Discovery', state: 'past' },
            { id: 'b', label: 'Design', state: 'past' },
            { id: 'c', label: 'Build', state: 'now' },
            { id: 'd', label: 'Review', state: 'future' },
            { id: 'e', label: 'Ship', state: 'future' },
        ]
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="SprintChain"
                            description="Timeline/chain visualization of sprint items with past, now, and future states. Set items via the JS items property; current item derived from the current-id attribute."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic chain (current-id derives states)">
                                {/* @ts-ignore */}
                                <tc-sprint-chain ref={basicRef} current-id="sp2" />
                            </SectionCard>

                            <SectionCard title="With tags and header slots">
                                {/* @ts-ignore */}
                                <tc-sprint-chain ref={taggedRef} current-id="sp3">
                                    <span slot="header">Release roadmap</span>
                                    <span slot="header-end">FY 2026</span>
                                </tc-sprint-chain>
                            </SectionCard>

                            <SectionCard title="Multi-row with columns=3">
                                {/* @ts-ignore */}
                                <tc-sprint-chain ref={columnsRef} current-id="q4" columns="3">
                                    <span slot="header">Quarterly sprints</span>
                                </tc-sprint-chain>
                            </SectionCard>

                            <SectionCard title="Explicit per-item state override">
                                {/* @ts-ignore */}
                                <tc-sprint-chain ref={explicitRef} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SprintChainDemo

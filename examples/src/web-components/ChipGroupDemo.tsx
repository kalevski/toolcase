import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ChipGroupDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const borderedRef = useRef<any>(null)
    const subtitleRef = useRef<any>(null)
    const toggleLogRef = useRef<any>(null)

    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        el.items = [
            { id: 'react', label: 'React', selected: true },
            { id: 'typescript', label: 'TypeScript', selected: true },
            { id: 'nodejs', label: 'Node.js' },
            { id: 'rust', label: 'Rust', icon: 'Zap' },
            { id: 'graphql', label: 'GraphQL', count: 12 },
            { id: 'legacy', label: 'Legacy', disabled: true },
        ]
        const handler = (e: CustomEvent) => {
            console.log('[tc-toggle] id:', e.detail.id)
        }
        el.addEventListener('tc-toggle', handler)
        return () => el.removeEventListener('tc-toggle', handler)
    }, [])

    useEffect(() => {
        const el = borderedRef.current
        if (!el) return
        el.items = [
            { id: 'frontend', label: 'Frontend', selected: true, variant: 'primary' },
            { id: 'backend', label: 'Backend', variant: 'info' },
            { id: 'devops', label: 'DevOps', variant: 'success' },
            { id: 'design', label: 'Design', count: 3 },
        ]
    }, [])

    useEffect(() => {
        const el = subtitleRef.current
        if (!el) return
        el.items = [
            { id: 'bug', label: 'Bug', icon: 'Bug', variant: 'danger' },
            { id: 'feature', label: 'Feature', icon: 'Star', variant: 'success' },
            { id: 'docs', label: 'Docs', icon: 'FileText' },
            { id: 'chore', label: 'Chore', icon: 'Settings' },
        ]
    }, [])

    useEffect(() => {
        const el = toggleLogRef.current
        if (!el) return
        el.items = [
            { id: 'a', label: 'Alpha' },
            { id: 'b', label: 'Beta', selected: true },
            { id: 'c', label: 'Gamma' },
        ]
        el.onToggle = (id: string) => {
            console.log('[onToggle callback] id:', id)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ChipGroup"
                            description="Grouped set of interactive chip buttons with optional title, subtitle, and border frame. Composes tc-chip internally. Dispatches tc-toggle with the item id when a chip is activated."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic (tc-toggle logged to console)">
                                {/* @ts-ignore */}
                                <tc-chip-group ref={basicRef} title="Tags" />
                            </SectionCard>

                            <SectionCard title="Bordered with title">
                                {/* @ts-ignore */}
                                <tc-chip-group ref={borderedRef} title="Teams" border />
                            </SectionCard>

                            <SectionCard title="With title and subtitle (bordered)">
                                {/* @ts-ignore */}
                                <tc-chip-group ref={subtitleRef} title="Issue labels" subtitle="Select one or more labels to filter by" border />
                            </SectionCard>

                            <SectionCard title="onToggle callback property (logged to console)">
                                {/* @ts-ignore */}
                                <tc-chip-group ref={toggleLogRef} title="Options" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChipGroupDemo

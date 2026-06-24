import React, { useEffect, useRef } from 'react'

const ComparatorDemo: React.FC = () => {
    const fullRef = useRef<any>(null)
    const noSummaryRef = useRef<any>(null)
    const valueRef = useRef<any>(null)
    const minimalRef = useRef<any>(null)

    useEffect(() => {
        if (!fullRef.current) return
        fullRef.current.left = { name: 'React', icon: 'layers', label: 'Meta' }
        fullRef.current.right = { name: 'Vue', icon: 'triangle', label: 'Evan You' }
        fullRef.current.features = [
            { label: 'TypeScript support', left: true, right: true },
            { label: 'SSR support', left: true, right: true },
            { label: 'Server components', left: true, right: false },
            {
                label: 'Built-in state management',
                left: false,
                right: true,
                description: 'Vue ships Pinia by default',
            },
            { label: 'Two-way data binding', left: false, right: true },
            { label: 'Virtual DOM', left: true, right: true },
            { label: 'Mobile framework', left: false, right: false },
        ]
    }, [])

    useEffect(() => {
        if (!noSummaryRef.current) return
        noSummaryRef.current.left = { name: 'PostgreSQL', icon: 'database' }
        noSummaryRef.current.right = { name: 'SQLite', icon: 'hard-drive' }
        noSummaryRef.current.features = [
            { label: 'Full ACID transactions', left: true, right: true },
            { label: 'Multi-user support', left: true, right: false },
            { label: 'Embedded mode', left: false, right: true },
            { label: 'JSON support', left: true, right: true },
        ]
    }, [])

    useEffect(() => {
        if (!valueRef.current) return
        valueRef.current.left = { name: 'Node.js', icon: 'server' }
        valueRef.current.right = { name: 'Deno', icon: 'shield' }
        valueRef.current.features = [
            { label: 'GitHub stars', left: 105000, right: 93000, description: 'Approximate count' },
            { label: 'npm packages available', left: 2100000, right: 5000 },
            { label: 'Cold start time (ms)', left: 50, right: 30 },
            { label: 'TypeScript native', left: false, right: true },
            { label: 'Built-in permission model', left: false, right: true },
        ]
    }, [])

    useEffect(() => {
        if (!minimalRef.current) return
        minimalRef.current.left = { name: 'Alpha' }
        minimalRef.current.right = { name: 'Beta' }
        minimalRef.current.features = [
            { label: 'Speed', left: true, right: false },
            { label: 'Cost', left: false, right: true },
        ]
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Comparator"
                            description="Side-by-side comparison table for two technologies with auto winner detection and summary stats."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Boolean features — React vs Vue (with summary)">
                                {/* @ts-ignore */}
                                <tc-comparator
                                    ref={fullRef}
                                    title="React vs Vue"
                                    description="Feature comparison for web application frameworks."
                                />
                            </tc-section-card>

                            <tc-section-card title="Boolean features — databases (show-summary=false)">
                                {/* @ts-ignore */}
                                <tc-comparator
                                    ref={noSummaryRef}
                                    title="PostgreSQL vs SQLite"
                                    show-summary="false"
                                />
                            </tc-section-card>

                            <tc-section-card title="Mixed boolean + numeric values — Node.js vs Deno">
                                {/* @ts-ignore */}
                                <tc-comparator
                                    ref={valueRef}
                                    title="Node.js vs Deno"
                                    description="Runtime comparison with mixed boolean and numeric feature values."
                                />
                            </tc-section-card>

                            <tc-section-card title="Loading state (5 skeleton rows)">
                                {/* @ts-ignore */}
                                <tc-comparator loading loading-count="5" />
                            </tc-section-card>

                            <tc-section-card title="Minimal — no title or description">
                                {/* @ts-ignore */}
                                <tc-comparator ref={minimalRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ComparatorDemo

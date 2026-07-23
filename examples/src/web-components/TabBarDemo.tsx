import React, { useEffect, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const defaultTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'install', label: 'Install', icon: 'download' },
    { id: 'usage', label: 'Usage', icon: 'book-open' },
    { id: 'legacy', label: 'Legacy', disabled: true },
]

const smallTabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active', icon: 'circle-dot' },
    { id: 'closed', label: 'Closed', icon: 'check-circle' },
    { id: 'archived', label: 'Archived' },
]

const BasicExample: React.FC = () => {
    const [lastEvent, setLastEvent] = useState<string | null>(null)

    const ref = useTc<HTMLElement>(
        { tabs: defaultTabs },
        { 'tc-change': (e: CustomEvent) => setLastEvent(`tc-change: id=${e.detail.id}`) }
    )

    return (
        <>
            {/* @ts-ignore */}
            <tc-tab-bar ref={ref} active-id="overview" />
            {lastEvent && (
                <p className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                    <code>{lastEvent}</code>
                </p>
            )}
        </>
    )
}

const ControlledExample: React.FC = () => {
    const [active, setActive] = useState('all')

    const ref = useTc<HTMLElement>(
        { tabs: smallTabs },
        { 'tc-change': (e: CustomEvent) => setActive(e.detail.id) }
    )

    useEffect(() => {
        const el = ref.current
        if (el) el.setAttribute('active-id', active)
    }, [active])

    return (
        <>
            {/* @ts-ignore */}
            <tc-tab-bar ref={ref} active-id={active} size="sm" />
            <p className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                React state owns the active tab: <code>{active}</code>
            </p>
        </>
    )
}

const TabBarDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="TabBar"
                        description="Horizontal tab switcher bar with icons, a disabled state, size variants, and full ARIA tablist keyboard navigation (ArrowLeft/Right, Home/End)."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Default (md, icons, disabled tab)">
                            <BasicExample />
                        </tc-section-card>

                        <tc-section-card title="Controlled (sm, active-id driven by tc-change)">
                            <ControlledExample />
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default TabBarDemo

import React, { useRef, useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

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
    const ref = useRef<any>(null)
    const [lastEvent, setLastEvent] = useState<string | null>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.tabs = defaultTabs
        const onchange = (e: CustomEvent) => setLastEvent(`tc-change: id=${e.detail.id}`)
        el.addEventListener('tc-change', onchange)
        return () => el.removeEventListener('tc-change', onchange)
    }, [])

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
    const ref = useRef<any>(null)
    const [active, setActive] = useState('all')

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.tabs = smallTabs
        const onchange = (e: CustomEvent) => setActive(e.detail.id)
        el.addEventListener('tc-change', onchange)
        return () => el.removeEventListener('tc-change', onchange)
    }, [])

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
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="TabBar"
                        description="Horizontal tab switcher bar with icons, a disabled state, size variants, and full ARIA tablist keyboard navigation (ArrowLeft/Right, Home/End)."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">

                        <SectionCard title="Default (md, icons, disabled tab)">
                            <BasicExample />
                        </SectionCard>

                        <SectionCard title="Controlled (sm, active-id driven by tc-change)">
                            <ControlledExample />
                        </SectionCard>

                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default TabBarDemo

import React, { useRef, useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const overviewItems = [
    {
        key: 'overview',
        label: 'Overview',
        content: '<p style="margin:0">A tabbed interface with switchable content sections. The active tab carries a 2px ink underline; clicking or pressing Enter/Space activates a tab, and arrow keys roam between them.</p>',
    },
    {
        key: 'install',
        label: 'Install',
        icon: 'download',
        content: '<p style="margin:0">Set the <code>items</code> JS property to an array of <code>TabSectionItem</code>. The <code>content</code> field is an HTML/text string rendered into the panel.</p>',
    },
    {
        key: 'usage',
        label: 'Usage',
        icon: 'book-open',
        content: '<p style="margin:0">Use <code>default-active-key</code> for uncontrolled mode, or drive the active tab with <code>active-key</code> for controlled mode.</p>',
    },
    {
        key: 'legacy',
        label: 'Legacy (disabled)',
        disabled: true,
        content: '<p style="margin:0">This panel is unreachable — its tab is disabled.</p>',
    },
]

const controlledItems = [
    { key: 'tab-a', label: 'Account', content: '<p style="margin:0">Account settings panel.</p>' },
    { key: 'tab-b', label: 'Billing', content: '<p style="margin:0">Billing settings panel.</p>' },
    { key: 'tab-c', label: 'Notifications', content: '<p style="margin:0">Notification settings panel.</p>' },
]

const UncontrolledExample: React.FC = () => {
    const ref = useRef<any>(null)
    const [lastEvent, setLastEvent] = useState<string | null>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.items = overviewItems

        const onChange = (e: CustomEvent) => setLastEvent(`tc-change: key=${e.detail.key}`)
        el.onchangetab = (key: string) => console.log('[TabSections] onchangetab', key)
        el.addEventListener('tc-change', onChange)
        return () => el.removeEventListener('tc-change', onChange)
    }, [])

    return (
        <>
            {/* @ts-ignore */}
            <tc-tab-sections ref={ref} default-active-key="install" />
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
    const [active, setActive] = useState('tab-a')

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.items = controlledItems
        // Controlled: the element only emits; the parent decides the active tab.
        const onChange = (e: CustomEvent) => setActive(e.detail.key)
        el.addEventListener('tc-change', onChange)
        return () => el.removeEventListener('tc-change', onChange)
    }, [])

    useEffect(() => {
        const el = ref.current
        if (el) el.setAttribute('active-key', active)
    }, [active])

    return (
        <>
            {/* @ts-ignore */}
            <tc-tab-sections ref={ref} active-key={active} />
            <p className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                React state owns the active tab: <code>{active}</code>
            </p>
        </>
    )
}

const LoadingExample: React.FC = () => {
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (el) el.items = overviewItems
    }, [])

    return (
        /* @ts-ignore */
        <tc-tab-sections ref={ref} loading />
    )
}

const TabSectionsDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="TabSections"
                        description="Tabbed interface with switchable content sections, underline tab nav, an optional loading skeleton, and full ARIA tabs keyboard support."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">

                        <SectionCard title="Uncontrolled (default-active-key, icon tab, disabled tab)">
                            <UncontrolledExample />
                        </SectionCard>

                        <SectionCard title="Controlled (active-key driven by tc-change)">
                            <ControlledExample />
                        </SectionCard>

                        <SectionCard title="Loading skeleton (loading attribute)">
                            <LoadingExample />
                        </SectionCard>

                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default TabSectionsDemo

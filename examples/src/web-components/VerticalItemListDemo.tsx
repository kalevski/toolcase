import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const items = [
    { key: 'general', icon: 'settings', text: 'General' },
    { key: 'members', icon: 'users', text: 'Members', badge: 12 },
    { key: 'billing', icon: 'credit-card', text: 'Billing' },
    { key: 'notifications', icon: 'bell', text: 'Notifications', badge: 'New' },
    { key: 'security', icon: 'shield', text: 'Security' },
]

// Per-key HTML strings projected into the default slot (the content area).
const panels: Record<string, string> = {
    general: '<p style="margin:0">General workspace settings — name, slug, and default region.</p>',
    members:
        '<p style="margin:0">Invite teammates and manage their roles. <strong>12</strong> members in this workspace.</p>',
    billing: '<p style="margin:0">Your plan, payment method, and invoice history live here.</p>',
    notifications:
        '<p style="margin:0">Choose which events email you. A <strong>New</strong> digest option is available.</p>',
    security: '<p style="margin:0">Two-factor authentication, sessions, and audit log.</p>',
}

const UncontrolledExample: React.FC = () => {
    const [active, setActive] = useState('members')
    const [lastEvent, setLastEvent] = useState<string | null>(null)

    const ref = useTc<HTMLElement>(
        {
            items,
            onSelect: (key: string) => console.log('[VerticalItemList] onSelect', key),
        },
        {
            'tc-select': (e: CustomEvent) => {
                setActive(e.detail.key)
                setLastEvent(`tc-select: key=${e.detail.key}`)
            },
        }
    )

    return (
        <>
            {/* @ts-ignore */}
            <tc-vertical-item-list ref={ref} default-active-key="members">
                <div dangerouslySetInnerHTML={{ __html: panels[active] }} />
                {/* @ts-ignore */}
            </tc-vertical-item-list>
            {lastEvent && (
                <p className="mt-2 text-muted" style={{ fontSize: '0.8rem' }}>
                    <code>{lastEvent}</code>
                </p>
            )}
        </>
    )
}

const DisabledExample: React.FC = () => {
    const ref = useTc<HTMLElement>({ items })

    return (
        <>
            {/* @ts-ignore */}
            <tc-vertical-item-list ref={ref} default-active-key="general" disabled>
                <p style={{ margin: 0 }}>Interaction is disabled — the menu is dimmed and inert.</p>
                {/* @ts-ignore */}
            </tc-vertical-item-list>
        </>
    )
}

const LoadingExample: React.FC = () => {
    const ref = useTc<HTMLElement>({ items })

    return (
        <>
            {/* @ts-ignore */}
            <tc-vertical-item-list ref={ref} loading loading-count="5">
                <p style={{ margin: 0 }} className="text-muted">
                    Content loads once the menu is ready.
                </p>
                {/* @ts-ignore */}
            </tc-vertical-item-list>
        </>
    )
}

const VerticalItemListDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="VerticalItemList"
                        description="Vertical navigation menu with icons and badges beside an associated content area. The active item carries a 2px ink left-edge marker; Up/Down roam, Enter/Space select."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Uncontrolled (default-active-key, slotted content per key, tc-select)">
                            <UncontrolledExample />
                        </tc-section-card>

                        <tc-section-card title="Disabled (no interaction)">
                            <DisabledExample />
                        </tc-section-card>

                        <tc-section-card title="Loading skeleton (loading + loading-count)">
                            <LoadingExample />
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default VerticalItemListDemo

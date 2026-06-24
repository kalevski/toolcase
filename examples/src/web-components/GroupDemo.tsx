import React, { useEffect, useRef } from 'react'

const GroupDemo: React.FC = () => {
    const actionRef = useRef<HTMLElement>(null)
    const collapsedRef = useRef<HTMLElement>(null)
    const eventRef = useRef<HTMLElement>(null)

    useEffect(() => {
        if (actionRef.current) {
            const el = actionRef.current as HTMLElement & {
                onActionClick: () => void
                onToggle: (c: boolean) => void
            }
            el.onActionClick = () => alert('Action clicked!')
            el.onToggle = (collapsed: boolean) =>
                console.log('tc-group toggled, collapsed:', collapsed)
        }
        if (collapsedRef.current) {
            const el = collapsedRef.current as HTMLElement & { onToggle: (c: boolean) => void }
            el.onToggle = (collapsed: boolean) =>
                console.log('default-collapsed group toggled:', collapsed)
        }
        if (eventRef.current) {
            const el = eventRef.current
            el.addEventListener('tc-action-click', () => alert('tc-action-click event fired!'))
            el.addEventListener('tc-toggle', (e: Event) => {
                const { collapsed } = (e as CustomEvent<{ collapsed: boolean }>).detail
                console.log('tc-toggle event, collapsed:', collapsed)
            })
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Group"
                            description="A collapsible group container with a header label, optional badge, and optional action button. Children are the group body, preserved across re-renders."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic group (label only)">
                                {/* @ts-ignore */}
                                <tc-group label="Settings">
                                    <div style={{ padding: '1rem' }}>
                                        <p>Group body content goes here.</p>
                                        <p>It can contain any HTML elements.</p>
                                    </div>
                                </tc-group>
                            </tc-section-card>

                            <tc-section-card title="With badge">
                                {/* @ts-ignore */}
                                <tc-group label="Active Users" badge="42">
                                    <div style={{ padding: '1rem' }}>
                                        <p>The badge in the header shows a count or label.</p>
                                    </div>
                                </tc-group>
                            </tc-section-card>

                            <tc-section-card title="With action button (JS callbacks + events)">
                                {/* @ts-ignore */}
                                <tc-group
                                    label="Documents"
                                    badge="7"
                                    action-label="Add"
                                    action-icon="Plus"
                                    ref={actionRef}
                                >
                                    <div style={{ padding: '1rem' }}>
                                        <p>
                                            Click the action button to trigger{' '}
                                            <code>tc-action-click</code>.
                                        </p>
                                        <p>The action does not toggle the group open/closed.</p>
                                    </div>
                                </tc-group>
                            </tc-section-card>

                            <tc-section-card title="Default collapsed">
                                {/* @ts-ignore */}
                                <tc-group
                                    label="Advanced Options"
                                    badge="3"
                                    default-collapsed
                                    ref={collapsedRef}
                                >
                                    <div style={{ padding: '1rem' }}>
                                        <p>
                                            This group starts collapsed via the{' '}
                                            <code>default-collapsed</code> attribute.
                                        </p>
                                        <p>Click the header to expand.</p>
                                    </div>
                                </tc-group>
                            </tc-section-card>

                            <tc-section-card title="Icon-only action button (DOM events)">
                                {/* @ts-ignore */}
                                <tc-group
                                    label="Notifications"
                                    badge="12"
                                    action-icon="Settings"
                                    action-label="Configure"
                                    ref={eventRef}
                                >
                                    <div style={{ padding: '1rem' }}>
                                        <ul>
                                            <li>Deploy completed successfully</li>
                                            <li>PR #203 merged</li>
                                            <li>Build pipeline passed</li>
                                        </ul>
                                    </div>
                                </tc-group>
                            </tc-section-card>

                            <tc-section-card title="Multiple nested groups">
                                <div
                                    style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-group label="Team Alpha" badge="5">
                                        <div style={{ padding: '0.75rem 1rem' }}>
                                            <p style={{ margin: 0 }}>
                                                Alice, Bob, Carol, Dave, Eve
                                            </p>
                                        </div>
                                    </tc-group>
                                    {/* @ts-ignore */}
                                    <tc-group label="Team Beta" badge="3" default-collapsed>
                                        <div style={{ padding: '0.75rem 1rem' }}>
                                            <p style={{ margin: 0 }}>Frank, Grace, Hank</p>
                                        </div>
                                    </tc-group>
                                    {/* @ts-ignore */}
                                    <tc-group label="Team Gamma" badge="0">
                                        <div style={{ padding: '0.75rem 1rem' }}>
                                            <p style={{ margin: 0 }}>No members yet.</p>
                                        </div>
                                    </tc-group>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GroupDemo

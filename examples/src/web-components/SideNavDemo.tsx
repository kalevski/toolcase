import React, { useEffect, useRef, useState } from 'react'

const SECTIONS = [
    {
        key: 'main',
        title: 'Main',
        items: [
            {
                key: 'dashboard',
                label: 'Dashboard',
                icon: 'layout-dashboard',
                href: '#dashboard',
                active: true,
            },
            {
                key: 'projects',
                label: 'Projects',
                icon: 'folder-kanban',
                href: '#projects',
                badge: '12',
            },
            { key: 'tasks', label: 'Tasks', icon: 'check-square', href: '#tasks', badge: '3' },
            { key: 'calendar', label: 'Calendar', icon: 'calendar', href: '#calendar' },
        ],
    },
    {
        key: 'workspace',
        title: 'Workspace',
        items: [
            { key: 'team', label: 'Team', icon: 'users', href: '#team' },
            {
                key: 'reports',
                label: 'Reports',
                icon: 'bar-chart-3',
                href: '#reports',
                badge: 'New',
            },
            { key: 'billing', label: 'Billing', icon: 'credit-card', disabled: true },
        ],
    },
    {
        key: 'account',
        title: 'Account',
        items: [
            { key: 'settings', label: 'Settings', icon: 'settings', href: '#settings' },
            { key: 'help', label: 'Help & Support', icon: 'life-buoy', href: '#help' },
        ],
    },
]

const SideNavDemo: React.FC = () => {
    const navRef = useRef<any>(null)
    const [lastClicked, setLastClicked] = useState<string>('—')

    useEffect(() => {
        const el = navRef.current
        if (!el) return
        el.sections = SECTIONS

        const onItemClick = (e: any) => setLastClicked(e.detail.key)
        el.addEventListener('tc-item-click', onItemClick)
        return () => el.removeEventListener('tc-item-click', onItemClick)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SideNav"
                            description="Vertical navigation menu with sections, items, icons, badges, an active marker, disabled items, and a loading state."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Sections, active item, badges, a disabled item (JS property)">
                                <div
                                    style={{
                                        maxWidth: 280,
                                        border: '1px solid var(--tc-border, #e2e8f0)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-side-nav ref={navRef} />
                                </div>
                                <p className="mt-3 mb-0 text-muted" style={{ fontSize: '0.85rem' }}>
                                    Last <code>tc-item-click</code> key:{' '}
                                    <strong>{lastClicked}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Loading state — default count (5 rows)">
                                <div
                                    style={{
                                        maxWidth: 280,
                                        border: '1px solid var(--tc-border, #e2e8f0)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-side-nav loading />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Loading state — 8 rows (loading-count attribute)">
                                <div
                                    style={{
                                        maxWidth: 280,
                                        border: '1px solid var(--tc-border, #e2e8f0)',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-side-nav loading loading-count="8" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SideNavDemo

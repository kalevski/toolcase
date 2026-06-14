import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const DashboardSidebarDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="DashboardSidebar"
                        description="Vertical sidebar shell for dashboard layouts. Arranges three named slot regions — brand (top), menu (scrollable middle), and panel (pinned bottom) — separated by 1px hairlines."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="All three regions">
                            <div style={{ border: '1px solid var(--tc-border)', height: '360px', display: 'flex' }}>
                                {/* @ts-ignore */}
                                <tc-dashboard-sidebar style={{ height: '100%' }}>
                                    <div slot="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--tc-font-mono)', fontWeight: 700, color: 'var(--tc-text)' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--tc-accent)', display: 'inline-block', flexShrink: 0 }}></span>
                                        MyApp
                                    </div>
                                    <nav slot="menu" style={{ padding: '0.5rem 0' }}>
                                        {['Dashboard', 'Projects', 'Analytics', 'Team', 'Settings'].map(item => (
                                            <div key={item} style={{ padding: '0.5rem 1rem', color: 'var(--tc-text)', cursor: 'pointer', fontSize: '0.9rem' }}>
                                                {item}
                                            </div>
                                        ))}
                                    </nav>
                                    <div slot="panel" style={{ fontSize: '0.85rem', color: 'var(--tc-text-muted)' }}>
                                        user@example.com
                                    </div>
                                {/* @ts-ignore */}
                                </tc-dashboard-sidebar>
                                <div style={{ flex: 1, padding: '1.5rem', background: 'var(--tc-surface)', color: 'var(--tc-text)', fontSize: '0.9rem' }}>
                                    Main content area
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Brand region only">
                            <div style={{ border: '1px solid var(--tc-border)', height: '200px', display: 'flex' }}>
                                {/* @ts-ignore */}
                                <tc-dashboard-sidebar style={{ height: '100%' }}>
                                    <div slot="brand" style={{ fontFamily: 'var(--tc-font-mono)', fontWeight: 700, color: 'var(--tc-text)' }}>
                                        Brand Only
                                    </div>
                                {/* @ts-ignore */}
                                </tc-dashboard-sidebar>
                                <div style={{ flex: 1, padding: '1.5rem', background: 'var(--tc-surface)', color: 'var(--tc-text)', fontSize: '0.9rem' }}>
                                    Content
                                </div>
                            </div>
                        </SectionCard>

                        <SectionCard title="Custom width via CSS property">
                            <div style={{ border: '1px solid var(--tc-border)', height: '200px', display: 'flex' }}>
                                {/* @ts-ignore */}
                                <tc-dashboard-sidebar style={{ height: '100%', '--bs-dashboard-sidebar-width': '11rem' } as React.CSSProperties}>
                                    <div slot="brand" style={{ fontFamily: 'var(--tc-font-mono)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--tc-text)' }}>
                                        Narrow
                                    </div>
                                    <nav slot="menu">
                                        <div style={{ padding: '0.5rem 1rem', color: 'var(--tc-text)', fontSize: '0.85rem' }}>Home</div>
                                        <div style={{ padding: '0.5rem 1rem', color: 'var(--tc-text)', fontSize: '0.85rem' }}>Settings</div>
                                    </nav>
                                    <div slot="panel" style={{ fontSize: '0.75rem', color: 'var(--tc-text-muted)' }}>v2.0.0</div>
                                {/* @ts-ignore */}
                                </tc-dashboard-sidebar>
                                <div style={{ flex: 1, padding: '1.5rem', background: 'var(--tc-surface)', color: 'var(--tc-text)', fontSize: '0.9rem' }}>
                                    Content with narrowed sidebar (11rem)
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default DashboardSidebarDemo

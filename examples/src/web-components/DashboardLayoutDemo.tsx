import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const menuItems = ['Dashboard', 'Projects', 'Analytics', 'Team', 'Settings']

const DashboardLayoutDemo: React.FC = () => {
    const ref = useRef<any>(null)
    const [lastEvent, setLastEvent] = useState<string>('')

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: CustomEvent) => {
            setLastEvent(`tc-toggle-sidebar → open: ${e.detail.open}`)
        }
        el.addEventListener('tc-toggle-sidebar', handler)
        return () => el.removeEventListener('tc-toggle-sidebar', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="DashboardLayout"
                            description="Full-page dashboard shell composing a glass navbar, a collapsible sidebar, and a scrollable content area. Toggle the sidebar with the button or Ctrl+B (Cmd+B)."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Full layout with all slots">
                                <div style={{ border: '1px solid var(--tc-border)', height: '400px' }}>
                                    {/* @ts-ignore */}
                                    <tc-dashboard-layout ref={ref} style={{ height: '100%' }}>
                                        {/* brand slot */}
                                        <div slot="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--tc-accent)', display: 'inline-block', flexShrink: 0 }} />
                                            <span style={{ fontFamily: 'var(--tc-font-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--tc-text)' }}>MyApp</span>
                                        </div>
                                        {/* sidebar-menu slot */}
                                        <nav slot="sidebar-menu" style={{ padding: '0.5rem 0' }}>
                                            {menuItems.map(item => (
                                                <div key={item} style={{ padding: '0.5rem 1rem', color: 'var(--tc-text)', cursor: 'pointer', fontSize: '0.875rem' }}>
                                                    {item}
                                                </div>
                                            ))}
                                        </nav>
                                        {/* sidebar-panel slot */}
                                        <div slot="sidebar-panel" style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                                            user@example.com
                                        </div>
                                        {/* navbar-left slot */}
                                        <span slot="navbar-left" style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)', marginLeft: '0.5rem' }}>
                                            / Dashboard
                                        </span>
                                        {/* navbar-right slot */}
                                        <div slot="navbar-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingRight: '0.5rem' }}>
                                            <span style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>v2.0.0</span>
                                        </div>
                                        {/* default content */}
                                        <div style={{ padding: '1.5rem' }}>
                                            <h5 style={{ color: 'var(--tc-text)', marginBottom: '0.75rem' }}>Main Content</h5>
                                            <p style={{ color: 'var(--tc-text-muted)', fontSize: '0.9rem' }}>Click the toggle button or press Ctrl+B to collapse the sidebar.</p>
                                            {lastEvent && (
                                                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--tc-surface)', border: '1px solid var(--tc-border)', fontFamily: 'var(--tc-font-mono)', fontSize: '0.8125rem', color: 'var(--tc-text)' }}>
                                                    {lastEvent}
                                                </div>
                                            )}
                                        </div>
                                    {/* @ts-ignore */}
                                    </tc-dashboard-layout>
                                </div>
                            </SectionCard>

                            <SectionCard title="Menu only (no brand or panel)">
                                <div style={{ border: '1px solid var(--tc-border)', height: '280px' }}>
                                    {/* @ts-ignore */}
                                    <tc-dashboard-layout style={{ height: '100%' }}>
                                        <nav slot="sidebar-menu" style={{ padding: '0.5rem 0' }}>
                                            {['Home', 'Reports', 'Settings'].map(item => (
                                                <div key={item} style={{ padding: '0.5rem 1rem', color: 'var(--tc-text)', fontSize: '0.875rem', cursor: 'pointer' }}>
                                                    {item}
                                                </div>
                                            ))}
                                        </nav>
                                        <div slot="navbar-right" style={{ paddingRight: '0.5rem', fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                                            Actions
                                        </div>
                                        <div style={{ padding: '1.5rem', color: 'var(--tc-text-muted)', fontSize: '0.9rem' }}>
                                            Sidebar with menu only — brand and panel slots omitted.
                                        </div>
                                    {/* @ts-ignore */}
                                    </tc-dashboard-layout>
                                </div>
                            </SectionCard>

                            <SectionCard title="Narrow sidebar via CSS custom property">
                                <div style={{ border: '1px solid var(--tc-border)', height: '280px' }}>
                                    {/* @ts-ignore */}
                                    <tc-dashboard-layout style={{ height: '100%', '--bs-dashboard-layout-sidebar-width': '10rem' } as React.CSSProperties}>
                                        <div slot="brand" style={{ fontFamily: 'var(--tc-font-mono)', fontWeight: 700, fontSize: '0.8125rem', color: 'var(--tc-text)' }}>
                                            App
                                        </div>
                                        <nav slot="sidebar-menu" style={{ padding: '0.5rem 0' }}>
                                            {['Home', 'Reports', 'Settings'].map(item => (
                                                <div key={item} style={{ padding: '0.5rem 0.75rem', color: 'var(--tc-text)', fontSize: '0.8125rem', cursor: 'pointer' }}>
                                                    {item}
                                                </div>
                                            ))}
                                        </nav>
                                        <div style={{ padding: '1.25rem', color: 'var(--tc-text-muted)', fontSize: '0.9rem' }}>
                                            Sidebar narrowed to 10rem.
                                        </div>
                                    {/* @ts-ignore */}
                                    </tc-dashboard-layout>
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DashboardLayoutDemo

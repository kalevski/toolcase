import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const NAV_ITEMS = [
    { label: 'Home', href: '#home', active: true },
    { label: 'Docs', href: '#docs' },
    { label: 'Examples', href: '#examples' },
    { label: 'Pricing', href: '#pricing' },
]

const CoolNavDemo: React.FC = () => {
    const [lastEvent, setLastEvent] = useState('')

    const basicRef = useRef<any>(null)
    const darkRef = useRef<any>(null)
    const stickyRef = useRef<any>(null)
    const noLoginRef = useRef<any>(null)
    const customBpRef = useRef<any>(null)

    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        el.items = NAV_ITEMS
        el.addEventListener('tc-nav-toggle', (e: CustomEvent) => {
            setLastEvent(`tc-nav-toggle: open=${e.detail.open}`)
        })
        el.addEventListener('tc-login', () => {
            setLastEvent('tc-login fired')
        })
    }, [])

    useEffect(() => {
        if (darkRef.current) {
            darkRef.current.items = NAV_ITEMS
        }
    }, [])

    useEffect(() => {
        if (stickyRef.current) {
            stickyRef.current.items = NAV_ITEMS
            stickyRef.current.classList.add('tc-cool-nav-scrolled')
        }
    }, [])

    useEffect(() => {
        if (noLoginRef.current) {
            noLoginRef.current.items = NAV_ITEMS.slice(0, 3)
        }
    }, [])

    useEffect(() => {
        if (customBpRef.current) {
            customBpRef.current.items = NAV_ITEMS
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CoolNav"
                            description="Responsive nav bar with collapsible menu, scroll detection, brand slot, login CTA, and light/dark themes."
                        />

                        {lastEvent && (
                            <div className="alert alert-info mt-3">
                                Event: <strong>{lastEvent}</strong>
                            </div>
                        )}

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Basic — brand attribute + login CTA">
                                {/* @ts-ignore */}
                                <tc-cool-nav
                                    ref={basicRef}
                                    brand="toolcase"
                                    login-label="Get started"
                                    login-href="#signup"
                                    login-variant="primary"
                                />
                            </SectionCard>

                            <SectionCard title="Brand slot">
                                {/* @ts-ignore */}
                                <tc-cool-nav login-label="Sign in" login-href="#login">
                                    {/* @ts-ignore */}
                                    <span slot="brand" style={{ fontFamily: 'var(--tc-font-mono)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ width: 7, height: 7, background: 'var(--tc-accent)', display: 'inline-block' }} />
                                        myapp
                                    </span>
                                    {/* @ts-ignore */}
                                </tc-cool-nav>
                            </SectionCard>

                            <SectionCard title="Right slot (extra controls)">
                                {/* @ts-ignore */}
                                <tc-cool-nav brand="toolcase" login-label="Log in" login-href="#login">
                                    {/* @ts-ignore */}
                                    <span slot="right">
                                        <button className="btn btn-sm btn-outline-secondary">Changelog</button>
                                    </span>
                                    {/* @ts-ignore */}
                                </tc-cool-nav>
                            </SectionCard>

                            <SectionCard title="Dark theme">
                                {/* @ts-ignore */}
                                <tc-cool-nav
                                    ref={darkRef}
                                    brand="toolcase"
                                    theme="dark"
                                    login-label="Log in"
                                    login-href="#login"
                                />
                            </SectionCard>

                            <SectionCard title="Sticky + scrolled state preview">
                                {/* @ts-ignore */}
                                <tc-cool-nav
                                    ref={stickyRef}
                                    brand="toolcase"
                                    sticky
                                    login-label="Log in"
                                    login-href="#"
                                />
                                <p style={{ fontSize: '0.8rem', color: 'var(--tc-text-muted)', marginTop: '0.5rem' }}>
                                    With <code>sticky</code>, the nav is <code>position: sticky; top: 0</code>. The scrolled (condensed + shadow) state is applied via <code>classList.add</code> in the effect for preview.
                                </p>
                            </SectionCard>

                            <SectionCard title="No login CTA">
                                {/* @ts-ignore */}
                                <tc-cool-nav ref={noLoginRef} brand="toolcase" />
                            </SectionCard>

                            <SectionCard title="Custom expand breakpoint (md)">
                                {/* @ts-ignore */}
                                <tc-cool-nav
                                    ref={customBpRef}
                                    brand="toolcase"
                                    expand-breakpoint="md"
                                    login-label="Log in"
                                    login-href="#"
                                />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CoolNavDemo

import React, { useEffect, useRef, useState } from 'react'

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
                        <tc-rich-page-header
                            title-text="CoolNav"
                            description="Responsive nav bar with collapsible menu, scroll detection, brand slot, login CTA, and light/dark themes."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        {lastEvent && (
                            <div className="alert alert-info mt-3">
                                Event: <strong>{lastEvent}</strong>
                            </div>
                        )}

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — brand attribute + login CTA">
                                {/* @ts-ignore */}
                                <tc-cool-nav
                                    ref={basicRef}
                                    brand="toolcase"
                                    login-label="Get started"
                                    login-href="#signup"
                                    login-variant="primary"
                                />
                            </tc-section-card>

                            <tc-section-card title="Brand slot">
                                {/* @ts-ignore */}
                                <tc-cool-nav login-label="Sign in" login-href="#login">
                                    {/* @ts-ignore */}
                                    <span
                                        slot="brand"
                                        style={{
                                            fontFamily: 'var(--tc-font-mono)',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 7,
                                                height: 7,
                                                background: 'var(--tc-accent)',
                                                display: 'inline-block',
                                            }}
                                        />
                                        myapp
                                    </span>
                                    {/* @ts-ignore */}
                                </tc-cool-nav>
                            </tc-section-card>

                            <tc-section-card title="Right slot (extra controls)">
                                {/* @ts-ignore */}
                                <tc-cool-nav
                                    brand="toolcase"
                                    login-label="Log in"
                                    login-href="#login"
                                >
                                    {/* @ts-ignore */}
                                    <span slot="right">
                                        <button className="btn btn-sm btn-outline-secondary">
                                            Changelog
                                        </button>
                                    </span>
                                    {/* @ts-ignore */}
                                </tc-cool-nav>
                            </tc-section-card>

                            <tc-section-card title="Dark theme">
                                {/* @ts-ignore */}
                                <tc-cool-nav
                                    ref={darkRef}
                                    brand="toolcase"
                                    theme="dark"
                                    login-label="Log in"
                                    login-href="#login"
                                />
                            </tc-section-card>

                            <tc-section-card title="Sticky + scrolled state preview">
                                {/* @ts-ignore */}
                                <tc-cool-nav
                                    ref={stickyRef}
                                    brand="toolcase"
                                    sticky
                                    login-label="Log in"
                                    login-href="#"
                                />
                                <p
                                    style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--tc-text-muted)',
                                        marginTop: '0.5rem',
                                    }}
                                >
                                    With <code>sticky</code>, the nav is{' '}
                                    <code>position: sticky; top: 0</code>. The scrolled (condensed +
                                    shadow) state is applied via <code>classList.add</code> in the
                                    effect for preview.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="No login CTA">
                                {/* @ts-ignore */}
                                <tc-cool-nav ref={noLoginRef} brand="toolcase" />
                            </tc-section-card>

                            <tc-section-card title="Custom expand breakpoint (md)">
                                {/* @ts-ignore */}
                                <tc-cool-nav
                                    ref={customBpRef}
                                    brand="toolcase"
                                    expand-breakpoint="md"
                                    login-label="Log in"
                                    login-href="#"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CoolNavDemo

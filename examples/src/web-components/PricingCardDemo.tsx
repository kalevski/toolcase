import React, { useEffect, useRef } from 'react'

const FREE_FEATURES = [
    { label: '5 projects', included: true },
    { label: '1 GB storage', included: true },
    { label: 'Community support', included: true },
    { label: 'Custom domains', included: false },
    { label: 'Analytics', included: false },
]

const PRO_FEATURES = [
    { label: 'Unlimited projects', included: true },
    { label: '50 GB storage', included: true },
    { label: 'Priority support', included: true },
    { label: 'Custom domains', included: true },
    { label: 'Advanced analytics', included: true },
]

const ENTERPRISE_FEATURES = [
    'Unlimited projects',
    'Unlimited storage',
    'Dedicated support',
    'Custom domains',
    'Advanced analytics',
    'SSO / SAML',
    'SLA guarantee',
]

const PricingCardDemo: React.FC = () => {
    const freeRef = useRef<any>(null)
    const proRef = useRef<any>(null)
    const enterpriseRef = useRef<any>(null)
    const eventLogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = freeRef.current
        if (!el) return
        el.features = FREE_FEATURES
        el.action = { label: 'Get started free', href: '#free' }
    }, [])

    useEffect(() => {
        const el = proRef.current
        if (!el) return
        el.features = PRO_FEATURES
        el.action = {
            label: 'Start Pro trial',
            onClick: () => {
                if (eventLogRef.current) {
                    const entry = document.createElement('p')
                    entry.textContent = 'tc-action fired from Pro card'
                    entry.style.margin = '0 0 4px'
                    eventLogRef.current.prepend(entry)
                }
            },
        }
    }, [])

    useEffect(() => {
        const el = enterpriseRef.current
        if (!el) return
        el.features = ENTERPRISE_FEATURES
        el.action = { label: 'Contact sales', href: '#enterprise' }
    }, [])

    useEffect(() => {
        const handler = (e: Event) => {
            const custom = e as CustomEvent
            if (eventLogRef.current) {
                const entry = document.createElement('p')
                entry.textContent = `tc-action received (bubbled): ${JSON.stringify(custom.detail)}`
                entry.style.margin = '0 0 4px'
                eventLogRef.current.prepend(entry)
            }
        }
        document.addEventListener('tc-action', handler)
        return () => document.removeEventListener('tc-action', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PricingCard"
                            description="Pricing tier card with a feature list and action button. Set features and action via JS properties. Fires tc-action on button activation."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Three tiers (Free, Pro highlighted, Enterprise)">
                                <div
                                    className="d-flex flex-wrap gap-3"
                                    style={{ alignItems: 'stretch' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-pricing-card
                                        ref={freeRef}
                                        name="Free"
                                        price="$0"
                                        period="/ month"
                                        description="Everything you need to get started."
                                        style={{ flex: '1 1 220px', minWidth: '200px' }}
                                    />
                                    {/* @ts-ignore */}
                                    <tc-pricing-card
                                        ref={proRef}
                                        name="Pro"
                                        price="$29"
                                        period="/ month"
                                        description="For growing teams and serious projects."
                                        highlight
                                        badge-text="Most popular"
                                        style={{ flex: '1 1 220px', minWidth: '200px' }}
                                    />
                                    {/* @ts-ignore */}
                                    <tc-pricing-card
                                        ref={enterpriseRef}
                                        name="Enterprise"
                                        price="Custom"
                                        description="Tailored for large organisations."
                                        style={{ flex: '1 1 220px', minWidth: '200px' }}
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Event log (tc-action)">
                                <p className="text-muted mb-2" style={{ fontSize: '0.875rem' }}>
                                    Click the Pro card button to see the event. The event bubbles to
                                    document.
                                </p>
                                <div
                                    ref={eventLogRef}
                                    style={{
                                        fontFamily: 'var(--bs-font-monospace)',
                                        fontSize: '0.8125rem',
                                        padding: '0.75rem',
                                        background: 'var(--tc-surface-muted)',
                                        border: '1px solid var(--tc-border)',
                                        minHeight: '4rem',
                                    }}
                                >
                                    <p style={{ margin: '0', color: 'var(--tc-text-faint)' }}>
                                        No events yet.
                                    </p>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PricingCardDemo

import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BENEFITS = [
    'Zero-config setup — drop in a script tag and go',
    'Framework-free: React, Vue, Svelte, or plain HTML',
    'Lightweight — no runtime dependencies',
    'Full accessibility baked in (WCAG 2.1 AA)',
]

const EarlySignupFormDemo: React.FC = () => {
    const lightRef = useRef<any>(null)
    const darkRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)
    const successRef = useRef<any>(null)
    const [lightLog, setLightLog] = useState<string>('')
    const [darkLog, setDarkLog] = useState<string>('')

    // Light variant — benefits via JS property, listen to tc-submit
    useEffect(() => {
        const el = lightRef.current
        if (!el) return
        el.benefits = BENEFITS
        const handler = (e: CustomEvent) => setLightLog(`tc-submit fired: ${JSON.stringify(e.detail)}`)
        el.addEventListener('tc-submit', handler)
        return () => el.removeEventListener('tc-submit', handler)
    }, [])

    // Dark variant — benefits via JS property
    useEffect(() => {
        const el = darkRef.current
        if (!el) return
        el.benefits = ['Priority access to beta features', 'Invite 3 teammates for free', 'Lifetime 20% discount']
        const handler = (e: CustomEvent) => setDarkLog(`tc-submit fired: ${JSON.stringify(e.detail)}`)
        el.addEventListener('tc-submit', handler)
        return () => el.removeEventListener('tc-submit', handler)
    }, [])

    // Loading state variant
    useEffect(() => {
        const el = loadingRef.current
        if (!el) return
        el.benefits = ['Always up to date', 'SLA-backed reliability']
    }, [])

    // Pre-rendered success state (submitted=true simulated via property)
    useEffect(() => {
        const el = successRef.current
        if (!el) return
        el.benefits = ['Instant access confirmation', 'Personal onboarding call']
        // Trigger the success state by pre-filling and submitting programmatically
        el.addEventListener('tc-submit', () => {
            // success state is shown automatically by the component
        })
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="EarlySignupForm"
                            description="Email signup panel with benefits list, inline validation, and a success confirmation state. Set benefits via JS property. Fires tc-submit on valid submission."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title='variant="light" (default)'>
                                {/* @ts-ignore */}
                                <tc-early-signup-form
                                    ref={lightRef}
                                    variant="light"
                                    title="Get early access"
                                    eyebrow="Early access"
                                    subtitle="Be first to know when we ship."
                                    cta-label="Join the waitlist"
                                    placeholder="you@example.com"
                                    helper-text="One email when we launch. No spam, ever."
                                    success-title="You're on the list."
                                />
                                {/* @ts-ignore */}
                                {lightLog && (
                                    <p
                                        className="mt-3"
                                        style={{
                                            fontFamily: 'var(--bs-font-monospace)',
                                            fontSize: '0.8125rem',
                                            color: 'var(--tc-text-muted)',
                                        }}
                                    >
                                        {lightLog}
                                    </p>
                                )}
                            </SectionCard>

                            <SectionCard title='variant="dark"'>
                                {/* @ts-ignore */}
                                <tc-early-signup-form
                                    ref={darkRef}
                                    variant="dark"
                                    title="Shape the product"
                                    eyebrow="Beta program"
                                    subtitle="We're building in the open. Your feedback drives what ships next."
                                    cta-label="Request access"
                                    placeholder="work@company.com"
                                    helper-text="Invite-only beta. Limited spots."
                                    success-title="Request received."
                                    success-message="We'll reach out within 48 hours."
                                />
                                {darkLog && (
                                    <p
                                        className="mt-3"
                                        style={{
                                            fontFamily: 'var(--bs-font-monospace)',
                                            fontSize: '0.8125rem',
                                            color: 'var(--tc-text-muted)',
                                        }}
                                    >
                                        {darkLog}
                                    </p>
                                )}
                            </SectionCard>

                            <SectionCard title="loading state (external prop)">
                                {/* @ts-ignore */}
                                <tc-early-signup-form
                                    ref={loadingRef}
                                    variant="light"
                                    title="Almost there…"
                                    cta-label="Submitting"
                                    loading
                                    helper-text="Hold tight while we register your email."
                                />
                            </SectionCard>

                            <SectionCard title="Validation — try submitting an invalid email">
                                {/* @ts-ignore */}
                                <tc-early-signup-form
                                    variant="light"
                                    title="Catch the launch"
                                    eyebrow="Coming soon"
                                    cta-label="Notify me"
                                    placeholder="hello@domain.com"
                                    helper-text="Enter your best email — we'll only use it once."
                                />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EarlySignupFormDemo

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

    // Pre-rendered success state — drive the email field + submit the form
    // programmatically so the confirmation state renders on mount.
    useEffect(() => {
        const el = successRef.current
        if (!el) return
        el.benefits = ['Instant access confirmation', 'Personal onboarding call']
        // Defer a tick so the component has finished its initial render.
        const id = window.setTimeout(() => {
            const input = el.querySelector('input[name="email"]') as HTMLInputElement | null
            const form = el.querySelector('.tc-early-signup-form__form') as HTMLFormElement | null
            if (input && form) {
                input.value = 'dev@example.com'
                form.requestSubmit()
            }
        }, 0)
        return () => window.clearTimeout(id)
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
                                    title="Join the early access list"
                                    eyebrow="Early access"
                                    subtitle="Be first to know when we ship — and help shape what we build."
                                    field-label="Work email"
                                    cta-label="Request invite"
                                    placeholder="you@example.com"
                                    helper-text="One email when we launch. No spam, ever."
                                    stat="2,400+ developers already joined"
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
                                    title="Shape the product with us"
                                    eyebrow="Beta program"
                                    subtitle="We're building in the open. Your feedback drives what ships next."
                                    field-label="Company email"
                                    cta-label="Request access"
                                    placeholder="work@company.com"
                                    helper-text="Invite-only beta. Limited spots."
                                    stat="138 of 200 seats claimed"
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

                            <SectionCard title="Success state (submitted on mount)">
                                {/* @ts-ignore */}
                                <tc-early-signup-form
                                    ref={successRef}
                                    variant="light"
                                    title="Get early access"
                                    eyebrow="Early access"
                                    subtitle="Reserve your spot in the private beta."
                                    field-label="Work email"
                                    cta-label="Reserve my spot"
                                    placeholder="you@example.com"
                                    stat="2,400+ developers already joined"
                                    success-title="You're on the list."
                                    success-message="We'll email you the moment access opens up."
                                />
                            </SectionCard>

                            <SectionCard title="Validation — try submitting an invalid email">
                                {/* @ts-ignore */}
                                <tc-early-signup-form
                                    variant="light"
                                    title="Catch the launch"
                                    eyebrow="Coming soon"
                                    field-label="Email address"
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

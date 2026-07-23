import React, { useEffect, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const BENEFITS = [
    'Zero-config setup — drop in a script tag and go',
    'Framework-free: React, Vue, Svelte, or plain HTML',
    'Lightweight — no runtime dependencies',
    'Full accessibility baked in (WCAG 2.1 AA)',
]

const EarlySignupFormDemo: React.FC = () => {
    const [lightLog, setLightLog] = useState<string>('')
    const [darkLog, setDarkLog] = useState<string>('')

    // Light variant — benefits via JS property, listen to tc-submit
    const lightRef = useTc<HTMLElement>(
        { benefits: BENEFITS },
        {
            'tc-submit': (e: CustomEvent) =>
                setLightLog(`tc-submit fired: ${JSON.stringify(e.detail)}`),
        },
    )

    // Dark variant — benefits via JS property
    const darkRef = useTc<HTMLElement>(
        {
            benefits: [
                'Priority access to beta features',
                'Invite 3 teammates for free',
                'Lifetime 20% discount',
            ],
        },
        {
            'tc-submit': (e: CustomEvent) =>
                setDarkLog(`tc-submit fired: ${JSON.stringify(e.detail)}`),
        },
    )

    // Loading state variant
    const loadingRef = useTc<HTMLElement>({
        benefits: ['Always up to date', 'SLA-backed reliability'],
    })

    // Pre-rendered success state — drive the email field + submit the form
    // programmatically so the confirmation state renders on mount.
    const successRef = useTc<HTMLElement>({
        benefits: ['Instant access confirmation', 'Personal onboarding call'],
    })
    useEffect(() => {
        const el = successRef.current
        if (!el) return
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
                        <tc-rich-page-header
                            title-text="EarlySignupForm"
                            description="Email signup panel with benefits list, inline validation, and a success confirmation state. Set benefits via JS property. Fires tc-submit on valid submission."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title='variant="light" (default)'>
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
                            </tc-section-card>

                            <tc-section-card title='variant="dark"'>
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
                            </tc-section-card>

                            <tc-section-card title="loading state (external prop)">
                                {/* @ts-ignore */}
                                <tc-early-signup-form
                                    ref={loadingRef}
                                    variant="light"
                                    title="Almost there…"
                                    cta-label="Submitting"
                                    loading
                                    helper-text="Hold tight while we register your email."
                                />
                            </tc-section-card>

                            <tc-section-card title="Success state (submitted on mount)">
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
                            </tc-section-card>

                            <tc-section-card title="Validation — try submitting an invalid email">
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
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EarlySignupFormDemo

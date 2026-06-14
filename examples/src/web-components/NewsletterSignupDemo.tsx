import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const NewsletterSignupDemo: React.FC = () => {
    const successRef = useRef<any>(null)
    const errorRef = useRef<any>(null)
    const privacyRef = useRef<any>(null)

    // Variant that resolves after a 1.5 s delay — shows submitting → success flow
    useEffect(() => {
        const el = successRef.current
        if (!el) return
        el.onSubmit = (_email: string) =>
            new Promise<void>(resolve => setTimeout(resolve, 1500))
    }, [])

    // Variant that rejects — shows submitting → error flow
    useEffect(() => {
        const el = errorRef.current
        if (!el) return
        el.onSubmit = (_email: string) =>
            new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error('This email is already registered.')), 1500)
            )
    }, [])

    // Variant with privacy link, no async
    useEffect(() => {
        const el = privacyRef.current
        if (!el) return
        el.onSubmit = () => new Promise<void>(resolve => setTimeout(resolve, 800))
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="NewsletterSignup"
                            description="Email subscription form with async status management (idle → submitting → success / error) and optional privacy-policy link. Fires tc-submit on valid submission and drives state from the onSubmit Promise."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Success flow — resolves after 1.5 s">
                                {/* @ts-ignore */}
                                <tc-newsletter-signup
                                    ref={successRef}
                                    title="Stay in the loop"
                                    description="Get product updates, release notes, and the occasional tip — no spam."
                                    placeholder="you@example.com"
                                    cta-label="Subscribe"
                                    success-message="You're subscribed! Watch your inbox."
                                    style={{ maxWidth: '480px' }}
                                />
                            </SectionCard>

                            <SectionCard title="Error flow — rejects after 1.5 s">
                                {/* @ts-ignore */}
                                <tc-newsletter-signup
                                    ref={errorRef}
                                    title="Join the beta"
                                    description="Early access for developers building with toolcase."
                                    cta-label="Request access"
                                    style={{ maxWidth: '480px' }}
                                />
                            </SectionCard>

                            <SectionCard title="With title, description, and privacy-href">
                                {/* @ts-ignore */}
                                <tc-newsletter-signup
                                    ref={privacyRef}
                                    title="Monthly digest"
                                    description="A curated summary of what shipped this month."
                                    placeholder="hello@company.com"
                                    cta-label="Get the digest"
                                    success-message="Thanks for subscribing!"
                                    privacy-href="/privacy"
                                    style={{ maxWidth: '480px' }}
                                />
                            </SectionCard>

                            <SectionCard title="Minimal — no title or description">
                                {/* @ts-ignore */}
                                <tc-newsletter-signup
                                    placeholder="Enter your email"
                                    cta-label="Notify me"
                                    style={{ maxWidth: '480px' }}
                                />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NewsletterSignupDemo

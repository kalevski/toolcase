import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FormWizardDemo: React.FC = () => {
    // ── Basic demo (JS property content) ─────────────────────────────────────
    const basicRef = useRef<any>(null)
    const [lastEvent, setLastEvent] = useState<string>('—')

    useEffect(() => {
        const el = basicRef.current
        if (!el) return

        el.steps = [
            {
                label: 'Account',
                icon: 'user',
                content: '<p style="margin:0">Enter your name and email to create your account.</p>',
            },
            {
                label: 'Profile',
                icon: 'settings',
                content: '<p style="margin:0">Customise your profile: avatar, bio, and preferences.</p>',
            },
            {
                label: 'Plan',
                icon: 'credit-card',
                content: '<p style="margin:0">Choose a subscription plan that fits your needs.</p>',
            },
            {
                label: 'Confirm',
                icon: 'check-circle',
                content: '<p style="margin:0">Review your choices and submit to get started.</p>',
            },
        ]

        const onStepChange = (e: CustomEvent<{ index: number }>) => {
            setLastEvent(`tc-step-change → index ${e.detail.index}`)
        }
        const onComplete = () => {
            setLastEvent('tc-complete fired')
        }

        el.addEventListener('tc-step-change', onStepChange)
        el.addEventListener('tc-complete', onComplete)
        return () => {
            el.removeEventListener('tc-step-change', onStepChange)
            el.removeEventListener('tc-complete', onComplete)
        }
    }, [])

    // ── Slotted content demo ──────────────────────────────────────────────────
    const slotRef = useRef<any>(null)

    useEffect(() => {
        const el = slotRef.current
        if (!el) return
        el.steps = [
            { label: 'Details' },
            { label: 'Address' },
            { label: 'Review' },
        ]
    }, [])

    // ── Loading state demo ────────────────────────────────────────────────────
    const loadingRef = useRef<any>(null)
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const el = loadingRef.current
        if (!el) return
        el.steps = [
            { label: 'Setup', content: '<p style="margin:0">Configure initial settings.</p>' },
            { label: 'Deploy', content: '<p style="margin:0">Deploy your application to production.</p>' },
            { label: 'Done',   content: '<p style="margin:0">Your app is live!</p>' },
        ]
        el.setAttribute('complete-label', 'Launch')
        el.setAttribute('complete-icon', 'rocket')

        const onComplete = () => {
            setIsLoading(true)
            setTimeout(() => setIsLoading(false), 2000)
        }
        el.addEventListener('tc-complete', onComplete)
        return () => el.removeEventListener('tc-complete', onComplete)
    }, [])

    useEffect(() => {
        if (loadingRef.current) {
            if (isLoading) loadingRef.current.setAttribute('loading', '')
            else loadingRef.current.removeAttribute('loading')
        }
    }, [isLoading])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Form Wizard"
                            description="Multi-step form wizard with tab navigation, Back/Next/Complete footer, step icons, slotted content, and loading state. Set steps via the JS steps property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Basic (4 steps, JS content, icons)">
                                <p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
                                    Last event: <strong>{lastEvent}</strong>
                                </p>
                                {/* @ts-ignore */}
                                <tc-form-wizard ref={basicRef} />
                            </SectionCard>

                            <SectionCard title="Slotted content (slot=&quot;step-N&quot;)">
                                {/* @ts-ignore */}
                                <tc-form-wizard ref={slotRef}>
                                    <div slot="step-0">
                                        <p style={{ margin: 0 }}>Fill in your account details here. (slotted content for step 0)</p>
                                    </div>
                                    <div slot="step-1">
                                        <p style={{ margin: 0 }}>Enter your shipping address. (slotted content for step 1)</p>
                                    </div>
                                    <div slot="step-2">
                                        <p style={{ margin: 0 }}>Review your order before confirming. (slotted content for step 2)</p>
                                    </div>
                                </tc-form-wizard>
                            </SectionCard>

                            <SectionCard title="Loading state (click Complete to trigger)">
                                <p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
                                    {isLoading ? 'Simulating a network request… (2 s)' : 'Advance to the last step and click Launch.'}
                                </p>
                                {/* @ts-ignore */}
                                <tc-form-wizard ref={loadingRef} />
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FormWizardDemo

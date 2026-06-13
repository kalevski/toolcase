import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const STEPS = [
    { key: 'account', label: 'Account', description: 'Create your account' },
    { key: 'profile', label: 'Profile', description: 'Set up your profile', optional: true },
    { key: 'plan', label: 'Plan', description: 'Choose a plan' },
    { key: 'confirm', label: 'Confirm', description: 'Review and confirm' },
]

const StepperDemo: React.FC = () => {
    const hRef = useRef<any>(null)
    const vRef = useRef<any>(null)
    const clickRef = useRef<any>(null)
    const [clickActive, setClickActive] = useState('plan')

    useEffect(() => {
        if (!hRef.current) return
        hRef.current.steps = STEPS
    }, [])

    useEffect(() => {
        if (!vRef.current) return
        vRef.current.steps = STEPS
    }, [])

    useEffect(() => {
        if (!clickRef.current) return
        const el = clickRef.current
        el.steps = STEPS
        el.setAttribute('active-step', 'plan')

        const handler = (e: CustomEvent<{ key: string }>) => {
            setClickActive(e.detail.key)
        }
        el.addEventListener('tc-step-click', handler)
        return () => {
            el.removeEventListener('tc-step-click', handler)
        }
    }, [])

    useEffect(() => {
        if (clickRef.current) {
            clickRef.current.setAttribute('active-step', clickActive)
        }
    }, [clickActive])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Stepper"
                            description="Multi-step progress indicator with completion icons and optional clickable navigation. Set steps via the JS steps property; active step controlled via the active-step attribute."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Horizontal (mid-progress)">
                                {/* @ts-ignore */}
                                <tc-stepper ref={hRef} active-step="plan" />
                            </SectionCard>

                            <SectionCard title="Vertical orientation">
                                {/* @ts-ignore */}
                                <tc-stepper ref={vRef} active-step="profile" orientation="vertical" />
                            </SectionCard>

                            <SectionCard title="Clickable — click a step to navigate">
                                <p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
                                    Active step: <strong>{clickActive}</strong>
                                </p>
                                {/* @ts-ignore */}
                                <tc-stepper ref={clickRef} clickable />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default StepperDemo

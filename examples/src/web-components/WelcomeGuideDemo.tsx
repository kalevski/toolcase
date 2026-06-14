import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const INITIAL_STEPS = [
    { key: 'account', label: 'Create your account', completed: true },
    { key: 'profile', label: 'Set up your profile', completed: true },
    { key: 'team', label: 'Invite your team', completed: false },
    { key: 'project', label: 'Create your first project', completed: false },
    { key: 'deploy', label: 'Deploy to production', completed: false },
]

const ALL_DONE_STEPS = [
    { key: 'a', label: 'Account created', completed: true },
    { key: 'b', label: 'Profile complete', completed: true },
    { key: 'c', label: 'Team invited', completed: true },
]

const MESSAGES = [
    'Welcome to Toolcase! Follow these steps to get started.',
    'Each step unlocks the next. Click the active step when done.',
]

const WelcomeGuideDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const interactiveRef = useRef<any>(null)
    const allDoneRef = useRef<any>(null)
    const [steps, setSteps] = useState(INITIAL_STEPS)
    const [lastClicked, setLastClicked] = useState<string | null>(null)

    useEffect(() => {
        if (!basicRef.current) return
        const el = basicRef.current
        el.messages = MESSAGES
        el.steps = INITIAL_STEPS
    }, [])

    useEffect(() => {
        if (!allDoneRef.current) return
        const el = allDoneRef.current
        el.messages = ['You have completed all onboarding steps. Welcome aboard!']
        el.steps = ALL_DONE_STEPS
    }, [])

    useEffect(() => {
        if (!interactiveRef.current) return
        const el = interactiveRef.current
        el.messages = ['Click the highlighted step to mark it complete.']
        el.steps = steps

        const handler = (e: CustomEvent<{ key: string }>) => {
            const key = e.detail.key
            setLastClicked(key)
            setSteps(prev => prev.map(s => s.key === key ? { ...s, completed: true } : s))
        }
        el.addEventListener('tc-step-click', handler)
        return () => el.removeEventListener('tc-step-click', handler)
    }, [])

    useEffect(() => {
        if (interactiveRef.current) {
            interactiveRef.current.steps = steps
        }
    }, [steps])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="WelcomeGuide"
                            description="Onboarding guide with progress tracking and sequential step completion. Steps are driven by the JS steps property; the active step (first not-completed) is auto-derived."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default (some steps completed)">
                                {/* @ts-ignore */}
                                <tc-welcome-guide ref={basicRef} title="Get started with Toolcase" />
                            </SectionCard>

                            <SectionCard title="Interactive — click active step to advance">
                                {/* @ts-ignore */}
                                <tc-welcome-guide
                                    ref={interactiveRef}
                                    title="Your onboarding checklist"
                                    background-pattern-src="https://www.transparenttextures.com/patterns/45-degree-fabric-light.png"
                                    background-pattern-alt=""
                                />
                                {lastClicked && (
                                    <p className="text-muted mt-3 mb-0" style={{ fontSize: '0.875rem' }}>
                                        Last completed step: <strong>{lastClicked}</strong>
                                    </p>
                                )}
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                {/* @ts-ignore */}
                                <tc-welcome-guide title="Loading…" loading />
                            </SectionCard>

                            <SectionCard title="All steps completed">
                                {/* @ts-ignore */}
                                <tc-welcome-guide ref={allDoneRef} title="All done!" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default WelcomeGuideDemo

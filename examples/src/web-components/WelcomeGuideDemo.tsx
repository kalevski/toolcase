import React, { useEffect, useRef, useState } from 'react'
import { Button, RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

type Step = { key: string; label: string; completed: boolean }

const INITIAL_STEPS: Step[] = [
    { key: 'create-project', label: 'Create your first project', completed: true },
    { key: 'upload-asset', label: 'Upload an asset', completed: true },
    { key: 'configure-settings', label: 'Configure game settings', completed: false },
    { key: 'invite-member', label: 'Invite a team member', completed: false },
    { key: 'publish-build', label: 'Publish a build', completed: false },
]

const MESSAGES = [
    'Welcome to Webgame Cloud! Follow the steps on the right to get up and running.',
    'Each step will guide you through a core feature of the platform.',
    'You can revisit this guide anytime from your dashboard.',
]

const ALL_DONE_STEPS: Step[] = [
    { key: 'a', label: 'Account created', completed: true },
    { key: 'b', label: 'Profile complete', completed: true },
    { key: 'c', label: 'Team invited', completed: true },
]

// Inline SVG dot-pattern as a data URI — rides the dark hero as a decorative
// texture (screen-blended, low opacity), mirroring the react demo's DotPattern.
const DOT_PATTERN_SRC =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="2" cy="2" r="1.2" fill="#94a3b8"/></svg>`
    )

const WelcomeGuideDemo: React.FC = () => {
    const withPatternRef = useRef<any>(null)
    const withoutPatternRef = useRef<any>(null)
    const allDoneRef = useRef<any>(null)
    const [steps, setSteps] = useState(INITIAL_STEPS)
    const [showPattern, setShowPattern] = useState(true)

    const toggleStep = (index: number) => {
        setSteps(prev => prev.map((s, i) => (i === index ? { ...s, completed: !s.completed } : s)))
    }

    // Seed messages once and advance the active step when the user clicks it.
    useEffect(() => {
        const handler = (e: Event) => {
            const key = (e as CustomEvent<{ key: string }>).detail.key
            setSteps(prev => prev.map(s => (s.key === key ? { ...s, completed: true } : s)))
        }
        const els = [withPatternRef.current, withoutPatternRef.current].filter(Boolean)
        els.forEach(el => {
            el.messages = MESSAGES
            el.addEventListener('tc-step-click', handler)
        })
        return () => els.forEach(el => el.removeEventListener('tc-step-click', handler))
    }, [])

    // Keep both pattern demos in sync with the toggleable step state.
    useEffect(() => {
        if (withPatternRef.current) withPatternRef.current.steps = steps
        if (withoutPatternRef.current) withoutPatternRef.current.steps = steps
    }, [steps])

    useEffect(() => {
        if (!allDoneRef.current) return
        allDoneRef.current.messages = ['You have completed all onboarding steps. Welcome aboard!']
        allDoneRef.current.steps = ALL_DONE_STEPS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="WelcomeGuide"
                            description="An onboarding card with a dark gradient hero (title + messages) on the left and a step-progress checklist on the right. The active step (first not-completed) is auto-derived; clicking it fires tc-step-click."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="With background pattern">
                                {/* @ts-ignore */}
                                <tc-welcome-guide
                                    ref={withPatternRef}
                                    title="Getting Started"
                                    background-pattern-src={showPattern ? DOT_PATTERN_SRC : undefined}
                                    background-pattern-alt=""
                                />
                            </SectionCard>

                            <SectionCard title="Without background pattern">
                                {/* @ts-ignore */}
                                <tc-welcome-guide ref={withoutPatternRef} title="Getting Started" />
                            </SectionCard>

                            <SectionCard title="Toggle steps">
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {steps.map((step, i) => (
                                        <Button
                                            key={step.key}
                                            variant={step.completed ? 'success' : 'secondary'}
                                            outline={!step.completed}
                                            size="small"
                                            onClick={() => toggleStep(i)}
                                        >
                                            {step.label}
                                        </Button>
                                    ))}
                                    <Button
                                        variant="primary"
                                        outline={!showPattern}
                                        size="small"
                                        onClick={() => setShowPattern(v => !v)}
                                    >
                                        {showPattern ? 'Hide' : 'Show'} Pattern
                                    </Button>
                                </div>
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

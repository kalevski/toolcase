import React, { useEffect, useRef, useState } from 'react'

const CardOptionsDemo: React.FC = () => {
    const iconRef = useRef<any>(null)
    const descRef = useRef<any>(null)
    const fourColRef = useRef<any>(null)

    const [selectedPlan, setSelectedPlan] = useState('starter')
    const [selectedEnv, setSelectedEnv] = useState('development')

    useEffect(() => {
        const el = iconRef.current
        if (!el) return
        el.options = [
            { key: 'shield', label: 'Shield', icon: 'Shield' },
            { key: 'database', label: 'Database', icon: 'Database' },
            { key: 'cloud', label: 'Cloud', icon: 'Cloud' },
        ]
        el.setAttribute('value', 'shield')
        el.setAttribute('aria-label', 'Select a feature')
        const handler = (e: Event) => {
            const key = (e as CustomEvent<{ key: string }>).detail.key
            console.log('tc-change', key)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = descRef.current
        if (!el) return
        el.options = [
            {
                key: 'starter',
                label: 'Starter',
                icon: 'Zap',
                description: 'Up to 3 projects',
            },
            {
                key: 'pro',
                label: 'Pro',
                icon: 'Star',
                description: 'Unlimited projects',
            },
        ]
        el.setAttribute('value', 'starter')
        el.setAttribute('aria-label', 'Select a plan')
        el.setAttribute('columns', '2')
        const handler = (e: Event) => {
            const key = (e as CustomEvent<{ key: string }>).detail.key
            setSelectedPlan(key)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = fourColRef.current
        if (!el) return
        el.options = [
            { key: 'development', label: 'Development', icon: 'Code' },
            { key: 'staging', label: 'Staging', icon: 'FlaskConical' },
            { key: 'preview', label: 'Preview', icon: 'Eye' },
            { key: 'production', label: 'Production', icon: 'Globe' },
        ]
        el.setAttribute('value', 'development')
        el.setAttribute('aria-label', 'Select an environment')
        el.setAttribute('columns', '4')
        const handler = (e: Event) => {
            const key = (e as CustomEvent<{ key: string }>).detail.key
            setSelectedEnv(key)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CardOptions"
                            description="Grid of selectable card options with icons and a check indicator on the selected card. Behaves as an accessible radiogroup with full keyboard navigation."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — 3 columns with icons">
                                <p className="text-muted small mb-3">
                                    Open the browser console to see tc-change events.
                                </p>
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-card-options ref={iconRef} />
                                </div>
                            </tc-section-card>

                            <tc-section-card
                                title={`2 columns with description — selected: ${selectedPlan}`}
                            >
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-card-options ref={descRef} />
                                </div>
                            </tc-section-card>

                            <tc-section-card title={`4 columns — selected: ${selectedEnv}`}>
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-card-options ref={fourColRef} />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CardOptionsDemo

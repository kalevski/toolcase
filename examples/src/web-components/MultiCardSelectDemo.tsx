import React, { useEffect, useRef, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const FRAMEWORK_OPTIONS = [
    { value: 'react', label: 'React', icon: 'Atom', description: 'UI library' },
    { value: 'vue', label: 'Vue', icon: 'Triangle', description: 'Progressive framework' },
    { value: 'svelte', label: 'Svelte', icon: 'Flame', description: 'Compiled components' },
    { value: 'angular', label: 'Angular', icon: 'Box', description: 'Full framework' },
]

const FEATURE_OPTIONS = [
    { value: 'auth', label: 'Authentication', icon: 'Shield' },
    { value: 'db', label: 'Database', icon: 'Database' },
    { value: 'storage', label: 'Storage', icon: 'HardDrive' },
    { value: 'email', label: 'Email', icon: 'Mail' },
    { value: 'analytics', label: 'Analytics', icon: 'BarChart2' },
    { value: 'search', label: 'Search', icon: 'Search', disabled: true },
]

const MultiCardSelectDemo: React.FC = () => {
    const loadingRef = useRef<any>(null)

    const [selected, setSelected] = useState<string[]>([])
    const [controlledValue, setControlledValue] = useState<string[]>(['react', 'vue'])

    const basicRef = useTc<HTMLElement>(
        { options: FRAMEWORK_OPTIONS },
        {
            'tc-change': (e: Event) => {
                const detail = (e as CustomEvent<{ value: string[] }>).detail
                setSelected(detail.value)
            },
        }
    )
    useEffect(() => {
        basicRef.current?.setAttribute('aria-label', 'Select frameworks')
    }, [])

    const controlledRef = useTc<HTMLElement>(
        { options: FEATURE_OPTIONS, value: controlledValue },
        {
            'tc-change': (e: Event) => {
                const detail = (e as CustomEvent<{ value: string[] }>).detail
                setControlledValue(detail.value)
            },
        }
    )
    useEffect(() => {
        const el = controlledRef.current
        if (!el) return
        el.setAttribute('aria-label', 'Select features')
        el.setAttribute('columns', '3')
    }, [])

    const formRef = useTc<HTMLElement>({ options: FRAMEWORK_OPTIONS.slice(0, 3) })
    useEffect(() => {
        const el = formRef.current
        if (!el) return
        el.setAttribute('aria-label', 'Select frameworks')
        el.setAttribute('columns', '3')
    }, [])

    useEffect(() => {
        const el = loadingRef.current
        if (!el) return
        el.setAttribute('loading', '')
        el.setAttribute('loading-count', '4')
        el.setAttribute('columns', '2')
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="MultiCardSelect"
                            description="Multi-select card grid with icons, descriptions, and a check indicator on selected cards. Behaves as an accessible checkgroup with full keyboard navigation."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card
                                title={`Default — 2 columns${selected.length ? ` (selected: ${selected.join(', ')})` : ''}`}
                            >
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-multi-card-select ref={basicRef} columns="2" />
                                </div>
                            </tc-section-card>

                            <tc-section-card
                                title={`Controlled — 3 columns (selected: ${controlledValue.length ? controlledValue.join(', ') : 'none'})`}
                            >
                                <div style={{ maxWidth: 720 }}>
                                    {/* @ts-ignore */}
                                    <tc-multi-card-select ref={controlledRef} />
                                </div>
                                <div className="d-flex gap-2 mt-3 flex-wrap">
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setControlledValue(['auth', 'db'])}
                                    >
                                        Set Auth + DB
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setControlledValue([])}
                                    >
                                        Clear all
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() =>
                                            setControlledValue([
                                                'auth',
                                                'db',
                                                'storage',
                                                'email',
                                                'analytics',
                                            ])
                                        }
                                    >
                                        Select all
                                    </button>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Inside a form (name attribute — inspect form data on submit)">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        const fd = new FormData(e.currentTarget)
                                        console.log('Form data:', [...fd.entries()])
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-multi-card-select
                                        ref={formRef}
                                        name="frameworks"
                                        style={{ maxWidth: 480 }}
                                    />
                                    <div className="mt-3">
                                        <button type="submit" className="btn btn-primary btn-sm">
                                            Submit (check console)
                                        </button>
                                    </div>
                                </form>
                            </tc-section-card>

                            <tc-section-card title="Loading skeleton">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-multi-card-select ref={loadingRef} />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MultiCardSelectDemo

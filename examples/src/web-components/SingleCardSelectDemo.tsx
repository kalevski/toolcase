import React, { useEffect, useRef, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const FRAMEWORK_OPTIONS = [
    {
        key: 'react',
        title: 'React',
        description: 'A JavaScript library for building user interfaces',
    },
    { key: 'vue', title: 'Vue', description: 'The progressive JavaScript framework' },
    {
        key: 'angular',
        title: 'Angular',
        description: 'Platform for building mobile & desktop apps',
    },
    { key: 'svelte', title: 'Svelte', description: 'Cybernetically enhanced web apps' },
]

const SIZE_OPTIONS = [
    { key: 'small', title: 'Small' },
    { key: 'medium', title: 'Medium' },
    { key: 'large', title: 'Large' },
]

const SingleCardSelectDemo: React.FC = () => {
    const loadingRef = useRef<any>(null)

    const [selected, setSelected] = useState<string | null>(null)
    const [size, setSize] = useState<string | null>('medium')

    const basicRef = useTc<HTMLElement>(
        { options: FRAMEWORK_OPTIONS, value: selected },
        {
            'tc-change': (e: Event) => {
                setSelected((e as CustomEvent<{ value: string }>).detail.value)
            },
        }
    )

    const columnsRef = useTc<HTMLElement>(
        { options: SIZE_OPTIONS, value: size },
        {
            'tc-change': (e: Event) => {
                setSize((e as CustomEvent<{ value: string }>).detail.value)
            },
        }
    )

    const formRef = useTc<HTMLElement>({ options: FRAMEWORK_OPTIONS })

    useEffect(() => {
        basicRef.current?.setAttribute('aria-label', 'Select a framework')
    }, [])

    useEffect(() => {
        columnsRef.current?.setAttribute('aria-label', 'Select a size')
    }, [])

    useEffect(() => {
        formRef.current?.setAttribute('aria-label', 'Select a framework')
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
                            title-text="SingleCardSelect"
                            description="Single-selection card grid (radiogroup pattern) with optional descriptions and a configurable column count. Fully keyboard-accessible: Arrow keys move focus between cards, Space/Enter selects the focused card."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card
                                title={`Controlled — auto-fill columns (selected: ${selected ?? 'none'})`}
                            >
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-single-card-select ref={basicRef} />
                                </div>
                                <div className="d-flex gap-2 mt-3 flex-wrap">
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setSelected('vue')}
                                    >
                                        Select Vue
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setSelected(null)}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </tc-section-card>

                            <tc-section-card
                                title={`Fixed columns — 3 (selected: ${size ?? 'none'})`}
                            >
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-single-card-select ref={columnsRef} columns="3" />
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
                                    <tc-single-card-select
                                        ref={formRef}
                                        name="framework"
                                        columns="2"
                                        value="react"
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
                                    <tc-single-card-select ref={loadingRef} />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SingleCardSelectDemo

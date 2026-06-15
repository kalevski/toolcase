import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FRAMEWORK_OPTIONS = [
    { key: 'react', title: 'React', description: 'A JavaScript library for building user interfaces' },
    { key: 'vue', title: 'Vue', description: 'The progressive JavaScript framework' },
    { key: 'angular', title: 'Angular', description: 'Platform for building mobile & desktop apps' },
    { key: 'svelte', title: 'Svelte', description: 'Cybernetically enhanced web apps' },
]

const SIZE_OPTIONS = [
    { key: 'small', title: 'Small' },
    { key: 'medium', title: 'Medium' },
    { key: 'large', title: 'Large' },
]

const SingleCardSelectDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const columnsRef = useRef<any>(null)
    const formRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)

    const [selected, setSelected] = useState<string | null>(null)
    const [size, setSize] = useState<string | null>('medium')

    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        el.options = FRAMEWORK_OPTIONS
        el.setAttribute('aria-label', 'Select a framework')
        const handler = (e: Event) => {
            setSelected((e as CustomEvent<{ value: string }>).detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = basicRef.current
        if (el) el.value = selected
    }, [selected])

    useEffect(() => {
        const el = columnsRef.current
        if (!el) return
        el.options = SIZE_OPTIONS
        el.value = size
        el.setAttribute('aria-label', 'Select a size')
        const handler = (e: Event) => {
            setSize((e as CustomEvent<{ value: string }>).detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        const el = columnsRef.current
        if (el) el.value = size
    }, [size])

    useEffect(() => {
        const el = formRef.current
        if (!el) return
        el.options = FRAMEWORK_OPTIONS
        el.setAttribute('aria-label', 'Select a framework')
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
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="SingleCardSelect"
                            description="Single-selection card grid (radiogroup pattern) with optional descriptions and a configurable column count. Fully keyboard-accessible: Arrow keys move focus between cards, Space/Enter selects the focused card."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title={`Controlled — auto-fill columns (selected: ${selected ?? 'none'})`}>
                                <div style={{ maxWidth: 640 }}>
                                    {/* @ts-ignore */}
                                    <tc-single-card-select ref={basicRef} />
                                </div>
                                <div className="d-flex gap-2 mt-3 flex-wrap">
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelected('vue')}>
                                        Select Vue
                                    </button>
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelected(null)}>
                                        Clear
                                    </button>
                                </div>
                            </SectionCard>

                            <SectionCard title={`Fixed columns — 3 (selected: ${size ?? 'none'})`}>
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-single-card-select ref={columnsRef} columns="3" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Inside a form (name attribute — inspect form data on submit)">
                                <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); console.log('Form data:', [...fd.entries()]) }}>
                                    {/* @ts-ignore */}
                                    <tc-single-card-select ref={formRef} name="framework" columns="2" value="react" style={{ maxWidth: 480 }} />
                                    <div className="mt-3">
                                        <button type="submit" className="btn btn-primary btn-sm">
                                            Submit (check console)
                                        </button>
                                    </div>
                                </form>
                            </SectionCard>

                            <SectionCard title="Loading skeleton">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-single-card-select ref={loadingRef} />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SingleCardSelectDemo

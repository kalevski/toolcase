import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FRAMEWORK_ITEMS = [
    { key: 'react', label: 'React', description: 'A JavaScript library for building user interfaces' },
    { key: 'vue', label: 'Vue', description: 'The progressive JavaScript framework' },
    { key: 'svelte', label: 'Svelte', description: 'Cybernetically enhanced web apps' },
    { key: 'angular', label: 'Angular', description: 'Platform for building mobile & desktop apps' },
    { key: 'solid', label: 'SolidJS', description: 'Simple and performant reactivity for building user interfaces' },
    { key: 'qwik', label: 'Qwik', description: 'Instant-on web apps at any scale' },
]

const COUNTRY_ITEMS = [
    { key: 'us', label: 'United States' },
    { key: 'gb', label: 'United Kingdom' },
    { key: 'de', label: 'Germany' },
    { key: 'fr', label: 'France' },
    { key: 'jp', label: 'Japan' },
    { key: 'ca', label: 'Canada' },
    { key: 'au', label: 'Australia' },
    { key: 'br', label: 'Brazil' },
]

const ExtendedSelectDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const preselectedRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)
    const formRef = useRef<any>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [preselectedValue, setPreselectedValue] = useState<string>('react')
    const [submitted, setSubmitted] = useState<string | null>(null)

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.items = FRAMEWORK_ITEMS
        const handler = (e: Event) => {
            setSelected((e as CustomEvent<{ value: string }>).detail.value)
        }
        basicRef.current.addEventListener('tc-change', handler)
        return () => basicRef.current?.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        if (!preselectedRef.current) return
        preselectedRef.current.items = COUNTRY_ITEMS
        const handler = (e: Event) => {
            setPreselectedValue((e as CustomEvent<{ value: string }>).detail.value)
        }
        preselectedRef.current.addEventListener('tc-change', handler)
        return () => preselectedRef.current?.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        if (!loadingRef.current) return
        loadingRef.current.items = FRAMEWORK_ITEMS
    }, [])

    useEffect(() => {
        if (!formRef.current) return
        formRef.current.items = FRAMEWORK_ITEMS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ExtendedSelect"
                            description="Searchable dropdown with debounced filtering, keyboard navigation, item descriptions, and native form-submission support. Set items via the items JS property; listen for tc-change events."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="With descriptions — framework picker">
                                <p className="text-muted small mb-3">
                                    Items are set via the <code>items</code> JS property. Each item can carry an
                                    optional <code>description</code> line. Type to filter (debounced 150 ms);
                                    Arrow keys navigate; Enter selects; Escape closes.
                                </p>
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={basicRef}
                                        placeholder="Choose a framework…"
                                        search-placeholder="Search frameworks…"
                                        name="framework"
                                    />
                                </div>
                                {selected && (
                                    <p className="mt-3 text-muted small">
                                        Selected: <strong>{selected}</strong>
                                    </p>
                                )}
                            </SectionCard>

                            <SectionCard title="Preselected value">
                                <p className="text-muted small mb-3">
                                    Pass a <code>value</code> attribute (or JS property) to set an initial
                                    selection. The trigger shows the item's label; a check mark highlights the
                                    selected row in the list.
                                </p>
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={preselectedRef}
                                        value={preselectedValue}
                                        placeholder="Choose a country…"
                                        name="country"
                                    />
                                </div>
                                <p className="mt-3 text-muted small">
                                    Current value: <strong>{preselectedValue}</strong>
                                </p>
                            </SectionCard>

                            <SectionCard title="Loading state">
                                <p className="text-muted small mb-3">
                                    Set the boolean <code>loading</code> attribute to disable the trigger and show
                                    a spinner inside the menu. The dropdown cannot be opened while loading.
                                </p>
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={loadingRef}
                                        placeholder="Fetching options…"
                                        loading
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Native form submission">
                                <p className="text-muted small mb-3">
                                    Inside a <code>&lt;form&gt;</code> the selected value is submitted via a hidden{' '}
                                    <code>&lt;input type=&quot;hidden&quot;&gt;</code>. The <code>name</code>{' '}
                                    attribute sets the field name for <code>FormData</code>.
                                </p>
                                <form
                                    onSubmit={e => {
                                        e.preventDefault()
                                        const fd = new FormData(e.currentTarget)
                                        setSubmitted(String(fd.get('tool') ?? ''))
                                    }}
                                    style={{ maxWidth: 400 }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={formRef}
                                        placeholder="Pick a tool…"
                                        name="tool"
                                        style={{ marginBottom: '0.75rem' } as React.CSSProperties}
                                    />
                                    <button type="submit" className="btn btn-primary btn-sm">
                                        Submit form
                                    </button>
                                </form>
                                {submitted !== null && (
                                    <p className="mt-3 text-muted small">
                                        Submitted <code>tool</code>: <strong>{submitted || '(empty)'}</strong>
                                    </p>
                                )}
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ExtendedSelectDemo

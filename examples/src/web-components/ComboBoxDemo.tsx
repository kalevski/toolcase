import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FRAMEWORK_OPTIONS = [
    { value: 'react', label: 'React', keywords: ['meta', 'jsx', 'hooks'] },
    { value: 'vue', label: 'Vue', keywords: ['progressive', 'sfc'] },
    { value: 'svelte', label: 'Svelte', keywords: ['compiler'] },
    { value: 'angular', label: 'Angular', keywords: ['google', 'rxjs'] },
    { value: 'solid', label: 'SolidJS', keywords: ['reactivity', 'signals'] },
    { value: 'qwik', label: 'Qwik', keywords: ['resumable'] },
    { value: 'preact', label: 'Preact', keywords: ['lightweight'] },
]

const TIMEZONE_OPTIONS = [
    { value: 'utc', label: 'UTC' },
    { value: 'cet', label: 'Central European Time' },
    { value: 'est', label: 'Eastern Standard Time' },
    { value: 'pst', label: 'Pacific Standard Time' },
    { value: 'jst', label: 'Japan Standard Time' },
]

const ComboBoxDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const preselectedRef = useRef<any>(null)
    const disabledRef = useRef<any>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [tz, setTz] = useState<string>('cet')

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.options = FRAMEWORK_OPTIONS
        const handler = (e: Event) => {
            setSelected((e as CustomEvent<{ value: string }>).detail.value)
        }
        basicRef.current.addEventListener('tc-change', handler)
        return () => basicRef.current?.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        if (!preselectedRef.current) return
        preselectedRef.current.options = TIMEZONE_OPTIONS
        const handler = (e: Event) => {
            setTz((e as CustomEvent<{ value: string }>).detail.value)
        }
        preselectedRef.current.addEventListener('tc-change', handler)
        return () => preselectedRef.current?.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        if (!disabledRef.current) return
        disabledRef.current.options = FRAMEWORK_OPTIONS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ComboBox"
                            description="A trigger button with a filterable dropdown of options. Set options via the options JS property; type in the search field to filter by label, value, or keywords; listen for tc-change."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Filterable framework picker">
                                <p className="text-muted small mb-3">
                                    Options are set via the <code>options</code> JS property. Click the trigger
                                    to open; type to filter (matches <code>label</code>, <code>value</code>, and{' '}
                                    <code>keywords</code>); press Enter to pick the first match; Escape closes.
                                </p>
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-combo-box ref={basicRef} placeholder="Choose a framework…" />
                                </div>
                                {selected && (
                                    <p className="mt-3 text-muted small">
                                        Selected: <strong>{selected}</strong>
                                    </p>
                                )}
                            </SectionCard>

                            <SectionCard title="Preselected value">
                                <p className="text-muted small mb-3">
                                    Pass a <code>value</code> attribute to set an initial selection; the trigger
                                    shows that option's label and the matching row is highlighted in the list.
                                </p>
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-combo-box
                                        ref={preselectedRef}
                                        value={tz}
                                        placeholder="Choose a timezone…"
                                    />
                                </div>
                                <p className="mt-3 text-muted small">
                                    Current value: <strong>{tz}</strong>
                                </p>
                            </SectionCard>

                            <SectionCard title="Disabled state">
                                <p className="text-muted small mb-3">
                                    The boolean <code>disabled</code> attribute dims the trigger and prevents the
                                    dropdown from opening.
                                </p>
                                <div style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-combo-box
                                        ref={disabledRef}
                                        value="react"
                                        placeholder="Unavailable…"
                                        disabled
                                    />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ComboBoxDemo

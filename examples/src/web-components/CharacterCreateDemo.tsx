import React, { useEffect, useRef, useState } from 'react'

const FIELDS = [
    {
        id: 'class',
        label: 'Class',
        type: 'select',
        options: [
            { value: 'warrior', label: 'Warrior' },
            { value: 'mage', label: 'Mage' },
            { value: 'ranger', label: 'Ranger' },
        ],
    },
    {
        id: 'hair',
        label: 'Hair colour',
        type: 'select',
        options: [
            { value: 'black', label: 'Black' },
            { value: 'blonde', label: 'Blonde' },
            { value: 'auburn', label: 'Auburn' },
        ],
    },
    { id: 'age', label: 'Age', type: 'number', min: 18, max: 120 },
    { id: 'strength', label: 'Strength', type: 'range', min: 1, max: 20 },
    { id: 'title', label: 'Epithet', type: 'text' },
]

const CharacterCreateDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const controlledRef = useRef<any>(null)

    const [summary, setSummary] = useState<string>('(nothing confirmed yet)')
    const [liveName, setLiveName] = useState<string>('')

    useEffect(() => {
        const el = basicRef.current
        if (!el) return
        el.fields = FIELDS

        const onName = (e: Event) => setLiveName((e as CustomEvent<{ value: string }>).detail.value)
        const onConfirm = (e: Event) => {
            const detail = (
                e as CustomEvent<{ name: string; values: Record<string, string | number> }>
            ).detail
            setSummary(JSON.stringify({ name: detail.name, ...detail.values }))
        }
        el.addEventListener('tc-name', onName)
        el.addEventListener('tc-confirm', onConfirm)
        return () => {
            el.removeEventListener('tc-name', onName)
            el.removeEventListener('tc-confirm', onConfirm)
        }
    }, [])

    useEffect(() => {
        const el = controlledRef.current
        if (!el) return
        el.fields = FIELDS
        el.values = { class: 'mage', hair: 'auburn', age: 31, strength: 14, title: 'the Bold' }
        el.name = 'Lyra'
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CharacterCreate"
                            description="Character-creation panel: a name field plus a data-driven list of appearance/class fields (text, select, number, range) and a confirm action. Fields are set via the `fields` JS property; emits tc-name, tc-change, and tc-confirm."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (data-driven fields, uncontrolled)">
                                {/* @ts-ignore */}
                                <tc-character-create ref={basicRef} />
                                <div className="form-text mt-3">
                                    Live name: {liveName || '(empty)'}
                                </div>
                                <div className="form-text">
                                    Last confirmed: <code>{summary}</code>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Controlled (pre-filled name + values)">
                                {/* @ts-ignore */}
                                <tc-character-create
                                    ref={controlledRef}
                                    confirm-label="Create hero"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CharacterCreateDemo

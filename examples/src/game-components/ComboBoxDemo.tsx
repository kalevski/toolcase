import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const OPTIONS = [
    { value: 'human', label: 'Human', keywords: ['man'] },
    { value: 'elf', label: 'Elf' },
    { value: 'dwarf', label: 'Dwarf' },
    { value: 'orc', label: 'Orc' },
    { value: 'tiefling', label: 'Tiefling' },
    { value: 'gnome', label: 'Gnome' },
    { value: 'halfling', label: 'Halfling' },
]

const ComboBoxDemo: React.FC = () => {
    const refDefault = useRef<HTMLElement>(null)
    const refDisabled = useRef<HTMLElement>(null)
    const [value, setValue] = useState('elf')

    useEffect(() => {
        const a: any = refDefault.current
        const b: any = refDisabled.current
        if (a) a.options = OPTIONS
        if (b) b.options = OPTIONS
    }, [])

    useEffect(() => {
        const el = refDefault.current
        if (!el) return
        const handler = (event: any) => setValue(event.detail.value)
        el.addEventListener('change', handler)
        return () => el.removeEventListener('change', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Combo Box"
                        description="Searchable dropdown. Filter by label/value/keywords. Emits change."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Default — value: ${value}`} />
                            {/* @ts-ignore */}
                            <gc-combo-box ref={refDefault} value={value} placeholder="Choose race…" />
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Disabled" />
                            {/* @ts-ignore */}
                            <gc-combo-box ref={refDisabled} disabled placeholder="Locked" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ComboBoxDemo

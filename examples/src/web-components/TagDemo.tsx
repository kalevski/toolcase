import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

type TagVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'

const ALL_VARIANTS: TagVariant[] = ['primary', 'secondary', 'info', 'success', 'warning', 'danger']

function RemovableVariants() {
    const [visible, setVisible] = useState<Record<TagVariant, boolean>>(
        Object.fromEntries(ALL_VARIANTS.map(v => [v, true])) as Record<TagVariant, boolean>
    )
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const handler = (e: Event) => {
            const tag = (e.target as HTMLElement).closest('tc-tag')
            if (!tag) return
            const variant = tag.getAttribute('variant') as TagVariant
            if (variant) setVisible(prev => ({ ...prev, [variant]: false }))
        }
        el.addEventListener('tc-remove', handler)
        return () => el.removeEventListener('tc-remove', handler)
    }, [])

    return (
        <div ref={containerRef} className="d-flex flex-wrap gap-2">
            {ALL_VARIANTS.map(v =>
                visible[v] ? (
                    <React.Fragment key={v}>
                        {/* @ts-ignore */}
                        <tc-tag variant={v} removable>{v}</tc-tag>
                    </React.Fragment>
                ) : null
            )}
            {ALL_VARIANTS.every(v => !visible[v]) && (
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => setVisible(Object.fromEntries(ALL_VARIANTS.map(v => [v, true])) as Record<TagVariant, boolean>)}
                >
                    Reset
                </button>
            )}
        </div>
    )
}

const TagDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Tag"
                        description="Badge-like rectangular tag with color variants and an optional remove button. Dispatches tc-remove when the remove button is activated."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants (slotted text)">
                            <div className="d-flex flex-wrap gap-2">
                                {ALL_VARIANTS.map(v => (
                                    <React.Fragment key={v}>
                                        {/* @ts-ignore */}
                                        <tc-tag variant={v}>{v}</tc-tag>
                                    </React.Fragment>
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Removable — click × to hide (tc-remove listener)">
                            <RemovableVariants />
                        </SectionCard>

                        <SectionCard title="Removable (all variants, static)">
                            <div className="d-flex flex-wrap gap-2">
                                {ALL_VARIANTS.map(v => (
                                    <React.Fragment key={v}>
                                        {/* @ts-ignore */}
                                        <tc-tag variant={v} removable>{v}</tc-tag>
                                    </React.Fragment>
                                ))}
                            </div>
                        </SectionCard>

                        <SectionCard title="Default variant (secondary)">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-tag>Default tag</tc-tag>
                                {/* @ts-ignore */}
                                <tc-tag removable>Removable default</tc-tag>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default TagDemo

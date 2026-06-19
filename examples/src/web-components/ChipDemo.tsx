import React, { useEffect, useRef, useState } from 'react'

type ChipVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'

const ALL_VARIANTS: ChipVariant[] = ['primary', 'secondary', 'info', 'success', 'warning', 'danger']

const TAGS = ['React', 'TypeScript', 'Node.js', 'GraphQL', 'Rust']

function SelectableChips() {
    const [selected, setSelected] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const handler = (e: Event) => {
            const chip = (e.target as HTMLElement).closest('tc-chip')
            if (!chip) return
            const key = chip.getAttribute('data-key')
            if (!key) return
            setSelected((prev) => (prev === key ? null : key))
        }
        el.addEventListener('tc-click', handler)
        return () => el.removeEventListener('tc-click', handler)
    }, [])

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        el.querySelectorAll('tc-chip').forEach((chip) => {
            const key = chip.getAttribute('data-key')
            if (key === selected) chip.setAttribute('selected', '')
            else chip.removeAttribute('selected')
        })
    }, [selected])

    return (
        <div ref={containerRef} className="d-flex flex-wrap gap-2">
            {TAGS.map((tag) => (
                <React.Fragment key={tag}>
                    {/* @ts-ignore */}
                    <tc-chip data-key={tag}>{tag}</tc-chip>
                </React.Fragment>
            ))}
        </div>
    )
}

function RemovableChipExample() {
    const [visible, setVisible] = useState(true)
    const chipRef = useRef<any>(null)

    useEffect(() => {
        const el = chipRef.current
        if (!el) return
        const handler = () => setVisible(false)
        el.addEventListener('tc-remove', handler)
        return () => el.removeEventListener('tc-remove', handler)
    }, [])

    if (!visible) {
        return (
            <button className="btn btn-sm btn-secondary" onClick={() => setVisible(true)}>
                Reset
            </button>
        )
    }

    return (
        <>
            {/* @ts-ignore */}
            <tc-chip ref={chipRef} variant="success" removable>
                Removable chip
            </tc-chip>
        </>
    )
}

const ChipDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Chip"
                        description="Compact interactive chip with optional icon, count badge, and remove button. Dispatches tc-click on body activation and tc-remove when the remove button is clicked."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Variants">
                            <div className="d-flex flex-wrap gap-2">
                                {ALL_VARIANTS.map((v) => (
                                    <React.Fragment key={v}>
                                        {/* @ts-ignore */}
                                        <tc-chip variant={v}>{v}</tc-chip>
                                    </React.Fragment>
                                ))}
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Selected state (click to toggle)">
                            <SelectableChips />
                        </tc-section-card>

                        <tc-section-card title="With leading icon">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-chip icon="Tag">Tag</tc-chip>
                                {/* @ts-ignore */}
                                <tc-chip icon="Star" variant="warning">
                                    Star
                                </tc-chip>
                                {/* @ts-ignore */}
                                <tc-chip icon="Shield" variant="success">
                                    Verified
                                </tc-chip>
                                {/* @ts-ignore */}
                                <tc-chip icon="AlertTriangle" variant="danger">
                                    Alert
                                </tc-chip>
                                {/* @ts-ignore */}
                                <tc-chip icon="Bell" variant="info">
                                    Info
                                </tc-chip>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="With count badge">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-chip count="12">Messages</tc-chip>
                                {/* @ts-ignore */}
                                <tc-chip count="99+" variant="danger">
                                    Errors
                                </tc-chip>
                                {/* @ts-ignore */}
                                <tc-chip icon="Bell" count="3" variant="info">
                                    Notifications
                                </tc-chip>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Removable — click × to hide (tc-remove listener)">
                            <RemovableChipExample />
                        </tc-section-card>

                        <tc-section-card title="Disabled">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-chip disabled>Disabled</tc-chip>
                                {/* @ts-ignore */}
                                <tc-chip disabled variant="primary">
                                    Disabled Primary
                                </tc-chip>
                                {/* @ts-ignore */}
                                <tc-chip disabled removable>
                                    Disabled Removable
                                </tc-chip>
                                {/* @ts-ignore */}
                                <tc-chip disabled selected>
                                    Disabled Selected
                                </tc-chip>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default ChipDemo

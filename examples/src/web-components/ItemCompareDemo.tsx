import React, { useEffect, useRef } from 'react'

const EQUIPPED = {
    id: 'iron-sword',
    name: 'Iron Sword',
    typeLabel: 'One-Handed Sword',
    stats: [
        { label: 'Damage', value: 42 },
        { label: 'Attack Speed', value: 1.2 },
        { label: 'Weight', value: 6 },
        { label: 'Quality', value: 'Fine' },
    ],
}

const CANDIDATE = {
    id: 'steel-saber',
    name: 'Steel Saber',
    typeLabel: 'One-Handed Sword',
    stats: [
        { label: 'Damage', value: 58 },
        { label: 'Attack Speed', value: 1.1 },
        { label: 'Weight', value: 8 },
        { label: 'Crit Chance', value: 5 },
        { label: 'Quality', value: 'Superior' },
    ],
}

const ItemCompareDemo: React.FC = () => {
    const pairRef = useRef<any>(null)
    const emptyRef = useRef<any>(null)
    const downgradeRef = useRef<any>(null)

    useEffect(() => {
        if (pairRef.current) {
            pairRef.current.current = EQUIPPED
            pairRef.current.candidate = CANDIDATE
        }
    }, [])

    useEffect(() => {
        // Only an equipped item — the candidate column shows the empty placeholder.
        if (emptyRef.current) {
            emptyRef.current.current = EQUIPPED
            emptyRef.current.candidate = null
        }
    }, [])

    useEffect(() => {
        // A strictly worse candidate — deltas trend down (danger red).
        if (downgradeRef.current) {
            downgradeRef.current.current = CANDIDATE
            downgradeRef.current.candidate = EQUIPPED
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ItemCompare"
                            description="A side-by-side item stat comparison: an equipped item next to a candidate, with the candidate column annotated by a per-stat difference block (green up / red down). Set the current and candidate items via the JS properties. Built in the toolcase design system — no gilded frames, no glows; sharp hairline columns and mono machine-facing figures."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Equipped vs candidate (upgrade)">
                                {/* @ts-ignore */}
                                <tc-item-compare ref={pairRef} />
                            </tc-section-card>

                            <tc-section-card title="Only an equipped item">
                                {/* @ts-ignore */}
                                <tc-item-compare ref={emptyRef} />
                            </tc-section-card>

                            <tc-section-card title="A downgrade (deltas trend down)">
                                {/* @ts-ignore */}
                                <tc-item-compare ref={downgradeRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ItemCompareDemo

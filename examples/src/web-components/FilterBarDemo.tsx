import React, { useEffect, useRef, useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const ROWS = [
    {
        key: 'genre',
        legend: 'Genre',
        options: [
            { value: 'arcade', label: 'Arcade', count: 42 },
            { value: 'puzzle', label: 'Puzzle', count: 31 },
            { value: 'rpg', label: 'RPG', count: 18 },
        ],
    },
    {
        key: 'engine',
        legend: 'Engine',
        options: [
            { value: 'phaser', label: 'Phaser', count: 64 },
            { value: 'three', label: 'three.js', count: 22 },
            { value: 'custom', label: 'Custom', count: 5 },
        ],
    },
]

const FilterBarDemo: React.FC = () => {
    const [picked, setPicked] = useState<Record<string, string | null>>({})
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        if (ref.current) (ref.current as never as { rows: unknown }).rows = ROWS
    }, [])

    const active = Object.values(picked).some(Boolean)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FilterBar"
                            description="A filter toolbar: labelled facet rows, a result count and a clear-all. The desktop sibling of tc-filter-trigger plus a sheet."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Browse
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Every dimension on screen">
                                <tc-filter-bar
                                    ref={ref}
                                    total={210}
                                    matches={active ? 48 : 210}
                                    unit="games"
                                    active={active}
                                    ontc-change={(e) =>
                                        setPicked((current) => ({
                                            ...current,
                                            [e.detail.key]: e.detail.value,
                                        }))
                                    }
                                    ontc-clear={() => setPicked({})}
                                />
                                <p style={note} className="mt-3">
                                    A bar keeps every dimension on screen, so the reader sees what
                                    they have narrowed without opening anything — worth the vertical
                                    space on a wide viewport and exactly wrong on a phone, which is
                                    what <code>tc-filter-trigger</code> plus a sheet is for.
                                </p>
                                <p style={note}>
                                    It composes <code>tc-facet-picker</code> rather than redrawing
                                    chips: one dimension is a facet, so the bar owns the frame and
                                    the facet owns the chips — and the two answer the same event, so
                                    you wire one handler.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FilterBarDemo

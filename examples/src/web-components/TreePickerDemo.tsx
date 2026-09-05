import React, { useEffect, useRef, useState } from 'react'

const note: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
    lineHeight: 1.5,
}

const PLACES = [
    {
        id: 'mk',
        label: 'North Macedonia',
        children: [
            {
                id: 'skopje',
                label: 'Skopje region',
                children: [
                    { id: 'centar', label: 'Centar', keywords: ['center'] },
                    { id: 'karpos', label: 'Karpoš' },
                    { id: 'aerodrom', label: 'Aerodrom' },
                ],
            },
            {
                id: 'vardar',
                label: 'Vardar region',
                children: [
                    { id: 'veles', label: 'Veles' },
                    { id: 'kavadarci', label: 'Kavadarci' },
                ],
            },
        ],
    },
    { id: 'abroad', label: 'Abroad' },
]

const TreePickerDemo: React.FC = () => {
    const [value, setValue] = useState<string[]>([])
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        if (ref.current) (ref.current as never as { nodes: unknown }).nodes = PLACES
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="TreePicker"
                            description="Pick leaves out of a hierarchy, by searching or by drilling into it. polovni.mk's LocationPicker + LocationTree with the place vocabulary taken out."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Forms
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-3 mt-4">
                            <tc-section-card title="Drill in, or type">
                                <tc-tree-picker
                                    ref={ref}
                                    multiple
                                    search-placeholder="Search places"
                                    ontc-change={(e) => setValue(e.detail.value)}
                                />
                                <p style={note} className="mt-3">
                                    picked: <strong>{value.length ? value.join(', ') : '—'}</strong>
                                </p>
                                <p style={note}>
                                    <strong>Not tc-tree-view.</strong> That one <em>shows</em> a
                                    hierarchy — expand in place, everything visible at once. This
                                    one <em>picks</em> out of one: a level at a time with a
                                    breadcrumb back out, because a phone screen cannot show a
                                    four-deep tree and a reader narrowing a filter does not want to
                                    see the branches they have already rejected.
                                </p>
                                <p style={note}>
                                    <strong>Search flattens.</strong> Typing switches the list to
                                    every node whose label or keywords match, wherever it lives,
                                    each row carrying its own path — which is the only way a deep
                                    tree is usable on a phone. A branch is a way <em>in</em>, never
                                    a value.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TreePickerDemo

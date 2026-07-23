import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const ITEMS = [
    { label: 'Adaptive cruise control', flag: 'included' },
    { label: 'Matrix LED headlights', flag: 'included' },
    { label: 'Lane keeping assist', flag: 'included' },
    { label: 'Dual-zone climate control', flag: 'included' },
    { label: 'Heated front seats', icon: 'armchair', flag: 'included' },
    { label: 'Wireless phone charging', flag: 'included' },
    { label: 'Rear-view camera', icon: 'video', flag: 'included' },
    { label: 'Panoramic sunroof', flag: 'optional' },
    { label: 'Premium sound system', icon: 'speaker', flag: 'optional' },
    { label: 'Ventilated seats', flag: 'optional' },
    { label: 'Head-up display', flag: 'optional' },
    { label: 'Winter package', flag: 'package' },
    { label: 'Off-road package', flag: 'package' },
    { label: 'Night vision package', icon: 'moon', flag: 'package' },
]

const EquipmentMatrixDemo: React.FC = () => {
    const chipsRef = useTc<HTMLElement>({ items: ITEMS })
    const listRef = useTc<HTMLElement>({ items: ITEMS })
    const collapsibleRef = useTc<HTMLElement>({ items: ITEMS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Equipment Matrix"
                            description="The full equipment sheet of one catalog variant (the variant_equipment link table): items grouped by feature flag into Standard equipment / Optional extras / Packages sections, each capped by a mono micro-header with an item count. Items are a JS property; sections with no items are omitted. Renders tc-equipment-tag chips by default, or a dense two-column checklist with columns='list'."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Chips (default)">
                                <p className="text-muted small mb-3">
                                    Each item renders as a <code>tc-equipment-tag</code>, grouped by
                                    its <code>feature_flag</code>. Set <code>items</code> via a ref
                                    or the <code>useTc</code> hook.
                                </p>
                                {/* @ts-ignore */}
                                <tc-equipment-matrix ref={chipsRef} />
                            </tc-section-card>

                            <tc-section-card title='columns="list"'>
                                <p className="text-muted small mb-3">
                                    A dense two-column checklist for print-style spec pages (single
                                    column below 576px).
                                </p>
                                {/* @ts-ignore */}
                                <tc-equipment-matrix ref={listRef} columns="list" />
                            </tc-section-card>

                            <tc-section-card title="Collapsible sections">
                                <p className="text-muted small mb-3">
                                    With <code>collapsible</code>, every section beyond the first
                                    starts collapsed behind a chevron toggle.
                                </p>
                                {/* @ts-ignore */}
                                <tc-equipment-matrix ref={collapsibleRef} collapsible />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EquipmentMatrixDemo

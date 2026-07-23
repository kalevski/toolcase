import React from 'react'

const EquipmentTagDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Equipment Tag"
                            description="One vehicle-equipment chip from the catalog's equipment table, optionally carrying its per-variant feature flag (included / optional / package). The flag speaks through color and a mono suffix — included wears a success edge and check, optional stays neutral with an OPT suffix, package gets the info tint and PKG. Pair with tc-equipment-matrix for a variant's full sheet."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Feature flags">
                                <p className="text-muted small mb-3">
                                    The three <code>feature_flag</code> values of the{' '}
                                    <code>variant_equipment</code> table, plus the plain unflagged
                                    chip.
                                </p>
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-equipment-tag label="Adaptive cruise control" flag="included" />
                                    {/* @ts-ignore */}
                                    <tc-equipment-tag label="Matrix LED headlights" flag="included" />
                                    {/* @ts-ignore */}
                                    <tc-equipment-tag label="Panoramic sunroof" flag="optional" />
                                    {/* @ts-ignore */}
                                    <tc-equipment-tag label="Winter package" flag="package" />
                                    {/* @ts-ignore */}
                                    <tc-equipment-tag label="Lane assist" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom icons">
                                <p className="text-muted small mb-3">
                                    An explicit <code>icon</code> (any lucide name) overrides the
                                    flag's default glyph.
                                </p>
                                <div className="d-flex flex-wrap gap-2">
                                    {/* @ts-ignore */}
                                    <tc-equipment-tag label="Heated seats" icon="armchair" flag="included" />
                                    {/* @ts-ignore */}
                                    <tc-equipment-tag label="Premium sound" icon="speaker" flag="optional" />
                                    {/* @ts-ignore */}
                                    <tc-equipment-tag label="Tow hitch" icon="cable" flag="optional" />
                                    {/* @ts-ignore */}
                                    <tc-equipment-tag label="Night vision" icon="moon" flag="package" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EquipmentTagDemo

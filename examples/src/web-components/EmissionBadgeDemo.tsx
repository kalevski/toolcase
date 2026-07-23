import React from 'react'

const EmissionBadgeDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Emission Badge"
                            description="A compact emissions credential for a vehicle catalog row — the emission category label behind a 4px colored left stripe encoding the class (derived from the first digit in the label, overridable via `tier`), an optional NEDC/WLTP measurement-standard mono tag, and an optional mono CO₂ figure. The stripe is the only colored element; the body stays neutral."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Emission classes">
                                <p className="text-muted small mb-3">
                                    The stripe tier is derived from the first digit in the label:
                                    6/5 green, 4/3 amber, 2/1 red, no digit neutral.
                                </p>
                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="Euro 6d" />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="Euro 6d-TEMP" />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="Euro 5" />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="Euro 4" />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="Euro 3" />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="Euro 2" />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="EEV" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Measurement standard + CO₂">
                                <p className="text-muted small mb-3">
                                    <code>standard</code> renders as a mono tag (the literal{' '}
                                    <code>NA</code> is omitted — unknown is NULL, never a
                                    sentinel); <code>co2-text</code> is a pre-formatted mono
                                    figure.
                                </p>
                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-emission-badge
                                        label="Euro 6d"
                                        standard="WLTP"
                                        co2-text="128 g/km"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge
                                        label="Euro 5"
                                        standard="NEDC"
                                        co2-text="164 g/km"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="Euro 3" standard="NA" co2-text="212 g/km" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Tier override">
                                <p className="text-muted small mb-3">
                                    Labels without a digit (or with a misleading one) can pin the
                                    stripe explicitly via <code>tier</code>.
                                </p>
                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="EEV" tier="5" />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="ULEV" tier="6" standard="WLTP" />
                                    {/* @ts-ignore */}
                                    <tc-emission-badge label="Pre-Euro" tier="1" />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EmissionBadgeDemo

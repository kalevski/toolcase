import React from 'react'

const EngineSpecDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Engine Spec"
                            description="A machined engine ID plate — mono stamped engine code, manufacturer, a derived config badge (layout + cylinders → V8, L6, B4 …), and a hairline key-value grid for displacement, valvetrain, torque, peak rpm, injection, aspiration, and emission control. Every field optional: absent attributes (SQL NULL in the catalog schema) render nothing."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Full data plate">
                                <p className="text-muted small mb-3">
                                    A petrol straight-six with the complete mechanical config —
                                    the config badge derives <code>L6</code> from{' '}
                                    <code>layout="SERIES"</code> + <code>cylinders="6"</code>.
                                </p>
                                <div style={{ maxWidth: '38rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-engine-spec
                                        code="B58B30M1"
                                        manufacturer="BMW"
                                        layout="SERIES"
                                        position="FRONT"
                                        cylinders="6"
                                        valves="24"
                                        displacement-cc="2998"
                                        torque-nm="500"
                                        power-at-rpm="5000"
                                        torque-at-rpm="1900"
                                        fuel-injection="DIRECT_INJECTION"
                                        supercharger="TURBO"
                                        emission-control="OTTO_PARTICULATE_FILTER"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Diesel V8 — long enum labels">
                                <p className="text-muted small mb-3">
                                    Enum members humanize for display:{' '}
                                    <code>SCR_CAT_WITH_DPF</code> → “SCR cat + DPF”,{' '}
                                    <code>COMMON_RAIL</code> → “Common rail”.
                                </p>
                                <div style={{ maxWidth: '38rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-engine-spec
                                        code="OM729"
                                        manufacturer="Mercedes-Benz"
                                        layout="V"
                                        position="FRONT"
                                        cylinders="8"
                                        valves="32"
                                        displacement-cc="3982"
                                        torque-nm="730"
                                        power-at-rpm="3600"
                                        torque-at-rpm="2200"
                                        fuel-injection="COMMON_RAIL"
                                        supercharger="BI_TURBO"
                                        emission-control="SCR_CAT_WITH_DPF"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Compact">
                                <p className="text-muted small mb-3">
                                    <code>compact</code> collapses the plate to the headline cells
                                    (displacement + torque) for listing pages.
                                </p>
                                <div style={{ maxWidth: '22rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-engine-spec
                                        compact
                                        code="EJ207"
                                        manufacturer="Subaru"
                                        layout="BOXER"
                                        cylinders="4"
                                        displacement-cc="1994"
                                        torque-nm="422"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Sparse row — unknown is NULL">
                                <p className="text-muted small mb-3">
                                    Only the columns the catalog actually has; missing attributes
                                    render no cells at all.
                                </p>
                                <div style={{ maxWidth: '22rem' }}>
                                    {/* @ts-ignore */}
                                    <tc-engine-spec
                                        code="13B-REW"
                                        manufacturer="Mazda"
                                        layout="ROTARY"
                                        cylinders="2"
                                        displacement-cc="1308"
                                        supercharger="BI_TURBO"
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EngineSpecDemo

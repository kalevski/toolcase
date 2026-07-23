import React from 'react'

const TyreSpecDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Tyre Spec"
                            description="A tyre sidewall readout — parses ISO metric spec strings (225/45 R17, optional 91V load/speed suffix) into width / aspect / rim segments rendered as large mono digits with micro unit sub-labels. Give it a single spec, or front-spec + rear-spec for a two-axle fitment; unequal axles raise a STAGGERED corner flag. Unparseable specs fall back to the raw mono string."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Single axle">
                                <p className="text-muted small mb-3">
                                    One <code>spec</code> attribute — the load/speed suffix is
                                    optional and gets its own segment when present.
                                </p>
                                <div className="d-flex flex-wrap gap-3">
                                    {/* @ts-ignore */}
                                    <tc-tyre-spec spec="225/45 R17 91V" />
                                    {/* @ts-ignore */}
                                    <tc-tyre-spec spec="205/55R16" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Staggered fitment">
                                <p className="text-muted small mb-3">
                                    <code>front-spec</code> + <code>rear-spec</code> render FRONT /
                                    REAR axle rows; when they differ, the STAGGERED corner flag
                                    appears.
                                </p>
                                {/* @ts-ignore */}
                                <tc-tyre-spec
                                    front-spec="245/35 R20 95Y"
                                    rear-spec="275/30 R20 97Y"
                                />
                            </tc-section-card>

                            <tc-section-card title="Square fitment">
                                <p className="text-muted small mb-3">
                                    Equal axles: two rows, no flag.
                                </p>
                                {/* @ts-ignore */}
                                <tc-tyre-spec front-spec="235/60 R18" rear-spec="235/60 R18" />
                            </tc-section-card>

                            <tc-section-card title="Unparseable spec — raw fallback">
                                <p className="text-muted small mb-3">
                                    Commercial / vintage sizes that don't match the metric pattern
                                    render as the raw sidewall string.
                                </p>
                                {/* @ts-ignore */}
                                <tc-tyre-spec spec="185 R14C" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TyreSpecDemo

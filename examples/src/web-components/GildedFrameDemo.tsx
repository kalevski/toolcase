import React from 'react'

const GildedFrameDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Gilded Frame"
                        description="Hairline-framed surface that wraps its slotted content. A toolcase design-system take on a framed surface: the gilding is dropped for the toolcase voice — sharp corners, slate neutrals, 1px borders. Pick a tone and a padding step."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Tones">
                            <div className="d-flex flex-column gap-3">
                                {/* @ts-ignore */}
                                <tc-gilded-frame tone="dark">
                                    Dark tone — ink fill, light text. The default tone.
                                    {/* @ts-ignore */}
                                </tc-gilded-frame>

                                {/* @ts-ignore */}
                                <tc-gilded-frame tone="leather">
                                    Leather tone — muted slate fill with the standard hairline
                                    border.
                                    {/* @ts-ignore */}
                                </tc-gilded-frame>

                                {/* @ts-ignore */}
                                <tc-gilded-frame tone="transparent">
                                    Transparent tone — no fill, hairline border only; inherits
                                    surrounding text color.
                                    {/* @ts-ignore */}
                                </tc-gilded-frame>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Padding scale">
                            <div className="d-flex flex-column gap-3">
                                {/* @ts-ignore */}
                                <tc-gilded-frame tone="leather" padding="none">
                                    padding="none"
                                    {/* @ts-ignore */}
                                </tc-gilded-frame>

                                {/* @ts-ignore */}
                                <tc-gilded-frame tone="leather" padding="sm">
                                    padding="sm"
                                    {/* @ts-ignore */}
                                </tc-gilded-frame>

                                {/* @ts-ignore */}
                                <tc-gilded-frame tone="leather" padding="md">
                                    padding="md" (default)
                                    {/* @ts-ignore */}
                                </tc-gilded-frame>

                                {/* @ts-ignore */}
                                <tc-gilded-frame tone="leather" padding="lg">
                                    padding="lg"
                                    {/* @ts-ignore */}
                                </tc-gilded-frame>

                                {/* @ts-ignore */}
                                <tc-gilded-frame tone="leather" padding="xl">
                                    padding="xl"
                                    {/* @ts-ignore */}
                                </tc-gilded-frame>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Wrapping rich content">
                            {/* @ts-ignore */}
                            <tc-gilded-frame tone="dark" padding="lg">
                                <h5 style={{ marginTop: 0 }}>Framed panel</h5>
                                <p style={{ margin: 0 }}>
                                    Any markup can be slotted inside the frame — it is rendered into
                                    the inner content wrapper unchanged.
                                </p>
                                {/* @ts-ignore */}
                            </tc-gilded-frame>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default GildedFrameDemo

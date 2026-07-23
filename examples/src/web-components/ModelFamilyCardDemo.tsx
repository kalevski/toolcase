import React from 'react'

const ModelFamilyCardDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Model Family Card"
                            description="A card for one model family of a vehicle catalog — manufacturer eyebrow, range title, the mono lineage breadcrumb RANGE / SERIES / GENERATION, and a meta row with a body-type chip (lucide icon + humanized enum label), years span and variant count. An optional photo strip caps the card; `href` links the title."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="With photo strip">
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))',
                                        gap: '1rem',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-model-family-card
                                        manufacturer="BMW"
                                        range="3 Series"
                                        series="G20"
                                        generation="LCI"
                                        body-type="NOTCHBACK"
                                        years-text="2022–2025"
                                        variant-count-text="34 variants"
                                        href="#"
                                        image-src="https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&h=340&fit=crop"
                                        image-alt="Blue BMW 3 Series sedan"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-model-family-card
                                        manufacturer="Alfa Romeo"
                                        range="Giulia"
                                        series="952"
                                        generation="Facelift"
                                        body-type="NOTCHBACK"
                                        years-text="2023–"
                                        variant-count-text="12 variants"
                                        href="#"
                                        image-src="https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600&h=340&fit=crop"
                                        image-alt="Red Alfa Romeo Giulia"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Text-only, body-type variety">
                                <p className="text-muted small mb-3">
                                    The body-type chip maps each <code>body_type</code> enum member
                                    to a lucide icon + humanized label; an absent or unknown value
                                    renders no chip (unknown is NULL).
                                </p>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))',
                                        gap: '1rem',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-model-family-card
                                        manufacturer="Land Rover"
                                        range="Defender"
                                        series="L663"
                                        generation="110"
                                        body-type="OFF_ROAD_VEHICLE"
                                        years-text="2020–"
                                        variant-count-text="28 variants"
                                        href="#"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-model-family-card
                                        manufacturer="Volkswagen"
                                        range="Transporter"
                                        series="T6.1"
                                        generation="Facelift"
                                        body-type="TRANSPORTER"
                                        years-text="2019–2024"
                                        variant-count-text="41 variants"
                                        href="#"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-model-family-card
                                        manufacturer="Mazda"
                                        range="MX-5"
                                        series="ND"
                                        generation="ND2"
                                        body-type="ROADSTER"
                                        years-text="2018–"
                                        variant-count-text="9 variants"
                                        href="#"
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

export default ModelFamilyCardDemo

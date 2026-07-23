import React from 'react'

const ManufacturerTileDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Manufacturer Tile"
                            description="A brand tile for manufacturer grids and filter rails — square logo mark (or an auto-monogram built from the name's initials), optional mono eyebrow, name and count line. Set `href` to make the whole tile a link; `active` marks the selected-filter state with the solid-ink treatment. Backs the `manufacturer` lookup table of a vehicle catalog."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Manufacturer grid">
                                <p className="text-muted small mb-3">
                                    Without <code>logo-src</code> the tile renders a sharp square
                                    monogram well from the name&apos;s initials — deliberately not
                                    the circular avatar treatment.
                                </p>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))',
                                        gap: '0.75rem',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-manufacturer-tile
                                        name="Alfa Romeo"
                                        href="#"
                                        count-text="42 models"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-manufacturer-tile name="BMW" href="#" count-text="128 models" />
                                    {/* @ts-ignore */}
                                    <tc-manufacturer-tile
                                        name="Mercedes Benz"
                                        href="#"
                                        count-text="114 models"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-manufacturer-tile name="Škoda" href="#" count-text="57 models" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Active filter state + eyebrow">
                                <p className="text-muted small mb-3">
                                    <code>active</code> paints the solid-ink selected state; the
                                    optional <code>eyebrow</code> adds a mono micro-label.
                                </p>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))',
                                        gap: '0.75rem',
                                        maxWidth: '28rem',
                                    }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-manufacturer-tile
                                        name="Audi"
                                        href="#"
                                        eyebrow="Marque"
                                        count-text="96 models"
                                        active
                                    />
                                    {/* @ts-ignore */}
                                    <tc-manufacturer-tile
                                        name="Volkswagen"
                                        href="#"
                                        eyebrow="Marque"
                                        count-text="143 models"
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

export default ManufacturerTileDemo

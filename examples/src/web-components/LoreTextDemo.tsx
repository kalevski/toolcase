import React from 'react'

const LoreTextDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="LoreText"
                            description="Flavor / lore body-copy block. Slot-based — use it for tooltips, loading screens, codex entries, or any italic narrative aside."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Short flavor line">
                                {/* @ts-ignore */}
                                <tc-lore-text>
                                    Some swords remember every hand that wielded them.
                                </tc-lore-text>
                            </tc-section-card>

                            <tc-section-card title="Multi-sentence passage">
                                {/* @ts-ignore */}
                                <tc-lore-text>
                                    The library at Velkhar burned for three nights and still its
                                    ashes whispered names. Scholars came from distant kingdoms to
                                    listen, hoping to catch a verse, a date, a forgotten lineage —
                                    anything the fire had chosen to spare.
                                </tc-lore-text>
                            </tc-section-card>

                            <tc-section-card title="Inside a card (natural width)">
                                <div className="card" style={{ maxWidth: 480 }}>
                                    <div className="card-body">
                                        <h6 className="card-title mb-2">Aldric of the Vale</h6>
                                        {/* @ts-ignore */}
                                        <tc-lore-text>
                                            He had walked three continents before he turned
                                            eighteen. None of the maps he carried matched the roads
                                            he found.
                                        </tc-lore-text>
                                    </div>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom theme (accent border + ink text)">
                                {/* @ts-ignore */}
                                <tc-lore-text
                                    style={{
                                        '--bs-lore-text-border-color': 'var(--tc-app-accent)',
                                        '--bs-lore-text-color': 'var(--tc-text)',
                                    }}
                                >
                                    The door had no handle. It had never needed one — it only opened
                                    for those who already knew what lay beyond.
                                </tc-lore-text>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoreTextDemo

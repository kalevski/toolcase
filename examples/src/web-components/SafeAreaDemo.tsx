import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const SafeAreaDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="Safe Area"
                        description="Layout wrapper that insets content by env(safe-area-inset-*) CSS environment variables, with an optional uniform extra padding."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default — env insets only">
                            {/* @ts-ignore */}
                            <tc-safe-area style={{ outline: '1px dashed var(--tc-border)', minHeight: 80 }}>
                                <div style={{ background: 'var(--tc-surface-muted)', padding: 12 }}>
                                    HUD content — padding is driven entirely by device safe-area insets (0 on desktop).
                                </div>
                            {/* @ts-ignore */}
                            </tc-safe-area>
                        </SectionCard>

                        <SectionCard title="Extra 16px">
                            {/* @ts-ignore */}
                            <tc-safe-area extra="16px" style={{ outline: '1px dashed var(--tc-border)', minHeight: 80 }}>
                                <div style={{ background: 'var(--tc-surface-muted)', padding: 12 }}>
                                    HUD content — 16px added on every side on top of the env insets.
                                </div>
                            {/* @ts-ignore */}
                            </tc-safe-area>
                        </SectionCard>

                        <SectionCard title="Extra 1.5rem">
                            {/* @ts-ignore */}
                            <tc-safe-area extra="1.5rem" style={{ outline: '1px dashed var(--tc-border)', minHeight: 80 }}>
                                <div style={{ background: 'var(--tc-surface-muted)', padding: 12 }}>
                                    HUD content — 1.5rem added on every side on top of the env insets.
                                </div>
                            {/* @ts-ignore */}
                            </tc-safe-area>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default SafeAreaDemo

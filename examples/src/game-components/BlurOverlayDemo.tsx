import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const stageStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 240,
    background: 'repeating-linear-gradient(45deg, #4a3a22 0 12px, #2a1f14 12px 24px)',
    overflow: 'hidden',
}

const labelStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Cinzel', Georgia, serif",
    color: '#f0d27a',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    zIndex: 1031,
}

const BlurOverlayDemo: React.FC = () => {
    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Blur Overlay"
                        description="Backdrop-filter blur overlay for pause/menu defocus effects."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default (8px / dark tint)">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <gc-blur-overlay />
                                <div style={labelStyle}>Paused</div>
                            </div>
                        </SectionCard>
                        <SectionCard title="Strong blur (16px)">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <gc-blur-overlay blur-amount="16px" />
                            </div>
                        </SectionCard>
                        <SectionCard title="Clear tint">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <gc-blur-overlay blur-amount="4px" background="transparent" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BlurOverlayDemo

import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const stageStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 240,
    background: 'radial-gradient(60% 50% at 50% 30%, #4a3a22 0%, #1a1108 60%, #0a0604 100%)',
    overflow: 'hidden',
}

const VignetteOverlayDemo: React.FC = () => {
    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Vignette Overlay"
                        description="Radial darkening overlay for cinematic frames or low-HP effect."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default (intensity 0.6)">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <gc-vignette-overlay />
                            </div>
                        </SectionCard>
                        <SectionCard title="Soft (0.3)">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <gc-vignette-overlay intensity="0.3" />
                            </div>
                        </SectionCard>
                        <SectionCard title="Heavy (1.0)">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <gc-vignette-overlay intensity="1" />
                            </div>
                        </SectionCard>
                        <SectionCard title="Blood tint (low HP)">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <gc-vignette-overlay intensity="0.8" vignette-color="#a8302a" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VignetteOverlayDemo

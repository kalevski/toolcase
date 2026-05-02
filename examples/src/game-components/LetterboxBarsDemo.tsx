import React, { useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const stageStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 280,
    background: 'radial-gradient(60% 50% at 50% 30%, #4a3a22 0%, #1a1108 60%, #0a0604 100%)',
    overflow: 'hidden',
}

const LetterboxBarsDemo: React.FC = () => {
    const [show, setShow] = useState(true)

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Letterbox Bars"
                        description="Animated cinematic bars at top/bottom. Toggle 'show' to slide in/out."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Toggle — show: ${show}`}>
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <gc-letterbox-bars {...(show ? { show: '' } : {})} />
                            </div>
                            <div className="mt-3">
                                {/* @ts-ignore */}
                                <gc-metal-button onClick={() => setShow((v) => !v)}>Toggle</gc-metal-button>
                            </div>
                        </SectionCard>
                        <SectionCard title="Tall bars (140px)">
                            <div style={stageStyle}>
                                {/* @ts-ignore */}
                                <gc-letterbox-bars show bar-height="140px" />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LetterboxBarsDemo

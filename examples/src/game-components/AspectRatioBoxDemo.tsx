import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const Box = ({ children }: { children: React.ReactNode }) => (
    <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(120% 80% at 50% 0%, #2e2418 0%, #1a130c 70%)',
        outline: '1px solid var(--fg-gold-deep)',
        color: 'var(--fg-parch)',
        fontFamily: 'var(--fg-mono)',
        letterSpacing: '0.1em',
    }}>
        {children}
    </div>
)

const AspectRatioBoxDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Aspect Ratio Box"
                    description="Maintains a fixed aspect ratio. Default 16:9."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="16:9 (default)">
                        {/* @ts-ignore */}
                        <gc-aspect-ratio-box style={{ maxWidth: 480 }}>
                            <Box>16 : 9</Box>
                            {/* @ts-ignore */}
                        </gc-aspect-ratio-box>
                    </SectionCard>

                    <SectionCard title="4:3">
                        {/* @ts-ignore */}
                        <gc-aspect-ratio-box ratio="4 / 3" style={{ maxWidth: 360 }}>
                            <Box>4 : 3</Box>
                            {/* @ts-ignore */}
                        </gc-aspect-ratio-box>
                    </SectionCard>

                    <SectionCard title="1:1">
                        {/* @ts-ignore */}
                        <gc-aspect-ratio-box ratio="1 / 1" style={{ maxWidth: 220 }}>
                            <Box>1 : 1</Box>
                            {/* @ts-ignore */}
                        </gc-aspect-ratio-box>
                    </SectionCard>

                    <SectionCard title="21:9 (ultrawide)">
                        {/* @ts-ignore */}
                        <gc-aspect-ratio-box ratio="21 / 9" style={{ maxWidth: 560 }}>
                            <Box>21 : 9</Box>
                            {/* @ts-ignore */}
                        </gc-aspect-ratio-box>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default AspectRatioBoxDemo

import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    fontFamily: 'var(--fg-display)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    fontSize: 12,
    color: 'var(--fg-parch)',
}

const KeyDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="Key"
                    description="Mono key cap badge. Slot-based — drop a single key or short combo."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Single keys">
                        <div style={{ display: 'flex', gap: 8 }}>
                            {/* @ts-ignore */}
                            <gc-key>W</gc-key>
                            {/* @ts-ignore */}
                            <gc-key>A</gc-key>
                            {/* @ts-ignore */}
                            <gc-key>S</gc-key>
                            {/* @ts-ignore */}
                            <gc-key>D</gc-key>
                        </div>
                    </SectionCard>

                    <SectionCard title="Wide keys">
                        <div style={{ display: 'flex', gap: 8 }}>
                            {/* @ts-ignore */}
                            <gc-key>Esc</gc-key>
                            {/* @ts-ignore */}
                            <gc-key>Tab</gc-key>
                            {/* @ts-ignore */}
                            <gc-key>Shift</gc-key>
                            {/* @ts-ignore */}
                            <gc-key>Space</gc-key>
                        </div>
                    </SectionCard>

                    <SectionCard title="Hint row">
                        <div style={rowStyle}>
                            {/* @ts-ignore */}
                            <gc-key>E</gc-key>
                            <span>Interact</span>
                            {/* @ts-ignore */}
                            <gc-key>I</gc-key>
                            <span>Inventory</span>
                            {/* @ts-ignore */}
                            <gc-key>M</gc-key>
                            <span>Map</span>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default KeyDemo

import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
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
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Single keys" />
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
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Wide keys" />
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
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Hint row" />
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
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default KeyDemo

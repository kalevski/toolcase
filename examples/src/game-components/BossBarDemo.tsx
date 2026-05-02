import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const BossBarDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.phaseTicks = [0.25, 0.5, 0.75]
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="BossBar"
                        description="Wide HP bar with name, epithet, phase indicator and phase-tick notches."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Default" />
                            <div style={{ width: 520 }}>
                                {/* @ts-ignore */}
                                <gc-boss-bar
                                    name="Vorothir"
                                    epithet="The Hollow Crown"
                                    phase="2"
                                    hp="3200"
                                    hp-max="5000"
                                />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="With phase ticks (0.25, 0.5, 0.75)" />
                            <div style={{ width: 520 }}>
                                {/* @ts-ignore */}
                                <gc-boss-bar
                                    ref={ref}
                                    name="Sablewing"
                                    epithet="Storm of the Black Tide"
                                    phase="3"
                                    hp="1800"
                                    hp-max="4000"
                                />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Near-death (sliver of HP)" />
                            <div style={{ width: 520 }}>
                                {/* @ts-ignore */}
                                <gc-boss-bar
                                    name="Khor'azak"
                                    epithet="Devourer of Suns"
                                    phase="4"
                                    hp="120"
                                    hp-max="6000"
                                />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BossBarDemo

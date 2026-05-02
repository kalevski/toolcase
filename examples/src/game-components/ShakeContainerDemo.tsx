import React, { useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ShakeContainerDemo: React.FC = () => {
    const lightRef = useRef<HTMLElement>(null)
    const heavyRef = useRef<HTMLElement>(null)

    const fire = (ref: React.RefObject<HTMLElement | null>) => {
        const el = ref.current
        if (!el) return
        el.setAttribute('trigger', String(Date.now()))
    }

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="ShakeContainer"
                        description="rAF-driven randomized offset wrapper. Re-shakes when `trigger` attribute changes; intensity decays over `duration`."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Light shake (intensity 4, duration 250)" />
                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                {/* @ts-ignore */}
                                <gc-metal-button onClick={() => fire(lightRef)}>Shake</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-shake-container ref={lightRef} intensity="4" duration="250">
                                    {/* @ts-ignore */}
                                    <gc-panel bordered corners style={{ padding: 24, minWidth: 200 }}>
                                        <div style={{ fontFamily: 'var(--fg-display)', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--fg-gold-bright)' }}>
                                            -42 HP
                                        </div>
                                        {/* @ts-ignore */}
                                    </gc-panel>
                                    {/* @ts-ignore */}
                                </gc-shake-container>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Heavy shake (intensity 14, duration 600)" />
                            <div className="d-flex align-items-center gap-3 flex-wrap">
                                {/* @ts-ignore */}
                                <gc-metal-button variant="danger" onClick={() => fire(heavyRef)}>Boss slam</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-shake-container ref={heavyRef} intensity="14" duration="600">
                                    {/* @ts-ignore */}
                                    <gc-panel bordered corners style={{ padding: 24, minWidth: 280 }}>
                                        <div style={{ fontFamily: 'var(--fg-display)', textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--fg-blood-bright)' }}>
                                            CRITICAL HIT
                                        </div>
                                        {/* @ts-ignore */}
                                    </gc-panel>
                                    {/* @ts-ignore */}
                                </gc-shake-container>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ShakeContainerDemo

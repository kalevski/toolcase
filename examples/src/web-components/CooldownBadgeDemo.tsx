import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const CooldownBadgeDemo: React.FC = () => {
    // Live cooldown: `value` climbs from 0 to `max`, depleting the ring; when it
    // reaches `max` the badge flips to its ready state, then we reset.
    const liveRef = useRef<any>(null)
    const [value, setValue] = useState(0)
    const MAX = 8

    useEffect(() => {
        const id = setInterval(() => {
            setValue(v => (v >= MAX ? 0 : +(v + 0.1).toFixed(1)))
        }, 100)
        return () => clearInterval(id)
    }, [])

    useEffect(() => {
        if (liveRef.current) liveRef.current.value = value
    }, [value])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="CooldownBadge"
                            description="Small ring badge with a cooldown countdown readout. The arc depletes clockwise as `value` climbs toward `max`; when the cooldown clears, the ring completes in the cyan accent to signal ready. Slate hairline track, ink cooling arc, JetBrains Mono label — driven entirely by attributes."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Cooldown progression (value of max)">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="0" max="10" show-label></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="3" max="10" show-label></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="6" max="10" show-label></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="9" max="10" show-label></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="10" max="10" show-label></tc-cooldown-badge>
                                </div>
                            </SectionCard>

                            <SectionCard title="Sizes (32–64px)">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="4" max="10" size="32" show-label></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="4" max="10" size="48" show-label></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="4" max="10" size="64" show-label></tc-cooldown-badge>
                                </div>
                            </SectionCard>

                            <SectionCard title="Time formatting (m:ss, seconds, sub-10s decimals)">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="30" max="120" show-label></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="0" max="45" show-label></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="6.5" max="10" show-label></tc-cooldown-badge>
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom label">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="5" max="10" label="DASH"></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="10" max="10" label="GO"></tc-cooldown-badge>
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge value="2" max="10"></tc-cooldown-badge>
                                </div>
                            </SectionCard>

                            <SectionCard title="Live value (set via JS property)">
                                <div className="d-flex flex-wrap gap-4 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-cooldown-badge ref={liveRef} max={String(MAX)} size="64" show-label></tc-cooldown-badge>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CooldownBadgeDemo

import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const BuffsDemo: React.FC = () => {
    const barRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = barRef.current as any
        if (!el) return
        el.buffs = [
            { id: 'haste', icon: '⚡', name: 'Haste', remaining: 18, duration: 30 },
            { id: 'shield', icon: '🛡', name: 'Shield', remaining: 9, duration: 12, stacks: 3 },
            { id: 'regen', icon: '⚕', name: 'Regen', remaining: 75, duration: 120 },
            { id: 'poison', icon: '🜍', name: 'Poison', remaining: 5, duration: 8, debuff: true, stacks: 2 },
            { id: 'burning', icon: '🔥', name: 'Burning', remaining: 3, duration: 6, debuff: true },
        ]
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Buffs"
                        description="Single buff icon (gc-buff-icon) and bar of multiple (gc-buff-bar) with cooldown overlay + stack count."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Single icon — buff vs debuff">
                            <div className="d-flex gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <gc-buff-icon kind="buff" glyph="⚡" time="18s" />
                                {/* @ts-ignore */}
                                <gc-buff-icon kind="buff" glyph="🛡" time="9s" />
                                {/* @ts-ignore */}
                                <gc-buff-icon kind="debuff" glyph="🜍" time="5s" />
                                {/* @ts-ignore */}
                                <gc-buff-icon kind="debuff" glyph="🔥" time="3s" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Sizes (24, 36, 56)">
                            <div className="d-flex gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <gc-buff-icon kind="buff" glyph="⚕" time="10s" size="24" />
                                {/* @ts-ignore */}
                                <gc-buff-icon kind="buff" glyph="⚕" time="10s" size="36" />
                                {/* @ts-ignore */}
                                <gc-buff-icon kind="buff" glyph="⚕" time="10s" size="56" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Bar with cooldown overlay + stacks">
                            {/* @ts-ignore */}
                            <gc-buff-bar ref={barRef} icon-size="40" gap="8px" />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BuffsDemo

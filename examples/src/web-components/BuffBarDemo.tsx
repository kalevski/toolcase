import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

// buffs is a JS-property array (BuffEntry[]) — React can't set it as an
// attribute, so reach for each element via a ref and assign after mount.
const useBuffs = (buffs: any[]) => {
    const ref = useRef<any>(null)
    useEffect(() => {
        if (ref.current) ref.current.buffs = buffs
    }, [])
    return ref
}

const BuffBarDemo: React.FC = () => {
    const mixedRef = useBuffs([
        { id: 'haste', icon: 'Zap', name: 'Haste', remaining: 12, duration: 20 },
        { id: 'shield', icon: 'Shield', name: 'Barrier', remaining: 8, duration: 30 },
        { id: 'regen', icon: 'Heart', name: 'Regeneration', remaining: 45, duration: 60, stacks: 3 },
        { id: 'poison', icon: 'Skull', name: 'Poison', remaining: 6, duration: 10, debuff: true },
        { id: 'slow', icon: 'Snail', name: 'Slowed', remaining: 4, duration: 8, debuff: true, stacks: 2 },
    ])

    const longRef = useBuffs([
        { id: 'blessing', icon: 'Sparkles', name: 'Blessing', remaining: 185, duration: 300 },
        { id: 'focus', icon: 'Target', name: 'Focus', remaining: 92, duration: 120, stacks: 5 },
    ])

    const debuffsRef = useBuffs([
        { id: 'burn', icon: 'Flame', name: 'Burning', remaining: 3, duration: 6, debuff: true },
        { id: 'curse', icon: 'Ghost', name: 'Cursed', remaining: 18, duration: 25, debuff: true },
        { id: 'freeze', icon: 'Snowflake', name: 'Frozen', remaining: 2, duration: 4, debuff: true },
    ])

    const bigRef = useBuffs([
        { id: 'rage', icon: 'Swords', name: 'Berserk', remaining: 22, duration: 30 },
        { id: 'guard', icon: 'ShieldCheck', name: 'Guarded', remaining: 14, duration: 30, stacks: 2 },
        { id: 'haste2', icon: 'Wind', name: 'Quickened', remaining: 9, duration: 20 },
    ])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="BuffBar"
                            description="A horizontal row of active buff / debuff status icons with cooldown sweeps, stack counts, and mono duration captions. Each entry composes tc-buff-icon. Ported from the game-components gc-buff-bar and restyled to the toolcase design system — flat slate tiles, hairline borders, sharp corners, mono machine-text, and a single status accent stripe for buff vs debuff."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Mixed buffs & debuffs (buffs JS property)">
                                {/* @ts-ignore */}
                                <tc-buff-bar ref={mixedRef} />
                            </SectionCard>

                            <SectionCard title="Long-duration buffs with stacks">
                                {/* @ts-ignore */}
                                <tc-buff-bar ref={longRef} />
                            </SectionCard>

                            <SectionCard title="Debuffs only">
                                {/* @ts-ignore */}
                                <tc-buff-bar ref={debuffsRef} />
                            </SectionCard>

                            <SectionCard title="Larger icons & wider gap (icon-size / gap attributes)">
                                {/* @ts-ignore */}
                                <tc-buff-bar ref={bigRef} icon-size="48" gap="12px" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BuffBarDemo

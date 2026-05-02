import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const SLOTS = [
    { id: 'slash', icon: '⚔', hotkey: '1' },
    { id: 'fireball', icon: '🔥', hotkey: 'Q', cooldown: 8, remaining: 4 },
    { id: 'frost', icon: '❄', hotkey: 'E', charges: 3 },
    { id: 'heal', icon: '⚕', hotkey: 'R', cooldown: 30, remaining: 22, selected: true },
    { id: 'shield', icon: '🛡', hotkey: 'F', disabled: true },
    { id: 'arcane', icon: '✦', hotkey: 'G', cooldown: 12, remaining: 1 },
]

const SkillBarDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.slots = SLOTS
    }, [])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (event: any) => setLast(`activate ${event.detail.id}`)
        el.addEventListener('activate', handler)
        return () => el.removeEventListener('activate', handler)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Skill Bar"
                        description="Action-bar of skill cells — cooldown ring, hotkey/charge badges, selected, disabled."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`Last — ${last}`}>
                            {/* @ts-ignore */}
                            <gc-skill-bar ref={ref} slot-size="56" />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SkillBarDemo

import React, { useEffect, useRef, useState } from 'react'

const SkillBarDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const stateRef = useRef<any>(null)
    const cdRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.slots = [
            { id: 'fireball', name: 'Fireball', icon: 'Flame', hotkey: 'Q', cooldown: 8 },
            { id: 'frost-nova', name: 'Frost Nova', icon: 'Snowflake', hotkey: 'W', cooldown: 10 },
            { id: 'blink', name: 'Blink', icon: 'Zap', hotkey: 'E', cooldown: 15 },
            { id: 'meteor', name: 'Meteor', icon: 'Sparkles', hotkey: 'R', cooldown: 120 },
        ]
    }, [])

    useEffect(() => {
        if (!stateRef.current) return
        stateRef.current.slots = [
            {
                id: 'shield',
                name: 'Shield Wall',
                icon: 'Shield',
                hotkey: 'Q',
                cooldown: 12,
                selected: true,
            },
            { id: 'stun', name: 'Stun', icon: 'Swords', hotkey: 'W', cooldown: 6, charges: 2 },
            { id: 'dash', name: 'Dash', icon: 'Wind', hotkey: 'E', cooldown: 8, disabled: true },
            {
                id: 'ult',
                name: 'Supernova',
                icon: 'Star',
                hotkey: 'R',
                cooldown: 90,
                disabled: true,
            },
        ]
    }, [])

    useEffect(() => {
        if (!cdRef.current) return
        cdRef.current.slots = [
            {
                id: 'slash',
                name: 'Quick Slash',
                icon: 'Sword',
                hotkey: 'Q',
                cooldown: 6,
                remaining: 5,
            },
            { id: 'heal', name: 'Mend', icon: 'Heart', hotkey: 'W', cooldown: 20, remaining: 7 },
            {
                id: 'charge',
                name: 'Charge',
                icon: 'ChevronsRight',
                hotkey: 'E',
                cooldown: 18,
                remaining: 0,
            },
            {
                id: 'ult',
                name: 'Obliterate',
                icon: 'Skull',
                hotkey: 'R',
                cooldown: 90,
                remaining: 0,
            },
        ]
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.slots = [
            { id: 'fire', name: 'Fire Bolt', icon: 'Flame', hotkey: '1' },
            { id: 'ice', name: 'Ice Shard', icon: 'Snowflake', hotkey: '2' },
            { id: 'thunder', name: 'Thunderclap', icon: 'Zap', hotkey: '3' },
        ]
        const onActivate = (e: any) =>
            setLog((l) => [`tc-activate: "${e.detail.id}"`, ...l].slice(0, 6))
        el.addEventListener('tc-activate', onActivate)
        return () => el.removeEventListener('tc-activate', onActivate)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="SkillBar"
                            description="A horizontal toolbar of ability cards, each slot composed from tc-ability-card. Slots are driven by the JS slots property. Clicking or pressing Enter/Space on a slot fires tc-activate with the slot id."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — four abilities with hotkeys and cooldowns">
                                {/* @ts-ignore */}
                                <tc-skill-bar ref={basicRef} />
                            </tc-section-card>

                            <tc-section-card title="States — selected, charges, and disabled">
                                {/* @ts-ignore */}
                                <tc-skill-bar ref={stateRef} />
                            </tc-section-card>

                            <tc-section-card title="Active cooldown overlays">
                                {/* @ts-ignore */}
                                <tc-skill-bar ref={cdRef} />
                            </tc-section-card>

                            <tc-section-card title="Events — tc-activate">
                                {/* @ts-ignore */}
                                <tc-skill-bar ref={eventsRef} />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click a skill card to fire tc-activate…
                                        </span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}>
                                                    <code>{line}</code>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom slot-size (220px) and gap (1rem)">
                                {/* @ts-ignore */}
                                <tc-skill-bar
                                    ref={(el: any) => {
                                        if (!el) return
                                        el.slots = [
                                            {
                                                id: 'bolt',
                                                name: 'Chain Lightning',
                                                icon: 'Zap',
                                                hotkey: 'Q',
                                                cooldown: 8,
                                            },
                                            {
                                                id: 'smite',
                                                name: 'Holy Smite',
                                                icon: 'Sun',
                                                hotkey: 'W',
                                                cooldown: 14,
                                            },
                                        ]
                                    }}
                                    slot-size="220"
                                    gap="1rem"
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SkillBarDemo

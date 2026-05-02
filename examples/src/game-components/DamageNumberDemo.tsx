import React, { useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

type Pop = { id: number; value: string; crit?: boolean; heal?: boolean; miss?: boolean }

const DamageNumberDemo: React.FC = () => {
    const [pops, setPops] = useState<Pop[]>([])
    const [doneCount, setDoneCount] = useState(0)
    let nextId = React.useRef(0)

    const fire = (kind: 'normal' | 'crit' | 'heal' | 'miss') => {
        const id = ++nextId.current
        const value =
            kind === 'miss' ? '' :
            kind === 'heal' ? String(Math.floor(20 + Math.random() * 30)) :
            kind === 'crit' ? String(Math.floor(150 + Math.random() * 200)) :
            String(Math.floor(20 + Math.random() * 80))
        setPops(p => [...p, { id, value, crit: kind === 'crit', heal: kind === 'heal', miss: kind === 'miss' }])
    }

    const onDone = (id: number) => {
        setDoneCount(c => c + 1)
        setPops(p => p.filter(x => x.id !== id))
    }

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="DamageNumber"
                        description="Floating combat text. Variants: normal (parch), crit (blood bright + larger), heal (stamina + leading +), miss (display italic). Animates up and fades, emits 'done' after `duration` ms."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants (always-on)">
                            <div className="d-flex align-items-end gap-5" style={{ background: 'var(--fg-ink)', padding: 32 }}>
                                {/* @ts-ignore */}
                                <gc-damage-number value="42" duration="999999" />
                                {/* @ts-ignore */}
                                <gc-damage-number value="237" crit duration="999999" />
                                {/* @ts-ignore */}
                                <gc-damage-number value="35" heal duration="999999" />
                                {/* @ts-ignore */}
                                <gc-damage-number miss duration="999999" />
                            </div>
                        </SectionCard>

                        <SectionCard title="Interactive (spawn + auto-cleanup on 'done')">
                            <div className="d-flex flex-wrap gap-3 mb-3">
                                {/* @ts-ignore */}
                                <gc-metal-button onClick={() => fire('normal')}>Hit</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="primary" onClick={() => fire('crit')}>Crit</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="ghost" onClick={() => fire('heal')}>Heal</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="ghost" onClick={() => fire('miss')}>Miss</gc-metal-button>
                            </div>
                            <div
                                style={{
                                    background: 'var(--fg-ink)',
                                    padding: 32,
                                    minHeight: 120,
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    flexWrap: 'wrap',
                                    gap: 24,
                                }}
                            >
                                {pops.map(p => (
                                    // @ts-ignore
                                    <gc-damage-number
                                        key={p.id}
                                        value={p.value}
                                        {...(p.crit ? { crit: true } : {})}
                                        {...(p.heal ? { heal: true } : {})}
                                        {...(p.miss ? { miss: true } : {})}
                                        duration="900"
                                        ref={(el: HTMLElement | null) => {
                                            if (!el || el.dataset.bound) return
                                            el.dataset.bound = '1'
                                            el.addEventListener('done', () => onDone(p.id))
                                        }}
                                    />
                                ))}
                            </div>
                            <div className="mt-3" style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>
                                'done' fired: {doneCount}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DamageNumberDemo

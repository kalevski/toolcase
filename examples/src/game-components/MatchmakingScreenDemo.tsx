import React, { useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

type State = 'searching' | 'connecting' | 'found' | 'failed' | 'idle'

const MatchmakingScreenDemo: React.FC = () => {
    const [state, setState] = useState<State>('searching')
    const [elapsed, setElapsed] = useState(0)
    const [last, setLast] = useState('')

    useEffect(() => {
        if (state !== 'searching' && state !== 'connecting') return
        const id = window.setInterval(() => setElapsed((s) => s + 1), 1000)
        return () => window.clearInterval(id)
    }, [state])

    useEffect(() => {
        if (state !== 'searching') return
        const id = window.setTimeout(() => setState('connecting'), 4000)
        return () => window.clearTimeout(id)
    }, [state])

    useEffect(() => {
        if (state !== 'connecting') return
        const id = window.setTimeout(() => setState('found'), 2500)
        return () => window.clearTimeout(id)
    }, [state])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Matchmaking Screen"
                        description="State machine: searching → connecting → found / failed. Spinner ring + meta + accept/cancel."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title={`State: ${state} — last: ${last || '—'}`}>
                            <div className="d-flex flex-wrap gap-2 mb-3">
                                {(['idle', 'searching', 'connecting', 'found', 'failed'] as State[]).map((s) => (
                                    /* @ts-ignore */
                                    <gc-metal-button key={s} size="sm" variant={s === state ? 'primary' : 'default'} onClick={() => { setState(s); setElapsed(0) }}>{s}</gc-metal-button>
                                ))}
                            </div>
                            {/* @ts-ignore */}
                            <gc-matchmaking-screen
                                state={state}
                                elapsed={elapsed}
                                estimated={45}
                                region="EU-West"
                                mode="3v3 Ranked"
                                ref={(el: any) => {
                                    if (!el || el.__bound) return
                                    el.__bound = true
                                    el.addEventListener('accept', () => setLast('accept'))
                                    el.addEventListener('cancel', () => { setLast('cancel'); setState('idle') })
                                }}
                            />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MatchmakingScreenDemo

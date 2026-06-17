import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

type State = 'searching' | 'connecting' | 'found' | 'failed' | 'idle'

const MatchmakingScreenDemo: React.FC = () => {
    const [state, setState] = useState<State>('idle')
    const [elapsed, setElapsed] = useState(0)
    const [log, setLog] = useState<string[]>([])

    const addLog = (msg: string): void => setLog(l => [msg, ...l].slice(0, 6))

    // Tick elapsed while actively searching / connecting
    useEffect(() => {
        if (state !== 'searching' && state !== 'connecting') return
        const id = window.setInterval(() => setElapsed(s => s + 1), 1000)
        return () => window.clearInterval(id)
    }, [state])

    const eventRef = useRef<any>(null)
    useEffect(() => {
        const el = eventRef.current
        if (!el) return
        const onAccept = () => addLog('tc-accept fired')
        const onCancel = () => { addLog('tc-cancel fired'); setState('idle'); setElapsed(0) }
        el.addEventListener('tc-accept', onAccept)
        el.addEventListener('tc-cancel', onCancel)
        return () => {
            el.removeEventListener('tc-accept', onAccept)
            el.removeEventListener('tc-cancel', onCancel)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Matchmaking Screen"
                            description="Status and cancel panel for multiplayer matchmaking. Driven by the state attribute (idle, searching, connecting, found, failed) with mode, region, elapsed, and estimated meta."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="States — static snapshots">
                                <div className="d-flex flex-wrap gap-3">
                                    {/* @ts-ignore */}
                                    <tc-matchmaking-screen state="searching" elapsed="23" estimated="45" mode="3v3 Ranked" region="EU-West" />
                                    {/* @ts-ignore */}
                                    <tc-matchmaking-screen state="connecting" elapsed="47" mode="3v3 Ranked" region="EU-West" />
                                    {/* @ts-ignore */}
                                    <tc-matchmaking-screen state="found" mode="3v3 Ranked" region="EU-West" />
                                    {/* @ts-ignore */}
                                    <tc-matchmaking-screen state="failed" mode="3v3 Ranked" region="EU-West" />
                                    {/* @ts-ignore */}
                                    <tc-matchmaking-screen state="idle" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Interactive — accept / cancel events">
                                <div className="d-flex flex-wrap gap-2 mb-3">
                                    {(['idle', 'searching', 'connecting', 'found', 'failed'] as State[]).map(s => (
                                        <button
                                            key={s}
                                            className={`btn btn-sm ${s === state ? 'btn-primary' : 'btn-outline-secondary'}`}
                                            onClick={() => { setState(s); setElapsed(0) }}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                                {/* @ts-ignore */}
                                <tc-matchmaking-screen
                                    ref={eventRef}
                                    state={state}
                                    elapsed={elapsed}
                                    estimated={45}
                                    mode="3v3 Ranked"
                                    region="EU-West"
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Set state to found or searching/connecting, then click a button…</span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}><code>{line}</code></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </SectionCard>

                            <SectionCard title="No meta — mode/region omitted">
                                {/* @ts-ignore */}
                                <tc-matchmaking-screen state="searching" elapsed="12" />
                            </SectionCard>

                            <SectionCard title="Custom found-label">
                                {/* @ts-ignore */}
                                <tc-matchmaking-screen state="found" found-label="Opponent Located" mode="1v1 Duel" region="NA-East" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MatchmakingScreenDemo

import React, { useEffect, useRef, useState } from 'react'

const LobbyDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const hostRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)
    const rankedRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.players = [
            { id: '1', name: 'Aria', ready: true },
            { id: '2', name: 'Kestrel', ready: false },
            { id: '3', name: 'Vesper', ready: true },
        ]
    }, [])

    useEffect(() => {
        if (!hostRef.current) return
        hostRef.current.players = [
            { id: '1', name: 'Aria', ready: true, host: true },
            { id: '2', name: 'Kestrel', ready: true },
            { id: '3', name: 'Vesper', ready: true },
            { id: '4', name: 'Onyx', ready: false },
        ]
    }, [])

    useEffect(() => {
        if (!rankedRef.current) return
        rankedRef.current.players = [
            { id: '1', name: 'Aria', ready: true, host: true, rank: 'Diamond' },
            { id: '2', name: 'Kestrel', ready: true, rank: 'Platinum' },
            { id: '3', name: 'Vesper', ready: false, rank: 'Gold' },
            { id: '4', name: 'Onyx', ready: false, rank: 'Silver' },
        ]
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.players = [
            { id: '1', name: 'Aria', ready: false, host: true },
            { id: '2', name: 'Kestrel', ready: false },
        ]
        const onLeave = () => setLog((l) => ['tc-leave fired', ...l].slice(0, 6))
        const onReady = () => setLog((l) => ['tc-ready fired', ...l].slice(0, 6))
        const onStart = () => setLog((l) => ['tc-start fired', ...l].slice(0, 6))
        el.addEventListener('tc-leave', onLeave)
        el.addEventListener('tc-ready', onReady)
        el.addEventListener('tc-start', onStart)
        return () => {
            el.removeEventListener('tc-leave', onLeave)
            el.removeEventListener('tc-ready', onReady)
            el.removeEventListener('tc-start', onStart)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Lobby"
                            description="Multiplayer lobby panel with player slots, ready state, and start controls. Players are set via the JS players property. The host player's slot controls the Start Match button; can-start enables it."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — 4-slot, no mode/map">
                                {/* @ts-ignore */}
                                <tc-lobby
                                    ref={basicRef}
                                    capacity="4"
                                    style={{ maxWidth: '480px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="With mode, map, host player, can-start">
                                {/* @ts-ignore */}
                                <tc-lobby
                                    ref={hostRef}
                                    capacity="4"
                                    lobby-mode="Team Deathmatch"
                                    map-name="Dust II"
                                    can-start
                                    style={{ maxWidth: '480px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="With rank chips">
                                {/* @ts-ignore */}
                                <tc-lobby
                                    ref={rankedRef}
                                    capacity="4"
                                    lobby-mode="Ranked"
                                    map-name="Mirage"
                                    style={{ maxWidth: '480px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Local player marked ready (is-ready attribute)">
                                {/* @ts-ignore */}
                                <tc-lobby capacity="4" is-ready style={{ maxWidth: '480px' }} />
                            </tc-section-card>

                            <tc-section-card title="Events — Leave / Ready Up / Start">
                                {/* @ts-ignore */}
                                <tc-lobby
                                    ref={eventsRef}
                                    capacity="4"
                                    can-start
                                    style={{ maxWidth: '480px' }}
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click Leave, Ready Up, or Start Match…
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LobbyDemo

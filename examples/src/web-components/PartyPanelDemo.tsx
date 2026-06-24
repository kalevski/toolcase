import React, { useEffect, useRef, useState } from 'react'

const PartyPanelDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const rolesRef = useRef<any>(null)
    const fullRef = useRef<any>(null)
    const eventsRef = useRef<any>(null)

    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        if (!basicRef.current) return
        basicRef.current.members = [
            { id: '1', name: 'Aldric', host: true, ready: true },
            { id: '2', name: 'Brina', ready: true },
            { id: '3', name: 'Caelum', ready: false },
        ]
    }, [])

    useEffect(() => {
        if (!rolesRef.current) return
        rolesRef.current.members = [
            { id: '1', name: 'Aldric', host: true, ready: true, role: 'Tank' },
            { id: '2', name: 'Brina', ready: true, role: 'Healer' },
            { id: '3', name: 'Caelum', ready: false, role: 'DPS' },
        ]
    }, [])

    useEffect(() => {
        if (!fullRef.current) return
        fullRef.current.members = [
            { id: '1', name: 'Aldric', host: true, ready: true, role: 'Tank' },
            { id: '2', name: 'Brina', ready: true, role: 'Healer' },
            { id: '3', name: 'Caelum', ready: true, role: 'DPS' },
            { id: '4', name: 'Devra', ready: true, role: 'Support' },
        ]
    }, [])

    useEffect(() => {
        const el = eventsRef.current
        if (!el) return
        el.members = [
            { id: '1', name: 'Aldric', host: true, ready: true },
            { id: '2', name: 'Brina', ready: false },
        ]
        const onLeave = () => setLog((l) => ['tc-leave fired', ...l].slice(0, 6))
        const onInvite = () => setLog((l) => ['tc-invite fired', ...l].slice(0, 6))
        el.addEventListener('tc-leave', onLeave)
        el.addEventListener('tc-invite', onInvite)
        return () => {
            el.removeEventListener('tc-leave', onLeave)
            el.removeEventListener('tc-invite', onInvite)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PartyPanel"
                            description="Party member panel with portraits, health, and status. Members are set via the JS members property. Empty slots render as Invite buttons that fire tc-invite; the Leave Party button fires tc-leave."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — 4-slot, members with ready state">
                                {/* @ts-ignore */}
                                <tc-party-panel
                                    ref={basicRef}
                                    capacity="4"
                                    style={{ maxWidth: '420px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="With role labels">
                                {/* @ts-ignore */}
                                <tc-party-panel
                                    ref={rolesRef}
                                    capacity="4"
                                    style={{ maxWidth: '420px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Full party (no empty slots)">
                                {/* @ts-ignore */}
                                <tc-party-panel
                                    ref={fullRef}
                                    capacity="4"
                                    style={{ maxWidth: '420px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Empty — no members set">
                                {/* @ts-ignore */}
                                <tc-party-panel capacity="4" style={{ maxWidth: '420px' }} />
                            </tc-section-card>

                            <tc-section-card title="Events — Leave Party / Invite">
                                {/* @ts-ignore */}
                                <tc-party-panel
                                    ref={eventsRef}
                                    capacity="4"
                                    style={{ maxWidth: '420px' }}
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click Leave Party or an Invite slot…
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

export default PartyPanelDemo

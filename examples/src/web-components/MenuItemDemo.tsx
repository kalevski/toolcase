import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const MenuItemDemo: React.FC = () => {
    const eventsRef = useRef<any>(null)
    const [log, setLog] = useState<string[]>([])

    useEffect(() => {
        const container = eventsRef.current
        if (!container) return
        const handler = (e: CustomEvent) => {
            setLog(l => [`tc-select: label="${e.detail.label}"`, ...l].slice(0, 6))
        }
        container.addEventListener('tc-select', handler)
        return () => container.removeEventListener('tc-select', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Menu Item"
                            description="A single interactive menu row — icon, label, optional hotkey badge, selected, and disabled states. Port of gc-menu-item (game-components), restyled to the toolcase design system. Fires tc-select on click or Enter/Space. All cosmetics flow through --bs-menu-item-* custom properties."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Label only">
                                <div style={{ maxWidth: '320px', border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Play" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Settings" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Credits" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Quit" />
                                </div>
                            </SectionCard>

                            <SectionCard title="With icons (lucide icon names)">
                                <div style={{ maxWidth: '320px', border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Play" icon="play" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Settings" icon="settings" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Users" icon="users" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Log Out" icon="log-out" />
                                </div>
                            </SectionCard>

                            <SectionCard title="With hotkey badges">
                                <div style={{ maxWidth: '320px', border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="New File" icon="file-plus" hotkey="Ctrl+N" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Open" icon="folder-open" hotkey="Ctrl+O" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Save" icon="save" hotkey="Ctrl+S" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Quit" icon="x-circle" hotkey="Ctrl+Q" />
                                </div>
                            </SectionCard>

                            <SectionCard title="Selected and disabled states">
                                <div style={{ maxWidth: '320px', border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Single Player" icon="user" selected />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Multiplayer" icon="users" hotkey="M" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Ranked Match" icon="trophy" disabled />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Settings" icon="settings" hotkey="S" disabled />
                                </div>
                            </SectionCard>

                            <SectionCard title="Events — click items to fire tc-select">
                                <div
                                    ref={eventsRef}
                                    style={{ maxWidth: '320px', border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="New Game" icon="plus-circle" hotkey="N" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Load Game" icon="folder" hotkey="L" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Options" icon="sliders-horizontal" hotkey="O" />
                                    {/* @ts-ignore */}
                                    <tc-menu-item label="Exit" icon="log-out" hotkey="Esc" />
                                </div>
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Click an item or press Enter/Space while focused…</span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}><code>{line}</code></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MenuItemDemo

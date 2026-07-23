import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const MainMenuDemo: React.FC = () => {
    const [log, setLog] = useState<string[]>([])

    const basicRef = useTc<HTMLElement>({
        items: [
            { id: 'play', label: 'Play' },
            { id: 'settings', label: 'Settings' },
            { id: 'credits', label: 'Credits' },
            { id: 'quit', label: 'Quit' },
        ],
    })

    const subtitleRef = useTc<HTMLElement>({
        items: [
            { id: 'continue', label: 'Continue' },
            { id: 'new-game', label: 'New Game' },
            { id: 'load', label: 'Load Game' },
            { id: 'options', label: 'Options' },
        ],
    })

    const disabledRef = useTc<HTMLElement>({
        items: [
            { id: 'single', label: 'Single Player' },
            { id: 'multi', label: 'Multiplayer', disabled: true },
            { id: 'ranked', label: 'Ranked Match', disabled: true },
            { id: 'settings', label: 'Settings' },
        ],
        selectedId: 'single',
    })

    const badgeRef = useTc<HTMLElement>({
        items: [
            { id: 'inbox', label: 'Inbox', badge: '3' },
            { id: 'friends', label: 'Friends', badge: '12' },
            { id: 'shop', label: 'Shop', badge: 'NEW' },
            { id: 'achievements', label: 'Achievements' },
        ],
    })

    const eventsRef = useTc<HTMLElement>(
        {
            items: [
                { id: 'play', label: 'Play' },
                { id: 'settings', label: 'Settings' },
                { id: 'quit', label: 'Quit' },
            ],
        },
        {
            'tc-select': (e: CustomEvent) => {
                setLog((l) => [`tc-select: id="${e.detail.id}"`, ...l].slice(0, 6))
            },
        }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Main Menu"
                            description="Main-menu container of menu items. Items are set via the JS items property. Arrow keys navigate between enabled items; Enter/Space fires tc-select for the highlighted item. Hover also highlights an item. All cosmetics flow through --bs-main-menu-* custom properties."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — no header">
                                {/* @ts-ignore */}
                                <tc-main-menu ref={basicRef} style={{ maxWidth: '320px' }} />
                            </tc-section-card>

                            <tc-section-card title="With menu-title and subtitle">
                                {/* @ts-ignore */}
                                <tc-main-menu
                                    ref={subtitleRef}
                                    menu-title="Arcane Realms"
                                    subtitle="Version 2.4.1"
                                    style={{ maxWidth: '320px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Pre-selected item (selected-id attribute)">
                                {/* @ts-ignore */}
                                <tc-main-menu
                                    ref={disabledRef}
                                    menu-title="Game Mode"
                                    style={{ maxWidth: '320px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Items with badges">
                                {/* @ts-ignore */}
                                <tc-main-menu
                                    ref={badgeRef}
                                    menu-title="Navigation"
                                    style={{ maxWidth: '320px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Events — click or use arrow keys then Enter">
                                {/* @ts-ignore */}
                                <tc-main-menu
                                    ref={eventsRef}
                                    menu-title="Main Menu"
                                    subtitle="Click an item or navigate with arrow keys"
                                    style={{ maxWidth: '320px' }}
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click an item or press Enter on a highlighted item…
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

export default MainMenuDemo

import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const items = ['Continue', 'New Game', 'Load', 'Settings', 'Quit']

const MenuItemDemo: React.FC = () => {
    const [active, setActive] = useState('New Game')
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const onSelect = (event: Event) => {
            const e = event as CustomEvent<{ label: string }>
            setActive(e.detail.label)
        }
        el.addEventListener('select', onSelect)
        return () => el.removeEventListener('select', onSelect)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="MenuItem"
                        description="Menu row with optional caret marker, icon, label, hotkey. Selected reflects to attribute. Click/Enter/Space emits 'select' with {label}."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Plain items">
                            {/* @ts-ignore */}
                            <gc-panel bordered>
                                {/* @ts-ignore */}
                                <gc-menu-item label="Continue" />
                                {/* @ts-ignore */}
                                <gc-menu-item label="New Game" />
                                {/* @ts-ignore */}
                                <gc-menu-item label="Settings" />
                                {/* @ts-ignore */}
                                <gc-menu-item label="Quit" disabled />
                                {/* @ts-ignore */}
                            </gc-panel>
                        </SectionCard>

                        <SectionCard title="With icons + hotkeys">
                            {/* @ts-ignore */}
                            <gc-panel bordered>
                                {/* @ts-ignore */}
                                <gc-menu-item label="Resume" icon="▶" hotkey="Esc" />
                                {/* @ts-ignore */}
                                <gc-menu-item label="Inventory" icon="bi-bag-fill" hotkey="I" />
                                {/* @ts-ignore */}
                                <gc-menu-item label="Map" icon="bi-map-fill" hotkey="M" />
                                {/* @ts-ignore */}
                                <gc-menu-item label="Quest Log" icon="bi-journal-text" hotkey="J" />
                                {/* @ts-ignore */}
                            </gc-panel>
                        </SectionCard>

                        <SectionCard title="Interactive selection">
                            <div ref={containerRef}>
                                {/* @ts-ignore */}
                                <gc-panel bordered>
                                    {items.map(label => (
                                        // @ts-ignore
                                        <gc-menu-item
                                            key={label}
                                            label={label}
                                            {...(label === active ? { selected: true } : {})}
                                        />
                                    ))}
                                    {/* @ts-ignore */}
                                </gc-panel>
                            </div>
                            <div className="mt-3" style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>
                                active: {active}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MenuItemDemo

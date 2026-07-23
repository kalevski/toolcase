import React, { useEffect, useRef, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

const RARITY_ITEMS: { rarity: Rarity; item: Record<string, unknown> }[] = [
    { rarity: 'common', item: { id: 'stick', name: 'Wooden Stick', icon: 'W', rarity: 'common' } },
    {
        rarity: 'uncommon',
        item: { id: 'dagger', name: 'Iron Dagger', icon: 'D', rarity: 'uncommon' },
    },
    { rarity: 'rare', item: { id: 'bow', name: 'Elven Bow', icon: 'B', rarity: 'rare' } },
    { rarity: 'epic', item: { id: 'staff', name: 'Arcane Staff', icon: 'A', rarity: 'epic' } },
    {
        rarity: 'legendary',
        item: { id: 'blade', name: 'Sunblade', icon: 'S', rarity: 'legendary' },
    },
    { rarity: 'mythic', item: { id: 'relic', name: 'World Relic', icon: 'R', rarity: 'mythic' } },
]

const STATE_ITEMS: Record<string, unknown>[] = [
    { id: 'potion', name: 'Health Potion', icon: 'P', qty: 5 },
    { id: 'arrows', name: 'Arrows', icon: 'A', qty: 120 },
    { id: 'helm', name: 'Plate Helm', icon: 'H', equipped: true, rarity: 'rare' },
    { id: 'dash', name: 'Dash', icon: 'D', cooldown: 4, cooldownMax: 8 },
    { id: 'vault', name: 'Locked Vault Key', icon: 'K', locked: true, rarity: 'epic' },
]

const ItemSlotDemo: React.FC = () => {
    const rarityRefs = useRef<(HTMLElement | null)[]>([])
    const stateRefs = useRef<(HTMLElement | null)[]>([])
    const [lastClicked, setLastClicked] = useState<string>('—')

    const selectableRef = useTc<HTMLElement>(
        {
            item: {
                id: 'sword',
                name: 'Longsword',
                icon: 'S',
                rarity: 'rare',
            },
        },
        {
            'tc-click': (e: Event) => {
                const item = (e as CustomEvent<{ item: { name?: string } | null }>).detail.item
                setLastClicked(item?.name ?? 'empty')
            },
        }
    )

    useEffect(() => {
        RARITY_ITEMS.forEach((entry, i) => {
            const el = rarityRefs.current[i]
            if (el) (el as unknown as { item: unknown }).item = entry.item
        })
        STATE_ITEMS.forEach((item, i) => {
            const el = stateRefs.current[i]
            if (el) (el as unknown as { item: unknown }).item = item
        })
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Item Slot"
                            description="A single inventory / hotbar slot: an item glyph, a quantity badge, a rarity border accent, an optional hotkey, an equipped marker, a radial cooldown sweep, and a locked state. Set the item via the JS item property; selected/size/hotkey are attributes. Activating an unlocked slot fires tc-click. Built in the toolcase idiom — no gilded frame, no glow: a sharp hairline tile, rarity as a single muted border accent."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Rarity tiers">
                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                    {RARITY_ITEMS.map((entry, i) => (
                                        // @ts-ignore — custom element
                                        <tc-item-slot
                                            key={entry.rarity}
                                            ref={(el: HTMLElement | null) =>
                                                (rarityRefs.current[i] = el)
                                            }
                                        />
                                    ))}
                                </div>
                                <p className="mt-3 mb-0 text-secondary">
                                    common · uncommon · rare · epic · legendary · mythic — rarity
                                    shifts only the hairline border colour.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="States — quantity, equipped, cooldown, locked">
                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                    {STATE_ITEMS.map((item, i) => (
                                        // @ts-ignore — custom element
                                        <tc-item-slot
                                            key={String(item.id)}
                                            hotkey={i < 4 ? String(i + 1) : undefined}
                                            ref={(el: HTMLElement | null) =>
                                                (stateRefs.current[i] = el)
                                            }
                                        />
                                    ))}
                                    {/* @ts-ignore — empty socket */}
                                    <tc-item-slot aria-label="Empty slot" />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Selectable (click or press Enter / Space)">
                                <div className="d-flex flex-wrap gap-2 align-items-center">
                                    {/* @ts-ignore — custom element */}
                                    <tc-item-slot
                                        ref={selectableRef}
                                        selected
                                        size="72"
                                        hotkey="Q"
                                    />
                                </div>
                                <p className="mt-3 mb-0 text-secondary">
                                    Last activated: <code>{lastClicked}</code>
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ItemSlotDemo

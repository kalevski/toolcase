import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const RECIPES = [
    {
        id: 'iron-sword',
        name: 'Iron Sword',
        icon: 'IS',
        inputs: [
            { item: { id: 'iron', name: 'Iron Ingot', icon: 'Fe' }, qty: 2, available: 5 },
            { item: { id: 'wood', name: 'Oak Plank', icon: 'W' }, qty: 1, available: 3 },
        ],
        output: { item: { id: 'iron-sword', name: 'Iron Sword', icon: 'IS' }, qty: 1 },
    },
    {
        id: 'health-potion',
        name: 'Health Potion',
        icon: 'HP',
        inputs: [
            { item: { id: 'herb', name: 'Red Herb', icon: 'H' }, qty: 3, available: 1 },
            { item: { id: 'vial', name: 'Glass Vial', icon: 'V' }, qty: 1, available: 4 },
        ],
        output: { item: { id: 'health-potion', name: 'Health Potion', icon: 'HP' }, qty: 2 },
    },
    {
        id: 'steel-shield',
        name: 'Steel Shield',
        icon: 'SS',
        inputs: [
            { item: { id: 'steel', name: 'Steel Plate', icon: 'St' }, qty: 4, available: 6 },
            { item: { id: 'leather', name: 'Leather Strap', icon: 'L' }, qty: 2, available: 2 },
        ],
        output: { item: { id: 'steel-shield', name: 'Steel Shield', icon: 'SS' }, qty: 1 },
    },
]

const CraftingPanelDemo: React.FC = () => {
    const [selected, setSelected] = useState<string | null>(null)
    const [crafted, setCrafted] = useState<string | null>(null)

    const basicRef = useTc<HTMLElement>({ recipes: RECIPES, selectedId: 'iron-sword' })

    const interactiveRef = useTc<HTMLElement>(
        { recipes: RECIPES },
        {
            'tc-select': (e: CustomEvent) => {
                setSelected(e.detail.id)
                console.log('[tc-crafting-panel] tc-select:', e.detail.id)
            },
            'tc-craft': (e: CustomEvent) => {
                setCrafted(e.detail.id)
                console.log('[tc-crafting-panel] tc-craft:', e.detail.id)
                // Simulate a brief crafting cycle.
                const el = interactiveRef.current as any
                if (!el) return
                el.crafting = true
                window.setTimeout(() => {
                    el.crafting = false
                }, 900)
            },
        }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CraftingPanel"
                            description="Crafting UI: a recipe list, the selected recipe's ingredient requirements, and a craft action. Set rows via the recipes JS property; selecting a row fires tc-select, and the craft button fires tc-craft. Ingredients with insufficient stock read in the danger colour and the craft button disables until the recipe is affordable."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic (Iron Sword pre-selected)">
                                {/* @ts-ignore */}
                                <tc-crafting-panel ref={basicRef}></tc-crafting-panel>
                            </tc-section-card>

                            <tc-section-card title="Interactive (select a recipe, then Craft)">
                                {/* @ts-ignore */}
                                <tc-crafting-panel ref={interactiveRef}></tc-crafting-panel>
                                <p className="mt-3 mb-0 text-secondary">
                                    Selected: <strong>{selected ?? '— none yet —'}</strong>
                                    {' · '}
                                    Last crafted: <strong>{crafted ?? '— none yet —'}</strong>
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CraftingPanelDemo

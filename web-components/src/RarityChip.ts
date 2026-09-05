import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
// Re-uses the canonical ItemRarity union owned by tc-item-slot so every rarity-
// aware port shares one source of truth.
import type { ItemRarity } from './ItemSlot'

const TAG_NAME = 'tc-rarity-chip'

const RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

const RARITY_LABEL: Record<ItemRarity, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    mythic: 'Mythic',
}

// Port of game-components `gc-rarity-chip`: an item-rarity label chip.
// Purely attribute-driven, no slots, no events. The fantasy chrome (gilded
// frames, glows, metal textures) is dropped — this renders as a mono uppercase
// chip with a rarity-tinted border and text per the design system.
export class RarityChip extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['rarity']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get rarity(): ItemRarity {
        const v = this.getAttribute('rarity') as ItemRarity
        return RARITIES.includes(v) ? v : 'common'
    }
    set rarity(value: ItemRarity) {
        this.setAttribute('rarity', RARITIES.includes(value) ? value : 'common')
    }

    private render(): void {
        const rarity = this.rarity
        const label = esc(RARITY_LABEL[rarity])
        patchHtml(this, `<span class="tc-rarity-chip tc-rarity-chip--${rarity}">${label}</span>`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RarityChip
    }
}

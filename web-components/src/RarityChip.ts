const TAG_NAME = 'tc-rarity-chip'

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

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
        this.innerHTML = `<span class="tc-rarity-chip tc-rarity-chip--${rarity}">${label}</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RarityChip
    }
}

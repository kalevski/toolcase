const TAG_NAME = 'gc-rarity-chip'

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

const RARITY_LABEL: Record<ItemRarity, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    mythic: 'Mythic'
}

export class RarityChip extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['rarity']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        if (!this.hasAttribute('rarity')) {
            this.setAttribute('rarity', 'common')
        }
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.render()
        }
    }

    get rarity(): ItemRarity {
        return (this.getAttribute('rarity') as ItemRarity) || 'common'
    }
    set rarity(value: ItemRarity) {
        this.setAttribute('rarity', value)
    }

    private render(): void {
        const rarity = this.rarity
        if (!this.querySelector('.gc-rarity-chip-label')) {
            this.innerHTML = `<span class="gc-rarity-chip-label">${this.escape(RARITY_LABEL[rarity] || rarity)}</span>`
            return
        }
        const label = this.querySelector<HTMLElement>('.gc-rarity-chip-label')
        if (label) label.textContent = RARITY_LABEL[rarity] || rarity
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RarityChip
    }
}

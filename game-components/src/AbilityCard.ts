const TAG_NAME = 'gc-ability-card'

export type AbilityCardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export class AbilityCard extends HTMLElement {

    static get observedAttributes(): string[] {
        return [
            'ability-name',
            'icon',
            'description',
            'cooldown',
            'cost',
            'range',
            'keybind',
            'rarity'
        ]
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get abilityName(): string {
        return this.getAttribute('ability-name') ?? ''
    }
    set abilityName(v: string) {
        if (v) this.setAttribute('ability-name', v)
        else this.removeAttribute('ability-name')
    }

    get icon(): string {
        return this.getAttribute('icon') ?? ''
    }
    set icon(v: string) {
        if (v) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get description(): string {
        return this.getAttribute('description') ?? ''
    }
    set description(v: string) {
        if (v) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    get cooldown(): string {
        return this.getAttribute('cooldown') ?? ''
    }
    set cooldown(v: string) {
        if (v) this.setAttribute('cooldown', v)
        else this.removeAttribute('cooldown')
    }

    get cost(): string {
        return this.getAttribute('cost') ?? ''
    }
    set cost(v: string) {
        if (v) this.setAttribute('cost', v)
        else this.removeAttribute('cost')
    }

    get range(): string {
        return this.getAttribute('range') ?? ''
    }
    set range(v: string) {
        if (v) this.setAttribute('range', v)
        else this.removeAttribute('range')
    }

    get keybind(): string {
        return this.getAttribute('keybind') ?? ''
    }
    set keybind(v: string) {
        if (v) this.setAttribute('keybind', v)
        else this.removeAttribute('keybind')
    }

    get rarity(): AbilityCardRarity {
        return (this.getAttribute('rarity') as AbilityCardRarity) || 'common'
    }
    set rarity(v: AbilityCardRarity) {
        this.setAttribute('rarity', v)
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const rarity = this.rarity
        this.dataset.rarity = rarity

        const icon = this.icon
        const iconMarkup = icon
            ? `<gc-icon-badge class="gc-ability-card-icon" glyph="${this.escape(icon)}" size="48"></gc-icon-badge>`
            : `<div class="gc-ability-card-icon-placeholder"></div>`

        const keybindMarkup = this.keybind
            ? `<gc-key class="gc-ability-card-keybind">${this.escape(this.keybind)}</gc-key>`
            : ''

        const meta = [
            this.cooldown ? { label: 'Cooldown', value: this.cooldown } : null,
            this.cost ? { label: 'Cost', value: this.cost } : null,
            this.range ? { label: 'Range', value: this.range } : null
        ].filter(Boolean) as { label: string, value: string }[]

        const metaMarkup = meta.length
            ? `<div class="gc-ability-card-meta">${meta.map(m => `
                <div class="gc-ability-card-meta-row">
                    <span class="gc-ability-card-meta-label">${this.escape(m.label)}</span>
                    <span class="gc-ability-card-meta-value">${this.escape(m.value)}</span>
                </div>
            `).join('')}</div>`
            : ''

        const description = this.description
        const descMarkup = description
            ? `<div class="gc-ability-card-description">${this.escape(description)}</div>`
            : ''

        this.innerHTML = `
            <div class="gc-ability-card-header">
                ${iconMarkup}
                <div class="gc-ability-card-header-text">
                    <gc-eyebrow class="gc-ability-card-rarity">${this.escape(rarity)}</gc-eyebrow>
                    <div class="gc-ability-card-name">${this.escape(this.abilityName)}</div>
                </div>
                ${keybindMarkup}
            </div>
            ${descMarkup}
            ${metaMarkup}
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AbilityCard
    }
}

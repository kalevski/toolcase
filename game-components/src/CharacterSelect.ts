const TAG_NAME = 'gc-character-select'

export interface CharacterEntry {
    id: string
    name: string
    role?: string
    locked?: boolean
    portrait?: string
    description?: string
    stats?: { label: string, value: string | number }[]
}

export interface CharacterSelectEventMap {
    select: CustomEvent<{ id: string }>
    confirm: CustomEvent<{ id: string }>
}

export class CharacterSelect extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id']
    }

    private _characters: CharacterEntry[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'listbox')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(v: string) {
        if (v) this.setAttribute('selected-id', v)
        else this.removeAttribute('selected-id')
    }

    get characters(): CharacterEntry[] {
        return this._characters.slice()
    }
    set characters(v: CharacterEntry[]) {
        this._characters = Array.isArray(v) ? v.slice() : []
        if (this.isConnected) this.render()
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private formatValue(v: string | number): string {
        if (typeof v === 'number') return v.toLocaleString()
        return v
    }

    private render(): void {
        const selected = this.selectedId
        const active = this._characters.find((c) => c.id === selected) ?? null

        const tilesMarkup = this._characters.map((character) => {
            const isSelected = character.id === selected
            const cls = `gc-character-select-tile${isSelected ? ' is-selected' : ''}${character.locked ? ' is-locked' : ''}`
            const lockMarkup = character.locked
                ? `<span class="gc-character-select-lock">🔒</span>`
                : ''
            const portraitGlyph = character.portrait || character.name.charAt(0).toUpperCase()
            const roleMarkup = character.role
                ? `<span class="gc-character-select-tile-role">${this.escape(character.role)}</span>`
                : ''
            return `<div role="option" tabindex="${character.locked ? '-1' : '0'}" class="${cls}" data-id="${this.escape(character.id)}" aria-selected="${isSelected ? 'true' : 'false'}" aria-disabled="${character.locked ? 'true' : 'false'}">
                <gc-portrait class="gc-character-select-portrait" glyph="${this.escape(portraitGlyph)}" size="64"></gc-portrait>
                <div class="gc-character-select-tile-body">
                    <span class="gc-character-select-tile-name">${this.escape(character.name)}</span>
                    ${roleMarkup}
                </div>
                ${lockMarkup}
            </div>`
        }).join('')

        const detailMarkup = active
            ? this.renderDetail(active)
            : `<div class="gc-character-select-detail-empty">Select a character.</div>`

        this.innerHTML = `
            <div class="gc-character-select-root">
                <div class="gc-character-select-grid">${tilesMarkup}</div>
                <div class="gc-character-select-detail">${detailMarkup}</div>
            </div>
        `

        this.querySelectorAll<HTMLElement>('.gc-character-select-tile').forEach((el) => {
            const id = el.dataset.id || ''
            const character = this._characters.find((c) => c.id === id)
            if (!character) return
            if (character.locked) return
            el.addEventListener('click', () => {
                this.selectedId = id
                this.emit('select', { id })
            })
            el.addEventListener('dblclick', () => {
                this.selectedId = id
                this.emit('confirm', { id })
            })
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    this.selectedId = id
                    this.emit('select', { id })
                }
            })
        })
    }

    private renderDetail(character: CharacterEntry): string {
        const description = character.description
            ? `<div class="gc-character-select-detail-description">${this.escape(character.description)}</div>`
            : ''
        const stats = (character.stats || []).map((stat) => {
            return `<div class="gc-character-select-detail-stat">
                <span class="gc-character-select-detail-stat-label">${this.escape(stat.label)}</span>
                <span class="gc-character-select-detail-stat-value">${this.escape(this.formatValue(stat.value))}</span>
            </div>`
        }).join('')
        const statsBlock = stats
            ? `<div class="gc-character-select-detail-stats">${stats}</div>`
            : ''
        const role = character.role
            ? `<gc-eyebrow class="gc-character-select-detail-role">${this.escape(character.role)}</gc-eyebrow>`
            : ''
        return `
            ${role}
            <gc-title class="gc-character-select-detail-name">${this.escape(character.name)}</gc-title>
            ${description}
            ${statsBlock}
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, CharacterSelect)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CharacterSelect
    }
}

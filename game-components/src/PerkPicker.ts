const TAG_NAME = 'gc-perk-picker'

export interface Perk {
    id: string
    name: string
    description?: string
    icon?: string
    selected?: boolean
    locked?: boolean
}

export interface PerkPickerEventMap {
    select: CustomEvent<{ id: string }>
}

export class PerkPicker extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['columns']
    }

    private _perks: Perk[] = []

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

    get columns(): number {
        const raw = this.getAttribute('columns')
        if (raw == null) return 3
        const parsed = parseInt(raw, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 3
    }
    set columns(v: number) {
        this.setAttribute('columns', String(v))
    }

    get perks(): Perk[] {
        return this._perks.slice()
    }
    set perks(value: Perk[]) {
        this._perks = Array.isArray(value) ? value.slice() : []
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

    private render(): void {
        this.style.setProperty('--gc-perk-picker-columns', String(this.columns))

        const cardsMarkup = this._perks.map((p) => {
            const cls = `gc-perk-picker-card${p.selected ? ' is-selected' : ''}${p.locked ? ' is-locked' : ''}`
            const tabindex = p.locked ? '-1' : '0'
            const icon = p.locked ? '🔒' : (p.icon || '✦')
            const descMarkup = p.description
                ? `<span class="gc-perk-picker-card-description">${this.escape(p.description)}</span>`
                : ''
            return `<div role="option" tabindex="${tabindex}" class="${cls}" data-id="${this.escape(p.id)}" aria-selected="${p.selected ? 'true' : 'false'}" aria-disabled="${p.locked ? 'true' : 'false'}">
                <div class="gc-perk-picker-card-icon">${this.escape(icon)}</div>
                <span class="gc-perk-picker-card-name">${this.escape(p.name)}</span>
                ${descMarkup}
            </div>`
        }).join('')

        this.innerHTML = cardsMarkup

        this.querySelectorAll<HTMLElement>('.gc-perk-picker-card').forEach((el) => {
            const id = el.dataset.id || ''
            const perk = this._perks.find((p) => p.id === id)
            if (!perk || perk.locked) return
            const fire = () => this.emit('select', { id })
            el.addEventListener('click', fire)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                fire()
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PerkPicker
    }
}

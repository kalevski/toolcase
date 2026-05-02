const TAG_NAME = 'gc-skill-bar'

export interface SkillSlot {
    id: string
    icon?: string
    hotkey?: string
    cooldown?: number
    remaining?: number
    charges?: number
    disabled?: boolean
    selected?: boolean
}

export interface SkillBarEventMap {
    activate: CustomEvent<{ id: string }>
}

export class SkillBar extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['slot-size', 'gap']
    }

    private _slots: SkillSlot[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'toolbar')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get slots(): SkillSlot[] {
        return this._slots.slice()
    }
    set slots(value: SkillSlot[]) {
        this._slots = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    get slotSize(): number {
        const raw = this.getAttribute('slot-size')
        if (raw == null) return 56
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 56 : parsed
    }
    set slotSize(value: number) {
        if (value > 0) this.setAttribute('slot-size', String(value))
        else this.removeAttribute('slot-size')
    }

    get gap(): string {
        return this.getAttribute('gap') ?? '6px'
    }
    set gap(value: string) {
        if (value) this.setAttribute('gap', value)
        else this.removeAttribute('gap')
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

    private renderGlyph(icon?: string): string {
        if (!icon) return ''
        if (icon.startsWith('bi-') || icon.startsWith('bi ')) {
            const cls = icon.startsWith('bi ') ? icon : `bi ${icon}`
            return `<i class="gc-skill-bar-glyph ${this.escape(cls)}"></i>`
        }
        return `<span class="gc-skill-bar-glyph">${this.escape(icon)}</span>`
    }

    private render(): void {
        const size = this.slotSize
        this.style.setProperty('--gc-skill-bar-size', `${size}px`)
        this.style.setProperty('--gc-skill-bar-glyph-size', `${Math.round(size * 0.42)}px`)
        this.style.setProperty('--gc-skill-bar-gap', this.gap)

        const cellsHTML = this._slots.map((slot, index) => {
            const cdPct = slot.remaining != null && slot.cooldown && slot.cooldown > 0
                ? Math.max(0, Math.min(1, slot.remaining / slot.cooldown))
                : null
            const cooldownMarkup = cdPct != null && cdPct > 0
                ? `<div class="gc-skill-bar-cooldown" style="--cd: ${cdPct * 360}deg">
                        <span class="gc-skill-bar-cooldown-label">${Math.ceil(slot.remaining!)}</span>
                   </div>`
                : ''
            const hotkeyMarkup = slot.hotkey
                ? `<span class="gc-skill-bar-hotkey">${this.escape(slot.hotkey)}</span>`
                : ''
            const chargesMarkup = slot.charges != null && slot.charges > 0
                ? `<span class="gc-skill-bar-charges">${slot.charges}</span>`
                : ''
            const cls = `gc-skill-bar-cell${slot.selected ? ' is-selected' : ''}${slot.disabled ? ' is-disabled' : ''}`
            return `<div class="${cls}" data-index="${index}" data-id="${this.escape(slot.id)}" tabindex="${slot.disabled ? '-1' : '0'}" role="button" aria-disabled="${slot.disabled ? 'true' : 'false'}">
                ${this.renderGlyph(slot.icon)}
                ${hotkeyMarkup}
                ${chargesMarkup}
                ${cooldownMarkup}
            </div>`
        }).join('')
        this.innerHTML = `<div class="gc-skill-bar-row">${cellsHTML}</div>`

        this.querySelectorAll<HTMLElement>('.gc-skill-bar-cell').forEach((el) => {
            const index = parseInt(el.dataset.index ?? '-1', 10)
            const slot = this._slots[index]
            if (!slot) return
            const activate = () => {
                if (slot.disabled) return
                this.emit('activate', { id: slot.id })
            }
            el.addEventListener('click', activate)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                activate()
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SkillBar
    }
}

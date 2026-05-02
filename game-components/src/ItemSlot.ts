import type { ItemRarity } from './RarityChip'

const TAG_NAME = 'gc-item-slot'

export interface InventoryItem {
    id: string
    name?: string
    icon?: string
    rarity?: ItemRarity
    qty?: number
    cooldown?: number
    cooldownMax?: number
    equipped?: boolean
    locked?: boolean
}

export interface ItemSlotEventMap {
    click: CustomEvent<{ item: InventoryItem | null }>
}

export class ItemSlot extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected', 'size', 'hotkey']
    }

    private _item: InventoryItem | null = null

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        this.addEventListener('click', this.handleClick)
        this.addEventListener('keydown', this.handleKeydown)
        this.render()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this.handleClick)
        this.removeEventListener('keydown', this.handleKeydown)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get item(): InventoryItem | null {
        return this._item
    }
    set item(value: InventoryItem | null) {
        this._item = value && typeof value === 'object' ? value : null
        if (this.isConnected) this.render()
    }

    get selected(): boolean {
        return this.hasAttribute('selected')
    }
    set selected(value: boolean) {
        if (value) this.setAttribute('selected', '')
        else this.removeAttribute('selected')
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 56
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 56 : parsed
    }
    set size(value: number) {
        if (value > 0) this.setAttribute('size', String(value))
        else this.removeAttribute('size')
    }

    get hotkey(): string {
        return this.getAttribute('hotkey') ?? ''
    }
    set hotkey(value: string) {
        if (value) this.setAttribute('hotkey', value)
        else this.removeAttribute('hotkey')
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

    private handleClick = (event: Event): void => {
        if (this._item?.locked) return
        event.stopPropagation()
        this.emit('click', { item: this._item })
    }

    private handleKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (this._item?.locked) return
        event.preventDefault()
        this.emit('click', { item: this._item })
    }

    private renderGlyph(icon: string): string {
        if (!icon) return ''
        if (icon.startsWith('bi-') || icon.startsWith('bi ')) {
            const cls = icon.startsWith('bi ') ? icon : `bi ${icon}`
            return `<i class="gc-item-slot-glyph ${this.escape(cls)}"></i>`
        }
        return `<span class="gc-item-slot-glyph">${this.escape(icon)}</span>`
    }

    private render(): void {
        const size = this.size
        this.style.setProperty('--gc-item-slot-size', `${size}px`)
        this.style.setProperty('--gc-item-slot-glyph-size', `${Math.round(size * 0.42)}px`)

        const item = this._item
        const rarity = item?.rarity ?? 'common'
        if (item) this.dataset.rarity = rarity
        else delete this.dataset.rarity

        const isEmpty = !item
        const isLocked = !!item?.locked
        this.toggleAttribute('aria-disabled', isLocked)
        if (isLocked) this.setAttribute('tabindex', '-1')
        else this.setAttribute('tabindex', '0')

        const glyph = item?.icon ? this.renderGlyph(item.icon) : ''
        const cdPct = item?.cooldown != null && item?.cooldownMax && item.cooldownMax > 0
            ? Math.max(0, Math.min(1, item.cooldown / item.cooldownMax))
            : null
        const cooldownMarkup = cdPct != null && cdPct > 0
            ? `<div class="gc-item-slot-cooldown" style="--cd: ${cdPct * 360}deg">
                    <span class="gc-item-slot-cooldown-label">${Math.ceil(item!.cooldown!)}</span>
               </div>`
            : ''
        const qtyMarkup = item?.qty != null && item.qty > 1
            ? `<span class="gc-item-slot-qty">${item.qty.toLocaleString()}</span>`
            : ''
        const equippedMarkup = item?.equipped
            ? `<span class="gc-item-slot-equipped" aria-label="Equipped">E</span>`
            : ''
        const lockedMarkup = isLocked
            ? `<span class="gc-item-slot-lock">🔒</span>`
            : ''
        const hotkey = this.hotkey
        const hotkeyMarkup = hotkey
            ? `<span class="gc-item-slot-hotkey">${this.escape(hotkey)}</span>`
            : ''
        const emptyClass = isEmpty ? ' is-empty' : ''
        const lockedClass = isLocked ? ' is-locked' : ''

        this.className = (this.className.replace(/\bis-(empty|locked)\b/g, '').trim() + emptyClass + lockedClass).trim()

        this.innerHTML = `
            <div class="gc-item-slot-inner">
                ${glyph}
                ${qtyMarkup}
                ${equippedMarkup}
                ${cooldownMarkup}
                ${lockedMarkup}
                ${hotkeyMarkup}
            </div>
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ItemSlot)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ItemSlot
    }
}

import type { InventoryItem } from './ItemSlot'

const TAG_NAME = 'gc-hotbar'

export interface HotbarSlot {
    item?: InventoryItem | null
    hotkey?: string
}

export interface HotbarEventMap {
    select: CustomEvent<{ item: InventoryItem | null, index: number }>
}

export class Hotbar extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['slot-size', 'selected-id']
    }

    private _slots: HotbarSlot[] = []

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

    get slots(): HotbarSlot[] {
        return this._slots.slice()
    }
    set slots(value: HotbarSlot[]) {
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

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(value: string) {
        if (value) this.setAttribute('selected-id', value)
        else this.removeAttribute('selected-id')
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
        const size = this.slotSize
        const selected = this.selectedId
        const cellsHTML = this._slots.map((slot, index) => {
            const id = slot.item?.id ?? ''
            const isSelected = !!id && id === selected
            return `<gc-item-slot
                class="gc-hotbar-slot"
                data-index="${index}"
                size="${size}"
                ${isSelected ? 'selected' : ''}
                ${slot.hotkey ? `hotkey="${this.escape(slot.hotkey)}"` : ''}
            ></gc-item-slot>`
        }).join('')
        this.innerHTML = `<div class="gc-hotbar-row">${cellsHTML}</div>`

        const slotEls = this.querySelectorAll<HTMLElement>('.gc-hotbar-slot')
        slotEls.forEach((el, index) => {
            const slot = this._slots[index]
            if (!slot) return
            ;(el as any).item = slot.item ?? null
            el.addEventListener('click', () => {
                const item = slot.item ?? null
                if (item?.id) this.selectedId = item.id
                this.emit('select', { item, index })
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Hotbar
    }
}

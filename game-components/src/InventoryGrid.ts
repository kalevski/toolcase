import type { InventoryItem } from './ItemSlot'

const TAG_NAME = 'gc-inventory-grid'

export interface InventoryGridEventMap {
    select: CustomEvent<{ item: InventoryItem | null, index: number }>
}

export class InventoryGrid extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['columns', 'slot-size', 'selected-id']
    }

    private _items: (InventoryItem | null)[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'grid')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get items(): (InventoryItem | null)[] {
        return this._items.slice()
    }
    set items(value: (InventoryItem | null)[]) {
        this._items = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    get columns(): number {
        const raw = this.getAttribute('columns')
        if (raw == null) return 6
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) || parsed <= 0 ? 6 : parsed
    }
    set columns(value: number) {
        if (value > 0) this.setAttribute('columns', String(value))
        else this.removeAttribute('columns')
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

    private render(): void {
        const size = this.slotSize
        const cols = this.columns
        const selected = this.selectedId
        this.style.setProperty('--gc-inventory-grid-cols', String(cols))
        this.style.setProperty('--gc-inventory-grid-cell', `${size}px`)

        const cellsHTML = this._items.map((_, index) => {
            const item = this._items[index] ?? null
            const id = item?.id ?? ''
            const isSelected = !!id && id === selected
            return `<gc-item-slot
                class="gc-inventory-grid-slot"
                data-index="${index}"
                size="${size}"
                ${isSelected ? 'selected' : ''}
            ></gc-item-slot>`
        }).join('')
        this.innerHTML = `<div class="gc-inventory-grid-cells">${cellsHTML}</div>`

        this.querySelectorAll<HTMLElement>('.gc-inventory-grid-slot').forEach((el, index) => {
            const item = this._items[index] ?? null
            ;(el as any).item = item
            el.addEventListener('click', () => {
                if (item?.id) this.selectedId = item.id
                this.emit('select', { item, index })
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InventoryGrid
    }
}

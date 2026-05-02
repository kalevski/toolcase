import type { InventoryItem } from './ItemSlot'

const TAG_NAME = 'gc-equipment-doll'

export interface EquipmentSlotConfig {
    id: string
    label?: string
    item?: InventoryItem | null
    x: number
    y: number
}

export interface EquipmentDollEventMap {
    select: CustomEvent<{ id: string }>
}

export class EquipmentDoll extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['silhouette', 'width', 'height', 'slot-size', 'selected-id']
    }

    private _slots: EquipmentSlotConfig[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get slots(): EquipmentSlotConfig[] {
        return this._slots.slice()
    }
    set slots(value: EquipmentSlotConfig[]) {
        this._slots = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    get silhouette(): string {
        return this.getAttribute('silhouette') ?? ''
    }
    set silhouette(value: string) {
        if (value) this.setAttribute('silhouette', value)
        else this.removeAttribute('silhouette')
    }

    get width(): number {
        const raw = this.getAttribute('width')
        if (raw == null) return 240
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 240 : parsed
    }
    set width(value: number) {
        if (value > 0) this.setAttribute('width', String(value))
        else this.removeAttribute('width')
    }

    get height(): number {
        const raw = this.getAttribute('height')
        if (raw == null) return 360
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 360 : parsed
    }
    set height(value: number) {
        if (value > 0) this.setAttribute('height', String(value))
        else this.removeAttribute('height')
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
        const w = this.width
        const h = this.height
        const slotSize = this.slotSize
        const selected = this.selectedId
        const silhouette = this.silhouette

        this.style.setProperty('--gc-equipment-doll-width', `${w}px`)
        this.style.setProperty('--gc-equipment-doll-height', `${h}px`)
        this.style.setProperty('--gc-equipment-doll-slot-size', `${slotSize}px`)

        const silhouetteMarkup = silhouette
            ? `<div class="gc-equipment-doll-silhouette">${this.escape(silhouette)}</div>`
            : `<div class="gc-equipment-doll-silhouette is-default">⚔</div>`

        const slotsHTML = this._slots.map((cfg, index) => {
            const isSelected = cfg.id === selected
            const labelMarkup = cfg.label
                ? `<div class="gc-equipment-doll-slot-label">${this.escape(cfg.label)}</div>`
                : ''
            return `<div class="gc-equipment-doll-anchor" data-index="${index}" data-id="${this.escape(cfg.id)}" style="left: ${cfg.x}%; top: ${cfg.y}%;">
                <gc-item-slot
                    class="gc-equipment-doll-slot"
                    size="${slotSize}"
                    ${isSelected ? 'selected' : ''}
                ></gc-item-slot>
                ${labelMarkup}
            </div>`
        }).join('')

        this.innerHTML = `
            <div class="gc-equipment-doll-canvas">
                ${silhouetteMarkup}
                ${slotsHTML}
            </div>
        `

        this.querySelectorAll<HTMLElement>('.gc-equipment-doll-anchor').forEach((anchor) => {
            const index = parseInt(anchor.dataset.index ?? '-1', 10)
            const cfg = this._slots[index]
            if (!cfg) return
            const slotEl = anchor.querySelector<HTMLElement>('.gc-equipment-doll-slot')
            if (slotEl) (slotEl as any).item = cfg.item ?? null
            anchor.addEventListener('click', () => {
                this.selectedId = cfg.id
                this.emit('select', { id: cfg.id })
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EquipmentDoll
    }
}

const TAG_NAME = 'tc-equipment-doll'

// A single equipped item. Pared down from the game-components InventoryItem to
// the fields the design-system port renders — rarity/cooldown/lock are fantasy
// chrome and are intentionally dropped.
export interface EquipmentItem {
    id: string
    name?: string
    icon?: string
    qty?: number
}

export interface EquipmentSlotConfig {
    id: string
    label?: string
    item?: EquipmentItem | null
    x: number
    y: number
}

export interface EquipmentDollEventMap {
    'tc-select': CustomEvent<{ id: string }>
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

// An item icon that looks like an image source is rendered as an <img>;
// otherwise the string is treated as a short glyph/initials label inside the
// sharp slot tile (mirrors the tc-crafting-panel icon-tile pattern — the design
// system forbids emoji-as-icon, so free-form data glyphs stay content).
function isImageSrc(value: string): boolean {
    return /^(https?:|\/|\.\/|\.\.\/|data:image\/)/.test(value) || /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(value)
}

// Neutral humanoid figure used when no custom `silhouette` is supplied. A faint
// slate backdrop for the equipment slots arranged around it — no fantasy fill,
// no glow. Inline SVG so CSS owns its color and opacity.
const DEFAULT_FIGURE = `<svg class="tc-equipment-doll__figure" viewBox="0 0 120 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <circle cx="60" cy="28" r="20" />
    <path d="M60 50 C44 50 34 60 34 78 L34 122 C34 134 40 142 50 142 L70 142 C80 142 86 134 86 122 L86 78 C86 60 76 50 60 50 Z" />
    <path d="M34 72 C24 74 20 84 20 98 L22 136 C22 142 30 142 30 136 L34 102 Z" />
    <path d="M86 72 C96 74 100 84 100 98 L98 136 C98 142 90 142 90 136 L86 102 Z" />
    <path d="M50 142 L46 214 C46 222 56 222 56 214 L60 152 Z" />
    <path d="M70 142 L74 214 C74 222 64 222 64 214 L60 152 Z" />
</svg>`

export class EquipmentDoll extends HTMLElement {
    private _initialised = false
    private _slots: EquipmentSlotConfig[] = []

    /** Optional callback fired alongside the tc-select CustomEvent. */
    onSelect: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['silhouette', 'width', 'height', 'slot-size', 'selected-id']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this.addEventListener('click', this._onClick)
            this.addEventListener('keydown', this._onKeydown)
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get slots(): EquipmentSlotConfig[] {
        return this._slots.slice()
    }
    set slots(value: EquipmentSlotConfig[]) {
        this._slots = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
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

    private emit(id: string): void {
        this.dispatchEvent(new CustomEvent('tc-select', { detail: { id }, bubbles: true, composed: true }))
        if (typeof this.onSelect === 'function') this.onSelect(id)
    }

    private _anchorFor(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof HTMLElement)) return null
        const anchor = target.closest<HTMLElement>('.tc-equipment-doll__slot')
        if (!anchor || !this.contains(anchor)) return null
        return anchor
    }

    private _select(anchor: HTMLElement): void {
        const id = anchor.dataset.id
        if (id == null) return
        this.selectedId = id
        this.emit(id)
    }

    private _onClick = (e: MouseEvent): void => {
        const anchor = this._anchorFor(e.target)
        if (anchor) this._select(anchor)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const anchor = this._anchorFor(e.target)
        if (!anchor) return
        e.preventDefault()
        this._select(anchor)
    }

    // Sharp slot tile contents: <img> when the icon looks like an image source,
    // otherwise a short glyph/initials label derived from the icon string or item
    // name; an empty slot renders nothing (the dashed placeholder is pure CSS).
    private _slotBody(item: EquipmentItem | null | undefined): string {
        if (!item) return ''
        const icon = item.icon
        const name = item.name ?? item.id
        let glyphMarkup = ''
        if (icon && isImageSrc(icon)) {
            glyphMarkup = `<img class="tc-equipment-doll__icon" src="${esc(icon)}" alt="" />`
        } else {
            const glyph = icon || (name ? name.charAt(0).toUpperCase() : '?')
            glyphMarkup = `<span class="tc-equipment-doll__icon" aria-hidden="true">${esc(glyph)}</span>`
        }
        const qtyMarkup = item.qty != null && item.qty > 1
            ? `<span class="tc-equipment-doll__qty">${esc(item.qty.toLocaleString())}</span>`
            : ''
        return glyphMarkup + qtyMarkup
    }

    private render(): void {
        this.classList.add('tc-equipment-doll')

        const slotSize = this.slotSize
        this.style.setProperty('--bs-equipment-doll-width', `${this.width}px`)
        this.style.setProperty('--bs-equipment-doll-height', `${this.height}px`)
        this.style.setProperty('--bs-equipment-doll-slot-size', `${slotSize}px`)

        const selected = this.selectedId
        const silhouette = this.silhouette
        const figureMarkup = silhouette
            ? `<div class="tc-equipment-doll__silhouette" aria-hidden="true">${esc(silhouette)}</div>`
            : DEFAULT_FIGURE

        const slotsHTML = this._slots.map((cfg) => {
            const isSelected = cfg.id === selected
            const item = cfg.item ?? null
            const accLabel = cfg.label || item?.name || cfg.id
            const filledClass = item ? ' is-filled' : ' is-empty'
            const selectedClass = isSelected ? ' is-selected' : ''
            const labelMarkup = cfg.label
                ? `<span class="tc-equipment-doll__label">${esc(cfg.label)}</span>`
                : ''
            return `<button type="button" class="tc-equipment-doll__slot${filledClass}${selectedClass}"`
                + ` data-id="${esc(cfg.id)}"`
                + ` style="left:${cfg.x}%;top:${cfg.y}%"`
                + ` aria-pressed="${isSelected ? 'true' : 'false'}"`
                + ` aria-label="${esc(accLabel)}">`
                + `<span class="tc-equipment-doll__tile">${this._slotBody(item)}</span>`
                + labelMarkup
                + `</button>`
        }).join('')

        this.setAttribute('role', 'group')
        if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Equipment')

        this.innerHTML = `<div class="tc-equipment-doll__canvas">${figureMarkup}${slotsHTML}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EquipmentDoll
    }
}

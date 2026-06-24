import { isImageSrc } from './internal/image'
import { esc } from './internal/esc'
// Re-uses the canonical InventoryItem owned by tc-item-slot so the same data
// drives both ports. The grid fallback only renders id/name/icon/qty (rarity/
// cooldown/lock are fantasy chrome owned by tc-item-slot when that primitive is
// present); the extra optional fields are simply ignored here.
import type { InventoryItem } from './ItemSlot'

const TAG_NAME = 'tc-inventory-grid'

export interface InventoryGridEventMap {
    'tc-select': CustomEvent<{ item: InventoryItem | null; index: number }>
}

// An icon that looks like an image source renders as an <img>; otherwise the
// string is a short glyph/initials label (the design system forbids emoji-as-
// icon, so free-form data glyphs stay content). Matches tc-hotbar's fallback so
// both game ports read the same item data identically.

export class InventoryGrid extends HTMLElement {
    private _initialised = false
    private _items: (InventoryItem | null)[] = []

    /** Optional callback fired alongside the tc-select CustomEvent. */
    onSelect: ((detail: { item: InventoryItem | null; index: number }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['columns', 'slot-size', 'selected-id']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'grid')
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // --- Public API (mirrors gc-inventory-grid) ---

    get items(): (InventoryItem | null)[] {
        return this._items.slice()
    }
    set items(value: (InventoryItem | null)[]) {
        this._items = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
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

    private emit(item: InventoryItem | null, index: number): void {
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                detail: { item, index },
                bubbles: true,
                composed: true,
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect({ item, index })
    }

    private _anchorFor(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof HTMLElement)) return null
        const anchor = target.closest<HTMLElement>('.tc-inventory-grid__slot')
        if (!anchor || !this.contains(anchor)) return null
        return anchor
    }

    private _select(anchor: HTMLElement): void {
        const index = parseInt(anchor.dataset.index ?? '', 10)
        if (Number.isNaN(index)) return
        const item = this._items[index] ?? null
        if (item?.id) this.selectedId = item.id
        this.emit(item, index)
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

    // Fallback slot interior, shown until tc-item-slot is registered. Once that
    // primitive upgrades, its own render() replaces these children and the
    // :not(:defined) frame rules in the SCSS stop matching — it owns the slot.
    private _slotFallback(item: InventoryItem | null): string {
        if (!item) return ''
        const icon = item.icon
        const name = item.name ?? item.id
        let glyph: string
        if (icon && isImageSrc(icon)) {
            glyph = `<img class="tc-inventory-grid__glyph" src="${esc(icon)}" alt="" />`
        } else {
            const text = icon || (name ? name.charAt(0).toUpperCase() : '?')
            glyph = `<span class="tc-inventory-grid__glyph" aria-hidden="true">${esc(text)}</span>`
        }
        if (item.qty != null && item.qty > 1) {
            glyph += `<span class="tc-inventory-grid__qty">${esc(item.qty.toLocaleString())}</span>`
        }
        return glyph
    }

    private render(): void {
        const size = this.slotSize
        const cols = this.columns
        this.style.setProperty('--bs-inventory-grid-cols', String(cols))
        this.style.setProperty('--bs-inventory-grid-cell', `${size}px`)

        const selected = this.selectedId
        const cellsHTML = this._items
            .map((slotItem, index) => {
                const item = slotItem ?? null
                const id = item?.id ?? ''
                const isSelected = !!id && id === selected
                const label = item?.name || item?.id || `Slot ${index + 1}`
                const classes =
                    'tc-inventory-grid__slot' +
                    (item ? '' : ' tc-inventory-grid__slot--empty') +
                    (isSelected ? ' tc-inventory-grid__slot--selected' : '')
                return `<tc-item-slot
                class="${classes}"
                data-index="${index}"
                role="gridcell"
                tabindex="0"
                aria-pressed="${isSelected ? 'true' : 'false'}"
                aria-label="${esc(label)}"
                size="${size}"
                ${isSelected ? 'selected' : ''}
            >${this._slotFallback(item)}</tc-item-slot>`
            })
            .join('')

        this.innerHTML = `<div class="tc-inventory-grid__cells">${cellsHTML}</div>`

        // Forward each item to its composed tc-item-slot, so the primitive can
        // render the rich interior once it is registered (mirrors gc-inventory-grid).
        const slotEls = this.querySelectorAll<HTMLElement>('.tc-inventory-grid__slot')
        slotEls.forEach((el, index) => {
            ;(el as unknown as { item: InventoryItem | null }).item = this._items[index] ?? null
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InventoryGrid
    }
}

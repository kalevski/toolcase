const TAG_NAME = 'tc-hotbar'

// An item/ability occupying a hotbar slot. Mirrors the game-components
// InventoryItem shape so the same data drives the composed tc-item-slot; the
// design-system port only renders id/name/icon/qty for its standalone fallback
// (rarity/cooldown/lock are fantasy chrome owned by tc-item-slot when present).
export interface InventoryItem {
    id: string
    name?: string
    icon?: string
    qty?: number
    [key: string]: unknown
}

export interface HotbarSlot {
    item?: InventoryItem | null
    hotkey?: string
}

export interface HotbarEventMap {
    'tc-select': CustomEvent<{ item: InventoryItem | null, index: number }>
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

// An icon that looks like an image source renders as an <img>; otherwise the
// string is a short glyph/initials label (the design system forbids emoji-as-
// icon, so free-form data glyphs stay content). Matches the tc-equipment-doll
// fallback so both game ports read the same item data identically.
function isImageSrc(value: string): boolean {
    return /^(https?:|\/|\.\/|\.\.\/|data:image\/)/.test(value) || /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(value)
}

export class Hotbar extends HTMLElement {
    private _initialised = false
    private _slots: HotbarSlot[] = []

    /** Optional callback fired alongside the tc-select CustomEvent. */
    onSelect: ((detail: { item: InventoryItem | null, index: number }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['slot-size', 'selected-id']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'toolbar')
            if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Hotbar')
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

    // --- Public API (mirrors gc-hotbar) ---

    get slots(): HotbarSlot[] {
        return this._slots.slice()
    }
    set slots(value: HotbarSlot[]) {
        this._slots = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
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
        this.dispatchEvent(new CustomEvent('tc-select', {
            detail: { item, index },
            bubbles: true,
            composed: true,
        }))
        if (typeof this.onSelect === 'function') this.onSelect({ item, index })
    }

    private _anchorFor(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof HTMLElement)) return null
        const anchor = target.closest<HTMLElement>('.tc-hotbar__slot')
        if (!anchor || !this.contains(anchor)) return null
        return anchor
    }

    private _select(anchor: HTMLElement): void {
        const index = parseInt(anchor.dataset.index ?? '', 10)
        if (Number.isNaN(index)) return
        const item = this._slots[index]?.item ?? null
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
    private _slotFallback(item: InventoryItem | null, hotkey: string): string {
        let glyph = ''
        if (item) {
            const icon = item.icon
            const name = item.name ?? item.id
            if (icon && isImageSrc(icon)) {
                glyph = `<img class="tc-hotbar__glyph" src="${esc(icon)}" alt="" />`
            } else {
                const text = icon || (name ? name.charAt(0).toUpperCase() : '?')
                glyph = `<span class="tc-hotbar__glyph" aria-hidden="true">${esc(text)}</span>`
            }
            if (item.qty != null && item.qty > 1) {
                glyph += `<span class="tc-hotbar__qty">${esc(item.qty.toLocaleString())}</span>`
            }
        }
        const hotkeyMarkup = hotkey
            ? `<span class="tc-hotbar__hotkey" aria-hidden="true">${esc(hotkey)}</span>`
            : ''
        return glyph + hotkeyMarkup
    }

    private render(): void {
        const size = this.slotSize
        this.style.setProperty('--bs-hotbar-slot-size', `${size}px`)

        const selected = this.selectedId
        const cellsHTML = this._slots.map((slot, index) => {
            const item = slot.item ?? null
            const id = item?.id ?? ''
            const isSelected = !!id && id === selected
            const hotkey = slot.hotkey ?? ''
            const label = item?.name || item?.id || `Slot ${index + 1}`
            const classes = 'tc-hotbar__slot'
                + (item ? '' : ' tc-hotbar__slot--empty')
                + (isSelected ? ' tc-hotbar__slot--selected' : '')
            return `<tc-item-slot
                class="${classes}"
                data-index="${index}"
                role="button"
                tabindex="0"
                aria-pressed="${isSelected ? 'true' : 'false'}"
                aria-label="${esc(label)}"
                ${hotkey ? `aria-keyshortcuts="${esc(hotkey)}"` : ''}
                size="${size}"
                ${isSelected ? 'selected' : ''}
                ${hotkey ? `hotkey="${esc(hotkey)}"` : ''}
            >${this._slotFallback(item, hotkey)}</tc-item-slot>`
        }).join('')

        this.innerHTML = `<div class="tc-hotbar__row">${cellsHTML}</div>`

        // Forward each item to its composed tc-item-slot, so the primitive can
        // render the rich interior once it is registered (mirrors gc-hotbar).
        const slotEls = this.querySelectorAll<HTMLElement>('.tc-hotbar__slot')
        slotEls.forEach((el, index) => {
            ;(el as unknown as { item: InventoryItem | null }).item = this._slots[index]?.item ?? null
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Hotbar
    }
}

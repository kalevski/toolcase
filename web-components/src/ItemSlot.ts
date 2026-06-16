import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-item-slot'

// Item rarity tiers — mirrors the game-components ItemRarity union so the same
// data drives the slot. In the design system rarity is conveyed by a single
// muted border accent (sanctioned status tokens), never a gilded frame or glow.
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
const RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

// The item occupying the slot. Mirrors the game-components InventoryItem shape so
// the same data flows through both ports; the design-system port renders all of
// id/name/icon/rarity/qty/cooldown/equipped/locked, but as flat slate chrome.
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
    'tc-click': CustomEvent<{ item: InventoryItem | null }>
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
// icon and icon fonts for data glyphs, so free-form glyphs stay content).
// Matches the tc-hotbar / tc-inventory-grid fallback so all three game ports
// read the same item data identically.
function isImageSrc(value: string): boolean {
    return /^(https?:|\/|\.\/|\.\.\/|data:image\/)/.test(value) || /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(value)
}

// Pre-resolved lock glyph (lucide inline SVG, not the gc-* 🔒 emoji which the
// design system bans). Always rendered for locked items, so resolve once.
const lockIconHtml = icon((LucideIcons as Record<string, string>)['Lock'] ?? '', 'tc-item-slot__lock-glyph')

export class ItemSlot extends HTMLElement {
    private _item: InventoryItem | null = null
    // Tracks whether the current aria-label was set by us (from the item) rather
    // than supplied by the author / composing parent — so we may refresh or clear
    // it without ever clobbering an externally-provided label.
    private _autoLabel = false

    /** Optional callback fired alongside the tc-click CustomEvent. */
    onClick: ((detail: { item: InventoryItem | null }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected', 'size', 'hotkey']
    }

    connectedCallback(): void {
        // Standalone the slot is its own button; composed inside tc-hotbar /
        // tc-inventory-grid the parent has already set role/tabindex, so only
        // fill them in when absent (the parent owns interactivity there).
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')
        this.addEventListener('click', this._handleClick)
        this.addEventListener('keydown', this._handleKeydown)
        this.render()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._handleClick)
        this.removeEventListener('keydown', this._handleKeydown)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    // --- Public API (mirrors gc-item-slot) ---

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

    // Activation does NOT stop native-click propagation: composed inside
    // tc-hotbar / tc-inventory-grid the parent listens for the bubbling native
    // click on its own delegated handler. We additionally fire tc-click with the
    // item (the web-components rename of the gc-item-slot `click` event) so a
    // standalone slot is usable on its own. Locked items are inert.
    private _emit(): void {
        this.dispatchEvent(new CustomEvent('tc-click', {
            detail: { item: this._item },
            bubbles: true,
            composed: true,
        }))
        if (typeof this.onClick === 'function') this.onClick({ item: this._item })
    }

    private _handleClick = (): void => {
        if (this._item?.locked) return
        this._emit()
    }

    private _handleKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        if (this._item?.locked) return
        event.preventDefault()
        this._emit()
    }

    // An <img> source or a short initials/glyph label — same rule the sibling
    // game ports use so item data renders identically across them.
    private _renderGlyph(iconStr: string, name: string): string {
        if (!iconStr && !name) return ''
        if (iconStr && isImageSrc(iconStr)) {
            return `<img class="tc-item-slot__glyph" src="${esc(iconStr)}" alt="" />`
        }
        const text = iconStr || (name ? name.charAt(0).toUpperCase() : '?')
        return `<span class="tc-item-slot__glyph" aria-hidden="true">${esc(text)}</span>`
    }

    private render(): void {
        const size = this.size
        this.style.setProperty('--bs-item-slot-size', `${size}px`)
        this.style.setProperty('--bs-item-slot-glyph-size', `${Math.round(size * 0.42)}px`)

        const item = this._item
        const rarity: ItemRarity = item?.rarity && RARITIES.includes(item.rarity) ? item.rarity : 'common'
        // Reflect rarity onto the host so the SCSS (and themes / consumers) can
        // target a specific tier without a JS read — matches gc-item-slot.
        if (item) this.dataset.rarity = rarity
        else delete this.dataset.rarity

        const isEmpty = !item
        const isLocked = !!item?.locked

        // Component-owned classes via classList so author / parent classes
        // (e.g. tc-hotbar__slot) survive the re-render.
        this.classList.add('tc-item-slot')
        this.classList.toggle('tc-item-slot--empty', isEmpty)
        this.classList.toggle('tc-item-slot--locked', isLocked)

        // Locked = inert: removed from the tab order and marked disabled.
        if (isLocked) {
            this.setAttribute('aria-disabled', 'true')
            this.setAttribute('tabindex', '-1')
        } else {
            this.removeAttribute('aria-disabled')
            if (this.getAttribute('tabindex') === '-1') this.setAttribute('tabindex', '0')
        }

        // Standalone accessible name from the item; never overrides a label the
        // author / composing parent supplied, but stays fresh as the item changes.
        if (item && (this._autoLabel || !this.hasAttribute('aria-label'))) {
            this.setAttribute('aria-label', item.name || item.id)
            this._autoLabel = true
        } else if (!item && this._autoLabel) {
            this.removeAttribute('aria-label')
            this._autoLabel = false
        }

        const glyph = item ? this._renderGlyph(item.icon ?? '', item.name ?? item.id) : ''

        const qtyMarkup = item?.qty != null && item.qty > 1
            ? `<span class="tc-item-slot__qty">${esc(item.qty.toLocaleString())}</span>`
            : ''

        const equippedMarkup = item?.equipped
            ? `<span class="tc-item-slot__equipped" aria-label="Equipped">E</span>`
            : ''

        const cdPct = item?.cooldown != null && item?.cooldownMax && item.cooldownMax > 0
            ? Math.max(0, Math.min(1, item.cooldown / item.cooldownMax))
            : null
        const cooldownMarkup = cdPct != null && cdPct > 0
            ? `<div class="tc-item-slot__cooldown" style="--bs-item-slot-cd-angle: ${cdPct * 360}deg" aria-hidden="true">`
              + `<span class="tc-item-slot__cooldown-label">${esc(String(Math.ceil(item!.cooldown!)))}</span>`
              + `</div>`
            : ''

        const lockMarkup = isLocked
            ? `<span class="tc-item-slot__lock" aria-hidden="true">${lockIconHtml}</span>`
            : ''

        const hotkey = this.hotkey
        const hotkeyMarkup = hotkey
            ? `<span class="tc-item-slot__hotkey" aria-hidden="true">${esc(hotkey)}</span>`
            : ''

        this.innerHTML = `<div class="tc-item-slot__inner">`
            + glyph
            + qtyMarkup
            + equippedMarkup
            + cooldownMarkup
            + lockMarkup
            + hotkeyMarkup
            + `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ItemSlot
    }
}

import { Check, X } from 'lucide-static'
import type { InventoryItem, ItemRarity } from './ItemSlot'
import { icon } from './icons'

const TAG_NAME = 'tc-item-tooltip'

// Rarity tiers, mirrored from tc-item-slot so the same item data flows through
// both ports. In the design system rarity is conveyed by a single colour accent
// (sanctioned status tokens) on a sharp hairline chip — never a gilded frame.
const RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
const RARITY_LABEL: Record<ItemRarity, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    mythic: 'Mythic',
}

// The item described by the tooltip. Mirrors the game-components TooltipItem
// shape (an InventoryItem plus the tooltip-only fields) so the same data drives
// both the fantasy and the design-system port.
export interface TooltipItem extends InventoryItem {
    typeLabel?: string
    flavor?: string
    stats?: { label: string; value: string | number }[]
    requirements?: { label: string; value: string | number; met?: boolean }[]
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function formatValue(v: string | number): string {
    return typeof v === 'number' ? v.toLocaleString() : v
}

// Lucide inline SVGs for the requirement met / unmet markers — colour alone must
// not carry the met/unmet signal, so a recolourable stroke icon rides alongside
// the status colour (the design system forbids unicode glyphs as icons).
const checkIconHtml = icon(Check, 'tc-item-tooltip__req-icon')
const xIconHtml = icon(X, 'tc-item-tooltip__req-icon')

// tc-item-tooltip — a hover card describing an item: an optional mono type
// micro-label, the item name, a rarity chip, a stat list, an optional
// requirements block (met / unmet), and optional flavor text. Port of the
// game-components `gc-item-tooltip`, re-skinned to the web-components design
// system — no gilded frame, no glow, no parchment fill: a sharp hairline surface
// at the overlay tier (shadow-lg, --tc-z-tooltip), slate ink, mono machine-facing
// figures, and status colour spent only on rarity and requirement markers. The
// public API mirrors the source: a single `item` JS property, no attributes, no
// events, no slots. All cosmetics flow through --bs-item-tooltip-* custom
// properties.
export class ItemTooltip extends HTMLElement {

    private _item: TooltipItem | null = null

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'tooltip')
        this.render()
    }

    // --- Public API (mirrors gc-item-tooltip) ---

    get item(): TooltipItem | null {
        return this._item
    }
    set item(value: TooltipItem | null) {
        this._item = value && typeof value === 'object' ? value : null
        if (this.isConnected) this.render()
    }

    private renderStats(item: TooltipItem): string {
        const rows = (item.stats ?? []).map(s => `
            <div class="tc-item-tooltip__stat">
                <span class="tc-item-tooltip__stat-label">${esc(s.label)}</span>
                <span class="tc-item-tooltip__stat-value">${esc(formatValue(s.value))}</span>
            </div>
        `).join('')
        return rows ? `<div class="tc-item-tooltip__stats">${rows}</div>` : ''
    }

    private renderReqs(item: TooltipItem): string {
        const rows = (item.requirements ?? []).map(r => {
            // Explicit booleans drive the status colour + marker icon; an absent
            // `met` leaves the row neutral (a plain requirement listing).
            const mod = r.met === false ? ' tc-item-tooltip__req--unmet'
                : r.met === true ? ' tc-item-tooltip__req--met' : ''
            const marker = r.met === false ? xIconHtml
                : r.met === true ? checkIconHtml : ''
            return `
                <div class="tc-item-tooltip__req${mod}">
                    <span class="tc-item-tooltip__req-label">${esc(r.label)}</span>
                    <span class="tc-item-tooltip__req-value">${marker}${esc(formatValue(r.value))}</span>
                </div>
            `
        }).join('')
        if (!rows) return ''
        return `<div class="tc-item-tooltip__reqs">
            <tc-eyebrow class="tc-item-tooltip__reqs-label">Requirements</tc-eyebrow>
            ${rows}
        </div>`
    }

    private render(): void {
        const item = this._item
        if (!item) {
            // No item: mark empty (the SCSS hides the host so no bare box shows),
            // drop the rarity reflection, and clear the content. Mirrors the gc
            // source's empty branch.
            this.dataset.empty = ''
            this.removeAttribute('data-rarity')
            this.innerHTML = ''
            return
        }
        delete this.dataset.empty

        const rarity: ItemRarity = item.rarity && RARITIES.includes(item.rarity) ? item.rarity : 'common'
        // Reflect rarity onto the host so the SCSS (and themes / consumers) can
        // target a specific tier without a JS read — matches gc-item-tooltip.
        this.dataset.rarity = rarity

        const typeMarkup = item.typeLabel
            ? `<tc-eyebrow class="tc-item-tooltip__type">${esc(item.typeLabel)}</tc-eyebrow>`
            : ''
        const nameMarkup = `<div class="tc-item-tooltip__name">${esc(item.name ?? '')}</div>`
        const rarityMarkup = `<span class="tc-item-tooltip__rarity" data-rarity="${rarity}">${esc(RARITY_LABEL[rarity])}</span>`
        const flavorMarkup = item.flavor
            ? `<div class="tc-item-tooltip__flavor">${esc(item.flavor)}</div>`
            : ''

        this.innerHTML = `
            <div class="tc-item-tooltip__header">
                ${typeMarkup}
                ${nameMarkup}
                ${rarityMarkup}
            </div>
            ${this.renderStats(item)}
            ${this.renderReqs(item)}
            ${flavorMarkup}
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ItemTooltip
    }
}

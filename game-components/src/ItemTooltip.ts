import type { InventoryItem } from './ItemSlot'
import type { ItemRarity } from './RarityChip'

const TAG_NAME = 'gc-item-tooltip'

export interface TooltipItem extends InventoryItem {
    typeLabel?: string
    flavor?: string
    stats?: { label: string, value: string | number }[]
    requirements?: { label: string, value: string | number, met?: boolean }[]
}

export class ItemTooltip extends HTMLElement {

    static get observedAttributes(): string[] {
        return []
    }

    private _item: TooltipItem | null = null

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'tooltip')
        this.render()
    }

    get item(): TooltipItem | null {
        return this._item
    }
    set item(value: TooltipItem | null) {
        this._item = value && typeof value === 'object' ? value : null
        if (this.isConnected) this.render()
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private formatValue(v: string | number): string {
        if (typeof v === 'number') return v.toLocaleString()
        return v
    }

    private render(): void {
        const item = this._item
        if (!item) {
            this.dataset.empty = ''
            this.removeAttribute('data-rarity')
            this.innerHTML = ''
            return
        }
        delete this.dataset.empty
        const rarity: ItemRarity = item.rarity ?? 'common'
        this.dataset.rarity = rarity

        const typeMarkup = item.typeLabel
            ? `<gc-eyebrow class="gc-item-tooltip-type">${this.escape(item.typeLabel)}</gc-eyebrow>`
            : ''
        const nameMarkup = `<div class="gc-item-tooltip-name">${this.escape(item.name ?? '')}</div>`
        const rarityChip = `<gc-rarity-chip class="gc-item-tooltip-rarity" rarity="${rarity}"></gc-rarity-chip>`
        const stats = (item.stats ?? []).map(s => `
            <div class="gc-item-tooltip-stat">
                <span class="gc-item-tooltip-stat-label">${this.escape(s.label)}</span>
                <span class="gc-item-tooltip-stat-value">${this.escape(this.formatValue(s.value))}</span>
            </div>
        `).join('')
        const statsBlock = stats
            ? `<div class="gc-item-tooltip-stats">${stats}</div>`
            : ''
        const reqs = (item.requirements ?? []).map(r => {
            const cls = r.met === false ? ' is-unmet' : r.met === true ? ' is-met' : ''
            return `
                <div class="gc-item-tooltip-req${cls}">
                    <span class="gc-item-tooltip-req-label">${this.escape(r.label)}</span>
                    <span class="gc-item-tooltip-req-value">${this.escape(this.formatValue(r.value))}</span>
                </div>
            `
        }).join('')
        const reqsBlock = reqs
            ? `<div class="gc-item-tooltip-reqs">${reqs}</div>`
            : ''
        const flavorMarkup = item.flavor
            ? `<div class="gc-item-tooltip-flavor">${this.escape(item.flavor)}</div>`
            : ''

        this.innerHTML = `
            <div class="gc-item-tooltip-header">
                ${typeMarkup}
                ${nameMarkup}
                ${rarityChip}
            </div>
            ${statsBlock}
            ${reqsBlock}
            ${flavorMarkup}
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ItemTooltip)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ItemTooltip
    }
}

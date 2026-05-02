import type { InventoryItem } from './ItemSlot'

const TAG_NAME = 'gc-shop-panel'

export interface ShopItem {
    item: InventoryItem
    price: number
    discount?: number
    soldOut?: boolean
}

export interface ShopPanelEventMap {
    buy: CustomEvent<{ id: string }>
    sell: CustomEvent<{ id: string }>
}

export class ShopPanel extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['sell-mode', 'currency', 'currency-icon']
    }

    private _items: ShopItem[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get sellMode(): boolean {
        return this.hasAttribute('sell-mode')
    }
    set sellMode(v: boolean) {
        if (v) this.setAttribute('sell-mode', '')
        else this.removeAttribute('sell-mode')
    }

    get currency(): number | null {
        const raw = this.getAttribute('currency')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set currency(v: number | null) {
        if (v == null) this.removeAttribute('currency')
        else this.setAttribute('currency', String(v))
    }

    get currencyIcon(): string {
        return this.getAttribute('currency-icon') ?? '◆'
    }
    set currencyIcon(v: string) {
        if (v) this.setAttribute('currency-icon', v)
        else this.removeAttribute('currency-icon')
    }

    get items(): ShopItem[] {
        return this._items.slice()
    }
    set items(value: ShopItem[]) {
        this._items = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
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
        const sellMode = this.sellMode
        const currency = this.currency
        const currencyIcon = this.currencyIcon
        const action = sellMode ? 'sell' : 'buy'
        const actionLabel = sellMode ? 'Sell' : 'Buy'

        const headerCurrency = currency != null
            ? `<div class="gc-shop-panel-currency">${this.escape(currencyIcon)} <span class="gc-shop-panel-currency-value">${currency.toLocaleString()}</span></div>`
            : ''

        const rowsMarkup = this._items.map((s) => {
            const finalPrice = s.discount && s.discount > 0
                ? Math.round(s.price * (1 - s.discount))
                : s.price
            const cantAfford = !sellMode && currency != null && currency < finalPrice
            const disabled = !!s.soldOut || cantAfford
            const cls = `gc-shop-panel-row${s.soldOut ? ' is-sold-out' : ''}${cantAfford ? ' is-unaffordable' : ''}`
            const icon = s.item.icon || '◆'
            const name = s.item.name ?? s.item.id
            const discountMarkup = (s.discount && s.discount > 0)
                ? `<span class="gc-shop-panel-discount">-${Math.round(s.discount * 100)}%</span>`
                : ''
            const priceMarkup = `
                <span class="gc-shop-panel-price">
                    ${this.escape(currencyIcon)}
                    ${s.discount && s.discount > 0 ? `<span class="gc-shop-panel-price-old">${s.price.toLocaleString()}</span>` : ''}
                    <span class="gc-shop-panel-price-value">${finalPrice.toLocaleString()}</span>
                </span>
            `
            const btnLabel = s.soldOut ? 'Sold' : actionLabel
            return `<div class="${cls}" data-id="${this.escape(s.item.id)}">
                <span class="gc-shop-panel-row-icon">${this.escape(icon)}</span>
                <span class="gc-shop-panel-row-name">${this.escape(name)}</span>
                ${discountMarkup}
                ${priceMarkup}
                <button type="button" class="gc-shop-panel-row-action" data-action="${action}" ${disabled ? 'disabled' : ''}>${btnLabel}</button>
            </div>`
        }).join('')

        this.innerHTML = `
            <div class="gc-shop-panel-header">
                <gc-eyebrow class="gc-shop-panel-eyebrow">${sellMode ? 'Sell' : 'Buy'}</gc-eyebrow>
                ${headerCurrency}
            </div>
            <div class="gc-shop-panel-rows">${rowsMarkup}</div>
        `

        this.querySelectorAll<HTMLButtonElement>('.gc-shop-panel-row-action').forEach((el) => {
            el.addEventListener('click', () => {
                const row = el.closest('.gc-shop-panel-row') as HTMLElement | null
                if (!row) return
                const id = row.dataset.id || ''
                const a = el.dataset.action || 'buy'
                this.emit(a, { id })
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ShopPanel)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ShopPanel
    }
}

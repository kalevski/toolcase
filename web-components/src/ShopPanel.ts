import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-shop-panel'

export interface ShopInventoryItem {
    id: string
    name?: string
    icon?: string
}

export interface ShopItem {
    item: ShopInventoryItem
    price: number
    discount?: number
    soldOut?: boolean
}

export class ShopPanel extends HTMLElement {
    private _initialised = false
    private _items: ShopItem[] = []

    onBuy: ((id: string) => void) | null = null
    onSell: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['sell-mode', 'currency', 'currency-icon']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        if (this._initialised) this.render()
    }

    private render(): void {
        const sellMode = this.sellMode
        const currency = this.currency
        const currencyIcon = this.currencyIcon
        const action = sellMode ? 'sell' : 'buy'
        const actionLabel = sellMode ? 'Sell' : 'Buy'

        const currencyHtml =
            currency != null
                ? `<span class="tc-shop-panel-currency">
                <span class="tc-shop-panel-currency-icon" aria-hidden="true">${esc(currencyIcon)}</span>
                <span class="tc-shop-panel-currency-value">${currency.toLocaleString()}</span>
            </span>`
                : ''

        const rowsHtml = this._items
            .map((s) => {
                const finalPrice =
                    s.discount && s.discount > 0 ? Math.round(s.price * (1 - s.discount)) : s.price
                const cantAfford = !sellMode && currency != null && currency < finalPrice
                const disabled = !!s.soldOut || cantAfford
                const rowCls = [
                    'tc-shop-panel-row',
                    s.soldOut ? 'tc-shop-panel-row--sold-out' : '',
                    cantAfford ? 'tc-shop-panel-row--unaffordable' : '',
                ]
                    .filter(Boolean)
                    .join(' ')
                const icon = s.item.icon ?? '◆'
                const name = s.item.name ?? s.item.id
                const discountHtml =
                    s.discount && s.discount > 0
                        ? `<span class="tc-shop-panel-discount" aria-label="${Math.round(s.discount * 100)}% off">-${Math.round(s.discount * 100)}%</span>`
                        : ''
                const oldPriceHtml =
                    s.discount && s.discount > 0
                        ? `<span class="tc-shop-panel-price-old">${s.price.toLocaleString()}</span>`
                        : ''
                const priceHtml = `<span class="tc-shop-panel-price">
                <span class="tc-shop-panel-price-icon" aria-hidden="true">${esc(currencyIcon)}</span>
                ${oldPriceHtml}
                <span class="tc-shop-panel-price-value">${finalPrice.toLocaleString()}</span>
            </span>`
                const btnLabel = s.soldOut ? 'Sold' : actionLabel
                return `<div class="${rowCls}" data-id="${esc(s.item.id)}">
                <span class="tc-shop-panel-row-icon" aria-hidden="true">${esc(icon)}</span>
                <span class="tc-shop-panel-row-name">${esc(name)}</span>
                ${discountHtml}
                ${priceHtml}
                <button type="button" class="tc-shop-panel-row-btn" data-action="${action}"${disabled ? ' disabled aria-disabled="true"' : ''}>${esc(btnLabel)}</button>
            </div>`
            })
            .join('')

        const emptyHtml =
            this._items.length === 0 ? `<p class="tc-shop-panel-empty">No items available</p>` : ''

        const modeLabel = sellMode ? 'Sell Items' : 'Buy Items'

        patchHtml(
            this,
            `<div class="tc-shop-panel">
            <div class="tc-shop-panel-header">
                <span class="tc-shop-panel-mode-label">${esc(modeLabel)}</span>
                ${currencyHtml}
            </div>
            <div class="tc-shop-panel-rows">${rowsHtml}${emptyHtml}</div>
        </div>`,
        )

        const container = this.querySelector<HTMLElement>('.tc-shop-panel')
        if (container) {
            bindOnce(container, 'click', (e: Event) => {
                const btn = (e.target as Element).closest<HTMLButtonElement>('[data-action]')
                if (!btn || btn.disabled) return
                const row = btn.closest<HTMLElement>('.tc-shop-panel-row')
                if (!row) return
                const id = row.dataset.id ?? ''
                const isSell = btn.dataset.action === 'sell'
                const eventName = isSell ? 'tc-sell' : 'tc-buy'
                this.dispatchEvent(
                    new CustomEvent(eventName, {
                        bubbles: true,
                        composed: true,
                        detail: { id },
                    }),
                )
                if (isSell) {
                    if (typeof this.onSell === 'function') this.onSell(id)
                } else {
                    if (typeof this.onBuy === 'function') this.onBuy(id)
                }
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ShopPanel
    }
}

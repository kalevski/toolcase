import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ShopPanel.styles.js'
import './ItemSlot.js'
import type { InventoryItem } from './ItemSlot.js'

export interface ShopItem { item: InventoryItem; price: number; discount?: number; soldOut?: boolean }

@customElement('gc-shop-panel')
export class ShopPanel extends GameElement {
    static styles = styles

    @property({ type: Array }) items: ShopItem[] = []
    @property({ type: Boolean, attribute: 'sell-mode' }) sellMode = false
    @property({ type: Number }) currency: number | null = null
    @property({ attribute: 'currency-icon' }) currencyIcon = '💰'

    render() {
        return html`
            ${this.currency !== null ? html`<div class="head">${this.currencyIcon}<strong>${this.currency.toLocaleString()}</strong></div>` : nothing}
            <div class="grid">${this.items.map((entry) => {
                const price = entry.discount ? Math.floor(entry.price * (1 - entry.discount)) : entry.price
                return html`<div class="card">
                    <div class="row">
                        <gc-item-slot .item=${entry.item} size="40"></gc-item-slot>
                        <div style="flex:1">
                            <div class="name">${entry.item.name ?? entry.item.id}</div>
                            <div class="price">${this.currencyIcon} ${price.toLocaleString()}${entry.discount ? html` <span style="color:var(--gc-success)">(-${Math.round(entry.discount * 100)}%)</span>` : nothing}</div>
                        </div>
                    </div>
                    <button class="btn" ?disabled=${entry.soldOut} @click=${() => this.emit(this.sellMode ? 'sell' : 'buy', { id: entry.item.id })}>
                        ${entry.soldOut ? 'Sold Out' : (this.sellMode ? 'Sell' : 'Buy')}
                    </button>
                </div>`
            })}</div>`
    }
}

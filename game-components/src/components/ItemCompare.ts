import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ItemCompare.styles.js'
import './ItemTooltip.js'
import type { InventoryItem } from './ItemSlot.js'

@customElement('gc-item-compare')
export class ItemCompare extends GameElement {
    static styles = styles

    @property({ type: Object }) current: InventoryItem | null = null
    @property({ type: Object }) candidate: InventoryItem | null = null

    render() {
        return html`
            ${this.current ? html`<gc-item-tooltip .item=${this.current}></gc-item-tooltip>` : html`<div class="empty">No equipped item</div>`}
            <div class="arrow">↔</div>
            <gc-item-tooltip .item=${this.candidate}></gc-item-tooltip>`
    }
}

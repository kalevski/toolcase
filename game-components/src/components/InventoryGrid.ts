import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/InventoryGrid.scss'
import './ItemSlot.js'
import type { InventoryItem } from './ItemSlot.js'

@customElement('gc-inventory-grid')
export class InventoryGrid extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) items: Array<InventoryItem | null> = []
    @property({ type: Number }) columns = 8
    @property({ type: Number, attribute: 'slot-size' }) slotSize = 56
    @property({ attribute: 'selected-id' }) selectedId = ''

    render() {
        return html`<style>:host { --gc-cols: ${this.columns}; --gc-slot: ${this.slotSize}px; }</style>
            ${this.items.map((item, i) => html`<gc-item-slot
                .item=${item}
                .size=${this.slotSize}
                ?selected=${item?.id === this.selectedId}
                @click=${(event: CustomEvent) => this.emit('select', { ...event.detail, index: i })}>
            </gc-item-slot>`)}`
    }
}

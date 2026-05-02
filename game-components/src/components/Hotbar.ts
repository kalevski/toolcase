import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import './ItemSlot.js'
import type { InventoryItem } from './ItemSlot.js'
import stylesText from '../../style/Hotbar.scss'

export interface HotbarSlot {
    item?: InventoryItem | null
    hotkey?: string
}

@customElement('gc-hotbar')
export class Hotbar extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) slots: HotbarSlot[] = []
    @property({ type: Number, attribute: 'slot-size' }) slotSize = 52
    @property({ attribute: 'selected-id' }) selectedId = ''

    render() {
        return html`<div class="bar">
            ${this.slots.map((slot, i) => html`<gc-item-slot
                .item=${slot.item ?? null}
                .size=${this.slotSize}
                .hotkey=${slot.hotkey ?? ''}
                ?selected=${slot.item?.id === this.selectedId}
                @click=${(event: CustomEvent) => this.emit('select', { ...event.detail, index: i })}>
            </gc-item-slot>`)}
        </div>`
    }
}

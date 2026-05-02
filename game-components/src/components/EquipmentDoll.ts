import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/EquipmentDoll.scss'
import './ItemSlot.js'
import type { InventoryItem } from './ItemSlot.js'

export interface EquipmentSlotConfig {
    id: string
    label?: string
    item?: InventoryItem | null
    x: number
    y: number
}

@customElement('gc-equipment-doll')
export class EquipmentDoll extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) slots: EquipmentSlotConfig[] = []
    @property() silhouette = '👤'
    @property({ type: Number }) width = 280
    @property({ type: Number }) height = 380
    @property({ type: Number, attribute: 'slot-size' }) slotSize = 48
    @property({ attribute: 'selected-id' }) selectedId = ''

    render() {
        return html`<style>:host { --gc-width: ${this.width}px; --gc-height: ${this.height}px; }</style>
            <div class="silhouette">${this.silhouette}</div>
            ${this.slots.map((s) => html`<div class="slot" style=${`left: ${s.x}%; top: ${s.y}%`}
                @click=${() => this.emit('select', { id: s.id })}>
                <gc-item-slot .item=${s.item ?? null} .size=${this.slotSize} ?selected=${s.id === this.selectedId}></gc-item-slot>
                ${s.label ? html`<div class="label">${s.label}</div>` : nothing}
            </div>`)}`
    }
}

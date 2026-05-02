import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement, type ItemRarity } from '../base.js'
import stylesText from '../../style/ItemSlot.scss'

export interface InventoryItem {
    id: string
    name?: string
    icon?: string
    qty?: number
    rarity?: ItemRarity
    locked?: boolean
    equipped?: boolean
    description?: string
    stats?: Array<{ label: string; value: string; delta?: number }>
    lore?: string
    cooldown?: number
}

@customElement('gc-item-slot')
export class ItemSlot extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Object }) item: InventoryItem | null = null
    @property({ type: Boolean }) selected = false
    @property({ type: Number }) size = 56
    @property() hotkey = ''

    render() {
        const cursor = this.item ? 'pointer' : 'default'
        const rarity = this.item?.rarity ?? ''
        return html`<style>:host { --gc-size: ${this.size}px; --gc-cursor: ${cursor}; }</style>
            <div class="slot ${rarity ? `r-${rarity}` : ''} ${this.selected ? 'selected' : ''} ${!this.item ? 'is-empty' : ''}" @click=${() => this.item && this.emit('click', { item: this.item })}>
                ${this.hotkey ? html`<span class="hotkey">${this.hotkey}</span>` : nothing}
                ${this.item?.icon ?? ''}
                ${this.item?.equipped ? html`<span class="equipped">E</span>` : nothing}
                ${this.item?.qty && this.item.qty > 1 ? html`<span class="qty">${this.item.qty}</span>` : nothing}
                ${this.item?.cooldown !== undefined && this.item.cooldown < 1 ? html`<div class="cooldown" style="background: conic-gradient(from -90deg, rgba(0,0,0,0.75) ${(1 - this.item.cooldown) * 360}deg, transparent 0deg);">${Math.ceil(this.item.cooldown * 10)}</div>` : nothing}
                ${this.item?.locked ? html`<div class="locked">⚿</div>` : nothing}
            </div>`
    }
}

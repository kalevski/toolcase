import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement, rarityVar, type ItemRarity } from '../base.js'
import { styles } from '../styles/ItemSlot.styles.js'

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
    static styles = styles

    @property({ type: Object }) item: InventoryItem | null = null
    @property({ type: Boolean }) selected = false
    @property({ type: Number }) size = 56

    render() {
        const color = this.item?.rarity ? rarityVar(this.item.rarity) : 'var(--gc-border)'
        const cursor = this.item ? 'pointer' : 'default'
        return html`<style>:host { --gc-size: ${this.size}px; --gc-color: ${color}; --gc-cursor: ${cursor}; }</style>
            <div class="slot ${this.selected ? 'selected' : ''}" @click=${() => this.item && this.emit('click', { item: this.item })}>
                ${this.item?.icon ?? ''}
                ${this.item?.equipped ? html`<span class="equipped">E</span>` : nothing}
                ${this.item?.locked ? html`<span class="locked">🔒</span>` : nothing}
                ${this.item?.qty && this.item.qty > 1 ? html`<span class="qty">${this.item.qty}</span>` : nothing}
                ${this.item?.cooldown !== undefined && this.item.cooldown < 1 ? html`<div class="cooldown" style="background: conic-gradient(rgba(0,0,0,0.5) ${(1 - this.item.cooldown) * 360}deg, transparent 0deg);"></div>` : nothing}
            </div>`
    }
}

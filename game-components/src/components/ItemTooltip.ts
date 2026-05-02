import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement, rarityVar } from '../base.js'
import { styles } from '../styles/ItemTooltip.styles.js'
import type { InventoryItem } from './ItemSlot.js'

@customElement('gc-item-tooltip')
export class ItemTooltip extends GameElement {
    static styles = styles

    @property({ type: Object }) item: InventoryItem | null = null

    render() {
        if (!this.item) return nothing
        const color = rarityVar(this.item.rarity)
        return html`<style>:host { --gc-color: ${color}; }</style>
            <div class="name">${this.item.name ?? this.item.id}</div>
            ${this.item.rarity ? html`<div class="rarity">${this.item.rarity}</div>` : nothing}
            ${this.item.description ? html`<div>${this.item.description}</div>` : nothing}
            ${this.item.stats ? html`<ul>${this.item.stats.map((s) => html`<li>
                <span style="opacity:0.7">${s.label}</span>
                <span>${s.value}${s.delta !== undefined ? html`<span class=${s.delta > 0 ? 'delta-up' : 'delta-down'}>${s.delta > 0 ? '+' : ''}${s.delta}</span>` : nothing}</span>
            </li>`)}</ul>` : nothing}
            ${this.item.lore ? html`<div class="lore">${this.item.lore}</div>` : nothing}`
    }
}

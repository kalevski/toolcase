import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement, rarityVar } from '../base.js'
import stylesText from '../../style/ItemTooltip.scss'
import type { InventoryItem } from './ItemSlot.js'

const GLOW: Record<string, string> = {
    common: 'rgba(156, 148, 137, 0.2)',
    uncommon: 'rgba(95, 168, 74, 0.3)',
    rare: 'rgba(74, 127, 207, 0.3)',
    epic: 'rgba(164, 77, 208, 0.35)',
    legendary: 'rgba(232, 162, 58, 0.35)',
    mythic: 'rgba(224, 77, 106, 0.4)'
}

@customElement('gc-item-tooltip')
export class ItemTooltip extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Object }) item: InventoryItem | null = null

    render() {
        if (!this.item) return nothing
        const color = rarityVar(this.item.rarity)
        const glow = GLOW[this.item.rarity ?? 'common']
        return html`<style>:host { --gc-color: ${color}; --gc-glow: ${glow}; }</style>
            <div class="name">${this.item.name ?? this.item.id}</div>
            ${this.item.rarity ? html`<div class="rarity">${this.item.rarity}</div>` : nothing}
            <div class="divider"><div class="diamond"></div></div>
            ${this.item.description ? html`<div class="description">${this.item.description}</div>` : nothing}
            ${this.item.stats ? html`<ul>${this.item.stats.map((s) => html`<li>
                <span class="stat-label">${s.label}</span>
                <span class="stat-value">${s.value}${s.delta !== undefined ? html`<span class=${s.delta > 0 ? 'delta-up' : 'delta-down'}>${s.delta > 0 ? '+' : ''}${s.delta}</span>` : nothing}</span>
            </li>`)}</ul>` : nothing}
            ${this.item.lore ? html`<div class="lore">"${this.item.lore}"</div>` : nothing}`
    }
}

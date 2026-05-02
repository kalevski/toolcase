import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/AbilityCard.scss'

const RARITY_VARS: Record<string, string> = {
    common: 'var(--gc-rarity-common)', uncommon: 'var(--gc-rarity-uncommon)',
    rare: 'var(--gc-rarity-rare)', epic: 'var(--gc-rarity-epic)', legendary: 'var(--gc-rarity-legendary)',
}

@customElement('gc-ability-card')
export class AbilityCard extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ attribute: 'ability-name' }) abilityName = ''
    @property() icon = ''
    @property() description = ''
    @property() cooldown = ''
    @property() cost = ''
    @property() range = ''
    @property() keybind = ''
    @property() rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'rare'

    render() {
        const color = RARITY_VARS[this.rarity] ?? 'var(--gc-accent)'
        return html`<style>:host { --gc-color: ${color}; }</style>
            <div class="row">
                <div class="icon">${this.icon}</div>
                <div style="flex:1">
                    <div class="name">${this.abilityName}</div>
                    ${this.keybind ? html`<div class="keybind">${this.keybind}</div>` : nothing}
                </div>
            </div>
            ${this.description ? html`<div class="desc">${this.description}</div>` : nothing}
            <div class="meta">
                ${this.cost ? html`<span>Cost: <strong>${this.cost}</strong></span>` : nothing}
                ${this.cooldown ? html`<span>CD: <strong>${this.cooldown}</strong></span>` : nothing}
                ${this.range ? html`<span>Range: <strong>${this.range}</strong></span>` : nothing}
            </div>`
    }
}

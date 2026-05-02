import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import './Portrait.js'
import './HealthBar.js'
import './ManaBar.js'
import './StaminaBar.js'
import stylesText from '../../style/PlayerFrame.scss'

@customElement('gc-player-frame')
export class PlayerFrame extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() name = ''
    @property({ attribute: 'class-name' }) className = ''
    @property() glyph = '✦'
    @property({ type: Number }) level: number | null = null
    @property({ type: Number }) hp = 0
    @property({ type: Number, attribute: 'hp-max' }) hpMax = 100
    @property({ type: Number }) mp = 0
    @property({ type: Number, attribute: 'mp-max' }) mpMax = 100
    @property({ type: Number }) stamina = 0
    @property({ type: Number, attribute: 'stamina-max' }) staminaMax = 100
    @property({ type: Boolean, attribute: 'show-mp' }) showMp = true
    @property({ type: Boolean, attribute: 'show-stamina' }) showStamina = true

    render() {
        return html`<div class="frame">
            <gc-portrait .glyph=${this.glyph} size="56" .level=${this.level}></gc-portrait>
            <div class="info">
                <div class="header">
                    <span class="name">${this.name}</span>
                    ${this.className ? html`<span class="class">${this.className}</span>` : nothing}
                </div>
                <gc-health-bar .value=${this.hp} .max=${this.hpMax}></gc-health-bar>
                ${this.showMp ? html`<gc-mana-bar .value=${this.mp} .max=${this.mpMax}></gc-mana-bar>` : nothing}
                ${this.showStamina ? html`<gc-stamina-bar .value=${this.stamina} .max=${this.staminaMax}></gc-stamina-bar>` : nothing}
            </div>
        </div>`
    }
}

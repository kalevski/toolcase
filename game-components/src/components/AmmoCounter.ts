import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/AmmoCounter.scss'

@customElement('gc-ammo-counter')
export class AmmoCounter extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) mag = 0
    @property({ type: Number, attribute: 'mag-max' }) magMax: number | null = null
    @property({ type: Number }) reserve: number | null = null
    @property({ attribute: 'weapon-name' }) weaponName = ''
    @property({ type: Boolean }) reloading = false

    render() {
        const low = this.magMax !== null && this.mag <= this.magMax * 0.2
        const cls = ['mag', this.reloading ? 'reloading' : '', !this.reloading && low ? 'low' : ''].filter(Boolean).join(' ')
        return html`
            ${this.weaponName ? html`<div class="weapon-name">${this.weaponName}</div>` : nothing}
            <div class="row">
                <div class=${cls}>${this.reloading ? '...' : this.mag}</div>
                ${this.magMax !== null ? html`<div class="max">/ ${this.magMax}</div>` : nothing}
                ${this.reserve !== null ? html`<div class="reserve">${this.reserve}</div>` : nothing}
            </div>`
    }
}

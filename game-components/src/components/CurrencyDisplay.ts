import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/CurrencyDisplay.styles.js'

@customElement('gc-currency-display')
export class CurrencyDisplay extends GameElement {
    static styles = styles

    @property({ type: Number }) amount = 0
    @property({ attribute: 'currency-icon' }) currencyIcon = '💰'
    @property() label = ''
    @property() color = ''
    @property({ type: Number, attribute: 'font-size' }) fontSize = 16

    render() {
        return html`<style>:host { --gc-font-size: ${this.fontSize}px; ${this.color ? `--gc-color: ${this.color};` : ''} }</style>
            ${this.currencyIcon}<strong>${this.amount.toLocaleString()}</strong>${this.label ? html`<span style="opacity:0.7">${this.label}</span>` : nothing}`
    }
}

import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/CurrencyChip.scss'

@customElement('gc-currency-chip')
export class CurrencyChip extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() glyph = '◉'
    @property({ type: Number }) amount = 0
    @property() color = 'var(--fg-gold-bright)'

    render() {
        return html`<style>:host { --gc-currency-color: ${this.color}; }</style>
            <span class="chip">
                <span class="glyph">${this.glyph}</span>
                <span class="amount">${this.amount.toLocaleString()}</span>
            </span>`
    }
}

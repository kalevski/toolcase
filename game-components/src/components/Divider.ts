import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Divider.scss'

@customElement('gc-divider')
export class Divider extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Boolean, attribute: 'no-diamond' }) noDiamond = false

    render() {
        return html`<div class="divider">
            ${this.noDiamond ? nothing : html`<div class="diamond"></div>`}
        </div>`
    }
}

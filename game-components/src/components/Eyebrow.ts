import { html, css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Eyebrow.scss'

@customElement('gc-eyebrow')
export class Eyebrow extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    render() {
        return html`<span class="eyebrow"><slot></slot></span>`
    }
}

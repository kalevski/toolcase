import { html, css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Key.scss'

@customElement('gc-key')
export class Key extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    render() {
        return html`<span class="key"><slot></slot></span>`
    }
}

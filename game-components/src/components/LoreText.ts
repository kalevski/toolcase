import { html, css, unsafeCSS } from 'lit'
import { customElement } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/LoreText.scss'

@customElement('gc-lore-text')
export class LoreText extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    render() {
        return html`<div class="lore"><slot></slot></div>`
    }
}

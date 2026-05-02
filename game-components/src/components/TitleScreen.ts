import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/TitleScreen.scss'

@customElement('gc-title-screen')
export class TitleScreen extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ attribute: 'title-text' }) titleText = ''
    @property() subtitle = ''

    render() {
        return html`
            <slot name="backdrop"></slot>
            <div class="center">
                <h1>${this.titleText}</h1>
                ${this.subtitle ? html`<div class="subtitle">${this.subtitle}</div>` : nothing}
                <slot></slot>
            </div>
            <div class="footer"><slot name="footer"></slot></div>`
    }
}

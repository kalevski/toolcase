import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/ScrollText.scss'

@customElement('gc-scroll-text')
export class ScrollText extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ attribute: 'scroll-title' }) scrollTitle = ''

    render() {
        return html`<div class="scroll">
            ${this.scrollTitle ? html`<div class="title">✦ ${this.scrollTitle}</div>` : nothing}
            <div class="body"><slot></slot></div>
        </div>`
    }
}

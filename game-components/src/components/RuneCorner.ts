import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/RuneCorner.scss'

@customElement('gc-rune-corner')
export class RuneCorner extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() at: 'tl' | 'tr' | 'bl' | 'br' = 'tl'
    @property({ type: Number }) size = 14

    render() {
        return html`<style>:host { --gc-rune-size: ${this.size}px; }</style>
            <div class="corner pos-${this.at}"></div>`
    }
}

import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/SafeArea.scss'

@customElement('gc-safe-area')
export class SafeArea extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) extra = 0

    render() {
        return html`<style>:host { --gc-extra: ${this.extra}px; }</style><slot></slot>`
    }
}

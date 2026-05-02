import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/BlurOverlay.scss'

@customElement('gc-blur-overlay')
export class BlurOverlay extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number, attribute: 'blur' }) blurAmount = 8
    @property() background = 'rgba(0,0,0,0.3)'

    render() {
        return html`<style>:host { --gc-blur: ${this.blurAmount}px; --gc-bg: ${this.background}; }</style><slot></slot>`
    }
}

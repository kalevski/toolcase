import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Subtitle.scss'

@customElement('gc-subtitle')
export class Subtitle extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() text = ''
    @property() speaker = ''
    @property({ type: Boolean, reflect: true }) boxed = true
    @property() align: 'left' | 'right' | 'center' = 'center'
    @property({ type: Number, attribute: 'font-size' }) fontSize = 18
    @property({ attribute: 'max-width' }) maxWidth = '720px'

    render() {
        if (!this.text) return nothing
        return html`<style>:host { --gc-align: ${this.align}; --gc-font-size: ${this.fontSize}px; --gc-max-width: ${this.maxWidth}; }</style>
            ${this.speaker ? html`<div class="speaker">${this.speaker}</div>` : nothing}
            <div class="body">${this.text}</div>`
    }
}

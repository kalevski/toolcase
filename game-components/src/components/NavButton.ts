import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/NavButton.scss'

@customElement('gc-nav-button')
export class NavButton extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() kind: 'back' | 'close' = 'back'
    @property() label = ''
    @property({ type: Number }) size = 36

    render() {
        const icon = this.kind === 'close' ? '✕' : '←'
        const aria = this.label || (this.kind === 'close' ? 'Close' : 'Back')
        return html`<style>:host { --gc-size: ${this.size}px; }</style>
            <button aria-label=${aria} @click=${() => this.emit('click')}>${icon}</button>`
    }
}

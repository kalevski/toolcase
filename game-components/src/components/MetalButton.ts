import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/MetalButton.scss'

@customElement('gc-metal-button')
export class MetalButton extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() variant: 'default' | 'primary' | 'danger' | 'ghost' = 'default'
    @property() size: 'sm' | 'md' | 'lg' = 'md'
    @property({ type: Boolean }) disabled = false

    render() {
        return html`<button
            class="btn v-${this.variant} s-${this.size}"
            ?disabled=${this.disabled}
            @click=${() => this.emit('click')}
        ><slot></slot></button>`
    }
}

import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/MenuItem.scss'

@customElement('gc-menu-item')
export class MenuItem extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() label = ''
    @property() hotkey = ''
    @property() icon = ''
    @property({ type: Boolean, reflect: true }) selected = false
    @property({ type: Boolean }) disabled = false

    render() {
        return html`<button
            class="item ${this.selected ? 'selected' : ''}"
            ?disabled=${this.disabled}
            @click=${() => this.emit('select', { label: this.label })}
        >
            ${this.selected ? html`<span class="caret">◆</span>` : (this.icon ? html`<span class="icon">${this.icon}</span>` : nothing)}
            <span class="label">${this.label}</span>
            ${this.hotkey ? html`<span class="key">${this.hotkey}</span>` : nothing}
        </button>`
    }
}

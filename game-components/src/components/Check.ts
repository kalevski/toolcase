import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Check.scss'

@customElement('gc-check')
export class Check extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Boolean, reflect: true }) on = false
    @property({ type: Boolean }) disabled = false

    private _toggle = () => {
        if (this.disabled) return
        this.on = !this.on
        this.emit('change', { on: this.on })
    }

    render() {
        return html`<div
            class="check ${this.on ? 'on' : ''}"
            role="checkbox"
            aria-checked=${this.on}
            tabindex="0"
            @click=${this._toggle}
            @keydown=${(event: KeyboardEvent) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); this._toggle() } }}
        ></div>`
    }
}

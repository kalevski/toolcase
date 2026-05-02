import { html, css, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/KeyBinder.scss'

@customElement('gc-key-binder')
export class KeyBinder extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() value = ''
    @property() placeholder = 'Click to bind'
    @property({ type: Boolean }) disabled = false

    @state() private _capturing = false

    private _onKey = (event: KeyboardEvent) => {
        if (!this._capturing) return
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'Escape') { this._capturing = false; this.emit('cancel'); return }
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return
        const parts: string[] = []
        if (event.ctrlKey) parts.push('Ctrl')
        if (event.shiftKey) parts.push('Shift')
        if (event.altKey) parts.push('Alt')
        if (event.metaKey) parts.push('Meta')
        parts.push(event.key.length === 1 ? event.key.toUpperCase() : event.key)
        this.value = parts.join(' + ')
        this._capturing = false
        this.emit('change', { value: this.value, code: event.code, key: event.key })
    }

    connectedCallback(): void { super.connectedCallback(); window.addEventListener('keydown', this._onKey, true) }
    disconnectedCallback(): void { window.removeEventListener('keydown', this._onKey, true); super.disconnectedCallback() }

    render() {
        return html`<button class=${this._capturing ? 'capturing' : ''} ?disabled=${this.disabled} @click=${() => { this._capturing = true }}>
            ${this._capturing ? 'Press any key...' : (this.value || this.placeholder)}
        </button>`
    }
}

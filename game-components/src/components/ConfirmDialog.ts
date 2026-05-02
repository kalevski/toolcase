import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/ConfirmDialog.scss'

@customElement('gc-confirm-dialog')
export class ConfirmDialog extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Boolean, reflect: true }) open = false
    @property({ attribute: 'dialog-title' }) dialogTitle = 'Confirm'
    @property() eyebrow = ''
    @property() message = ''
    @property({ attribute: 'confirm-label' }) confirmLabel = 'Yes'
    @property({ attribute: 'cancel-label' }) cancelLabel = 'Cancel'
    @property({ type: Boolean }) danger = false

    private _onKey = (event: KeyboardEvent) => {
        if (!this.open) return
        if (event.key === 'Escape') this.emit('cancel')
        if (event.key === 'Enter') this.emit('confirm')
    }

    connectedCallback(): void { super.connectedCallback(); window.addEventListener('keydown', this._onKey) }
    disconnectedCallback(): void { window.removeEventListener('keydown', this._onKey); super.disconnectedCallback() }

    render() {
        if (!this.open) return nothing
        return html`<div class="box" role="dialog" aria-modal="true">
            ${this.eyebrow ? html`<div class="eyebrow">${this.eyebrow}</div>` : nothing}
            <h3>${this.dialogTitle}</h3>
            <div class="divider"><div class="diamond"></div></div>
            ${this.message ? html`<div class="message">${this.message}</div>` : nothing}
            <div class="actions">
                <button class="cancel" @click=${() => this.emit('cancel')}>${this.cancelLabel}</button>
                <button class="confirm ${this.danger ? 'danger' : ''}" @click=${() => this.emit('confirm')}>${this.confirmLabel}</button>
            </div>
        </div>`
    }
}

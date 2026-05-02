import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ConfirmDialog.styles.js'

@customElement('gc-confirm-dialog')
export class ConfirmDialog extends GameElement {
    static styles = styles

    @property({ type: Boolean, reflect: true }) open = false
    @property({ attribute: 'dialog-title' }) dialogTitle = 'Confirm'
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
            <h3>${this.dialogTitle}</h3>
            ${this.message ? html`<div class="message">${this.message}</div>` : nothing}
            <div class="actions">
                <button class="cancel" @click=${() => this.emit('cancel')}>${this.cancelLabel}</button>
                <button class="confirm ${this.danger ? 'danger' : ''}" @click=${() => this.emit('confirm')}>${this.confirmLabel}</button>
            </div>
        </div>`
    }
}

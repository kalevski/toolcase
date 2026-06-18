import { DialogBase, esc } from './internal/dialog-base'

const TAG_NAME = 'tc-confirm-dialog'

/**
 * tc-confirm-dialog — a centered confirm/cancel modal on the shared
 * {@link DialogBase} scaffold. Adds the confirm/cancel button body, the
 * danger-variant + label attributes, Enter-to-confirm, and the tc-confirm /
 * tc-cancel events.
 */
export class ConfirmDialog extends DialogBase {
    onConfirm: (() => void) | null = null
    onCancel: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['open', 'dialog-title', 'eyebrow', 'message', 'confirm-label', 'cancel-label', 'danger']
    }

    get dialogTitle(): string {
        return this.getAttribute('dialog-title') ?? 'Are you sure?'
    }
    set dialogTitle(v: string) {
        if (v) this.setAttribute('dialog-title', v)
        else this.removeAttribute('dialog-title')
    }

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? 'Confirm'
    }
    set eyebrow(v: string) {
        if (v) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get message(): string {
        return this.getAttribute('message') ?? ''
    }
    set message(v: string) {
        if (v) this.setAttribute('message', v)
        else this.removeAttribute('message')
    }

    get confirmLabel(): string {
        return this.getAttribute('confirm-label') ?? 'Confirm'
    }
    set confirmLabel(v: string) {
        if (v) this.setAttribute('confirm-label', v)
        else this.removeAttribute('confirm-label')
    }

    get cancelLabel(): string {
        return this.getAttribute('cancel-label') ?? 'Cancel'
    }
    set cancelLabel(v: string) {
        if (v) this.setAttribute('cancel-label', v)
        else this.removeAttribute('cancel-label')
    }

    get danger(): boolean {
        return this.hasAttribute('danger')
    }
    set danger(v: boolean) {
        if (v) this.setAttribute('danger', '')
        else this.removeAttribute('danger')
    }

    // Focus the confirm action first when the dialog opens.
    protected initialFocusSelector(): string | null {
        return `.${this.classPrefix}__confirm`
    }

    protected onCloseRequest(): void {
        this._emitCancel()
    }

    protected onExtraKeydown(e: KeyboardEvent): void {
        if (e.key !== 'Enter') return
        // Don't hijack Enter while focus is on the cancel button — let the native
        // click fire instead so the button does what it shows.
        const active = document.activeElement
        if (active instanceof HTMLElement && active.closest(`.${this.classPrefix}__cancel`)) return
        e.preventDefault()
        this._emitConfirm()
    }

    protected onBodyClick(e: MouseEvent): void {
        const target = e.target as Element | null
        if (!target) return
        if (target.closest(`.${this.classPrefix}__confirm`)) {
            this._emitConfirm()
        } else if (target.closest(`.${this.classPrefix}__cancel`)) {
            this._emitCancel()
        }
    }

    private _emitConfirm(): void {
        this.dispatchEvent(new CustomEvent('tc-confirm', { bubbles: true, composed: true, detail: {} }))
        if (typeof this.onConfirm === 'function') this.onConfirm()
    }

    private _emitCancel(): void {
        this.dispatchEvent(new CustomEvent('tc-cancel', { bubbles: true, composed: true, detail: {} }))
        if (typeof this.onCancel === 'function') this.onCancel()
    }

    protected render(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'dialog')

        const isOpen = this.open
        const hiddenAttr = isOpen ? '' : ' hidden'
        const panelAriaHidden = isOpen ? 'false' : 'true'

        const confirmVariant = this.danger ? 'btn-danger' : 'btn-primary'
        const titleId = `${this._idPrefix}-title`
        const messageId = `${this._idPrefix}-message`

        const eyebrowMarkup = this.eyebrow
            ? `<span class="tc-confirm-dialog__eyebrow">${esc(this.eyebrow)}</span>`
            : ''
        const messageMarkup = this.message
            ? `<p class="tc-confirm-dialog__message" id="${messageId}">${esc(this.message)}</p>`
            : ''
        const describedBy = this.message ? ` aria-describedby="${messageId}"` : ''

        this.innerHTML =
            `<div class="tc-confirm-dialog__backdrop" aria-hidden="true"${hiddenAttr}></div>` +
            `<div class="tc-confirm-dialog__panel" role="document"` +
            ` aria-labelledby="${titleId}"${describedBy} tabindex="-1"` +
            ` aria-hidden="${panelAriaHidden}"${hiddenAttr}>` +
            eyebrowMarkup +
            `<h2 class="tc-confirm-dialog__title" id="${titleId}">${esc(this.dialogTitle)}</h2>` +
            messageMarkup +
            `<div class="tc-confirm-dialog__actions">` +
            `<button type="button" class="btn btn-outline-secondary tc-confirm-dialog__cancel">${esc(this.cancelLabel)}</button>` +
            `<button type="button" class="btn ${confirmVariant} tc-confirm-dialog__confirm">${esc(this.confirmLabel)}</button>` +
            `</div>` +
            `</div>`

        if (isOpen) {
            this.classList.add('tc-confirm-dialog--open')
        } else {
            this.classList.remove('tc-confirm-dialog--open')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ConfirmDialog
    }
}

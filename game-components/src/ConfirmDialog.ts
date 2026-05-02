const TAG_NAME = 'gc-confirm-dialog'

export interface ConfirmDialogEventMap {
    cancel: CustomEvent<void>
    confirm: CustomEvent<void>
}

export class ConfirmDialog extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['open', 'dialog-title', 'eyebrow', 'message', 'confirm-label', 'cancel-label', 'danger']
    }

    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'dialog')
        this.setAttribute('aria-modal', 'true')
        document.addEventListener('keydown', this.keyHandler)
        this.render()
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this.keyHandler)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(value: boolean) {
        if (value) this.setAttribute('open', '')
        else this.removeAttribute('open')
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

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private handleKey(event: KeyboardEvent): void {
        if (!this.open) return
        if (event.key === 'Escape') {
            event.preventDefault()
            this.emit('cancel')
        } else if (event.key === 'Enter') {
            event.preventDefault()
            this.emit('confirm')
        }
    }

    private render(): void {
        const variant = this.danger ? 'danger' : 'primary'
        const eyebrowMarkup = this.eyebrow
            ? `<gc-eyebrow class="gc-confirm-dialog-eyebrow">${this.escape(this.eyebrow)}</gc-eyebrow>`
            : ''
        const messageMarkup = this.message
            ? `<div class="gc-confirm-dialog-message">${this.escape(this.message)}</div>`
            : ''

        this.innerHTML = `
            <div class="gc-confirm-dialog-backdrop" data-gc-backdrop></div>
            <div class="gc-confirm-dialog-panel" role="document">
                ${eyebrowMarkup}
                <gc-title class="gc-confirm-dialog-title">${this.escape(this.dialogTitle)}</gc-title>
                <div class="gc-confirm-dialog-divider"><span class="gc-confirm-dialog-rule"></span><span class="gc-confirm-dialog-diamond"></span><span class="gc-confirm-dialog-rule"></span></div>
                ${messageMarkup}
                <div class="gc-confirm-dialog-actions">
                    <gc-metal-button class="gc-confirm-dialog-cancel" variant="ghost">${this.escape(this.cancelLabel)}</gc-metal-button>
                    <gc-metal-button class="gc-confirm-dialog-confirm" variant="${variant}">${this.escape(this.confirmLabel)}</gc-metal-button>
                </div>
            </div>
        `

        const backdrop = this.querySelector('[data-gc-backdrop]') as HTMLElement | null
        backdrop?.addEventListener('click', () => this.emit('cancel'))

        const cancel = this.querySelector('.gc-confirm-dialog-cancel') as HTMLElement | null
        cancel?.addEventListener('click', () => this.emit('cancel'))

        const confirm = this.querySelector('.gc-confirm-dialog-confirm') as HTMLElement | null
        confirm?.addEventListener('click', () => this.emit('confirm'))
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ConfirmDialog)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ConfirmDialog
    }
}

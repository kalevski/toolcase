const TAG_NAME = 'tc-confirm-dialog'

let _idCounter = 0

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function getFocusable(root: Element): HTMLElement[] {
    return Array.from(
        root.querySelectorAll<HTMLElement>(
            'a[href],area[href],button:not([disabled]),details>summary,[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        ),
    ).filter(el => !el.closest('[hidden]') && el.tabIndex >= 0)
}

export class ConfirmDialog extends HTMLElement {
    private _initialised = false
    private _previousFocus: Element | null = null
    private _idPrefix: string

    onConfirm: (() => void) | null = null
    onCancel: (() => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-confirm-dialog-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['open', 'dialog-title', 'eyebrow', 'message', 'confirm-label', 'cancel-label', 'danger']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Detach before attach to prevent double-registration on reconnect.
        this._detachHandlers()
        this._attachHandlers()
        if (this.open) this._applyOpenState(true)
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._restoreScroll()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'open') {
            this._applyOpenState(this.open)
            return
        }

        // Structural attribute changed — re-render, then re-apply visibility.
        this.render()
        if (this.open) this._applyOpenState(true)
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
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

    // ── Open / close lifecycle ─────────────────────────────────────────────────

    private _applyOpenState(opening: boolean): void {
        const panel = this.querySelector<HTMLElement>('.tc-confirm-dialog__panel')
        const backdrop = this.querySelector<HTMLElement>('.tc-confirm-dialog__backdrop')

        if (opening) {
            this._previousFocus = document.activeElement
            panel?.removeAttribute('hidden')
            backdrop?.removeAttribute('hidden')
            // Settle one frame before adding the open class to trigger the transition.
            requestAnimationFrame(() => {
                this.classList.add('tc-confirm-dialog--open')
                panel?.setAttribute('aria-hidden', 'false')
                this._lockScroll()
                this._trapFocus(panel)
            })
        } else {
            this.classList.remove('tc-confirm-dialog--open')
            panel?.setAttribute('aria-hidden', 'true')
            this._restoreScroll()
            this._restoreFocus()
            const delay = this._getTransitionDuration(panel)
            setTimeout(() => {
                if (!this.open) {
                    panel?.setAttribute('hidden', '')
                    backdrop?.setAttribute('hidden', '')
                }
            }, delay)
        }
    }

    private _getTransitionDuration(el: HTMLElement | null): number {
        if (!el) return 0
        const style = getComputedStyle(el)
        const raw = style.transitionDuration || '0s'
        let max = 0
        for (const p of raw.split(',')) {
            const sec = parseFloat(p.trim())
            if (!isNaN(sec)) max = Math.max(max, sec)
        }
        return max * 1000
    }

    private _lockScroll(): void {
        document.body.style.overflow = 'hidden'
    }

    private _restoreScroll(): void {
        document.body.style.overflow = ''
    }

    private _restoreFocus(): void {
        if (this._previousFocus instanceof HTMLElement) {
            this._previousFocus.focus()
        }
        this._previousFocus = null
    }

    private _trapFocus(panel: HTMLElement | null): void {
        if (!panel) return
        // Default focus to the confirm action; fall back to the panel itself.
        const confirm = panel.querySelector<HTMLElement>('.tc-confirm-dialog__confirm')
        const focusable = getFocusable(panel)
        if (confirm) confirm.focus()
        else if (focusable.length > 0) focusable[0].focus()
        else panel.focus()
    }

    // ── Event emit ─────────────────────────────────────────────────────────────

    private _emitConfirm(): void {
        this.dispatchEvent(new CustomEvent('tc-confirm', { bubbles: true, composed: true, detail: {} }))
        if (typeof this.onConfirm === 'function') this.onConfirm()
    }

    private _emitCancel(): void {
        this.dispatchEvent(new CustomEvent('tc-cancel', { bubbles: true, composed: true, detail: {} }))
        if (typeof this.onCancel === 'function') this.onCancel()
    }

    // ── Listeners ──────────────────────────────────────────────────────────────

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return
        if (e.key === 'Escape') {
            e.preventDefault()
            this._emitCancel()
            return
        }
        if (e.key === 'Enter') {
            // Don't hijack Enter while focus is on the cancel button — let the
            // native click fire instead so the button does what it shows.
            const active = document.activeElement
            if (active instanceof HTMLElement && active.closest('.tc-confirm-dialog__cancel')) return
            e.preventDefault()
            this._emitConfirm()
            return
        }
        if (e.key === 'Tab') {
            const panel = this.querySelector<HTMLElement>('.tc-confirm-dialog__panel')
            if (!panel) return
            const focusable = getFocusable(panel)
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }
    }

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element | null
        if (!target) return
        if (target.closest('.tc-confirm-dialog__confirm')) {
            this._emitConfirm()
        } else if (target.closest('.tc-confirm-dialog__cancel')) {
            this._emitCancel()
        } else if (target.classList.contains('tc-confirm-dialog__backdrop')) {
            this._emitCancel()
        }
    }

    private _attachHandlers(): void {
        document.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onClick)
    }

    private _detachHandlers(): void {
        document.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onClick)
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    private render(): void {
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

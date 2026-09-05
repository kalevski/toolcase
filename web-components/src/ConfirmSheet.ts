import { BottomSheet } from './BottomSheet'
import { esc } from './internal/esc'
import { syncOwnedNodes, syncTrailingNodes } from './internal/tc-element'

const TAG_NAME = 'tc-confirm-sheet'

/**
 * tc-confirm-sheet — "are you sure", as a bottom sheet.
 *
 * From polovni.mk, whose own note says exactly why it exists: `window.confirm`
 * names the browser rather than the product, cannot say what the consequence is
 * in the product's voice, and looks different on every machine.
 *
 * TWO CONFIRM ELEMENTS IN THIS LIBRARY, and the difference is the surface, not
 * the wording:
 *   tc-confirm-dialog  centre-anchored, corner ✕. The desktop shape.
 *   tc-confirm-sheet   this one. Enters from the thumb side and its actions are
 *                      within reach of a thumb. On a 390×844 screen a centred
 *                      dialog either floats awkwardly mid-screen or effectively
 *                      becomes full-screen with its dismiss in the hardest place
 *                      on the device to reach.
 *
 * It EXTENDS `tc-bottom-sheet` rather than reimplementing it, so it inherits the
 * whole surface contract — focus trap with return-to-trigger, scroll lock that
 * knows whether it is inside an app shell, Escape, scrim tap, drag-to-dismiss,
 * the 2-level stack cap — and adds only the body and the two actions.
 *
 * EVERY DISMISSAL IS A CANCEL. Scrim, Escape, drag and the cancel button all mean
 * "no", which is what makes a confirm safe to dismiss by accident; only the
 * confirm button means "yes". `tc-cancel` therefore fires from the inherited
 * `tc-sheet-close` for every reason except a confirm.
 */
export class ConfirmSheet extends BottomSheet {
    private _confirming = false

    onConfirm: (() => void) | null = null
    onCancel: (() => void) | null = null

    static get observedAttributes(): string[] {
        return [
            ...BottomSheet.observedAttributes,
            'message',
            'confirm-label',
            'cancel-label',
            'danger',
        ]
    }

    connectedCallback(): void {
        super.connectedCallback()
        this.addEventListener('click', this._onBodyClick)
        this.addEventListener('tc-sheet-close', this._onSheetClose)
        this._renderBody()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onBodyClick)
        this.removeEventListener('tc-sheet-close', this._onSheetClose)
        super.disconnectedCallback()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        super.attributeChangedCallback(name, prev, next)
        if (prev === next || !this.isConnected) return
        if (
            name === 'message' ||
            name === 'confirm-label' ||
            name === 'cancel-label' ||
            name === 'danger'
        ) {
            this._renderBody()
        }
    }

    /** The consequence, in the product's own words. */
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

    /** Paints the confirm action as destructive. */
    get danger(): boolean {
        return this.hasAttribute('danger')
    }
    set danger(v: boolean) {
        if (v) this.setAttribute('danger', '')
        else this.removeAttribute('danger')
    }

    private _renderBody(): void {
        const message = this.message
        // The lead is a BODY-region node (no `slot`), prepended like the inherited
        // heading — so anything else the consumer puts in the sheet follows it.
        syncOwnedNodes(this, [
            {
                cls: 'tc-confirm-sheet__lead',
                tag: 'p',
                html: message ? esc(message) : null,
            },
        ])

        // The actions are the sheet's FOOTER region. Appended, and ordered last by
        // the sheet's own `[slot="footer"]` rule rather than by position.
        const confirmClass = this.danger ? 'btn btn-danger' : 'btn btn-primary'
        syncTrailingNodes(this, [
            {
                cls: 'tc-confirm-sheet__actions',
                tag: 'div',
                html:
                    `<button type="button" class="btn btn-outline-secondary tc-confirm-sheet__cancel">` +
                    `${esc(this.cancelLabel)}</button>` +
                    `<button type="button" class="${confirmClass} tc-confirm-sheet__confirm">` +
                    `${esc(this.confirmLabel)}</button>`,
            },
        ])
        const actions = this.querySelector<HTMLElement>(':scope > .tc-confirm-sheet__actions')
        actions?.setAttribute('slot', 'footer')
    }

    private _onBodyClick = (event: MouseEvent): void => {
        const target = event.target as Element | null
        if (!target) return
        if (target.closest('.tc-confirm-sheet__confirm')) {
            // Set BEFORE the close so the inherited `tc-sheet-close` that follows is
            // not also reported as a cancel.
            this._confirming = true
            this.dispatchEvent(
                new CustomEvent('tc-confirm', { bubbles: true, composed: true, detail: {} }),
            )
            if (typeof this.onConfirm === 'function') this.onConfirm()
            void this.hide('action')
        } else if (target.closest('.tc-confirm-sheet__cancel')) {
            void this.hide('action')
        }
    }

    private _onSheetClose = (): void => {
        if (this._confirming) {
            this._confirming = false
            return
        }
        this.dispatchEvent(
            new CustomEvent('tc-cancel', { bubbles: true, composed: true, detail: {} }),
        )
        if (typeof this.onCancel === 'function') this.onCancel()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ConfirmSheet
    }
}

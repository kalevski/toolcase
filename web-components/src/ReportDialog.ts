import { closeIcon } from './icons'

const TAG_NAME = 'tc-report-dialog'

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

const DEFAULT_REASONS = [
    'Cheating / hacks',
    'Toxic behavior',
    'Inappropriate name',
    'Griefing / sabotage',
    'Other',
]

export class ReportDialog extends HTMLElement {
    private _initialised = false
    private _reasons: string[] = DEFAULT_REASONS.slice()
    private _selectedReason = ''
    private _comment = ''
    private _previousFocus: Element | null = null
    private _idPrefix: string

    onCancel: (() => void) | null = null
    onSubmit: ((reason: string, comment: string) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-report-dialog-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['open', 'player-name']
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

        // Structural attribute changed (player-name) — re-render.
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

    get playerName(): string {
        return this.getAttribute('player-name') ?? ''
    }
    set playerName(v: string) {
        if (v) this.setAttribute('player-name', v)
        else this.removeAttribute('player-name')
    }

    get reasons(): string[] {
        return this._reasons.slice()
    }
    set reasons(value: string[]) {
        this._reasons = Array.isArray(value) && value.length > 0 ? value.slice() : DEFAULT_REASONS.slice()
        this._selectedReason = ''
        if (this._initialised) {
            this.render()
            if (this.open) this._applyOpenState(true)
        }
    }

    // ── Open / close lifecycle ─────────────────────────────────────────────────

    private _applyOpenState(opening: boolean): void {
        const panel = this.querySelector<HTMLElement>('.tc-report-dialog__panel')
        const backdrop = this.querySelector<HTMLElement>('.tc-report-dialog__backdrop')

        if (opening) {
            this._previousFocus = document.activeElement
            panel?.removeAttribute('hidden')
            backdrop?.removeAttribute('hidden')
            // Settle one frame before adding the open class to trigger the transition.
            requestAnimationFrame(() => {
                this.classList.add('tc-report-dialog--open')
                panel?.setAttribute('aria-hidden', 'false')
                this._lockScroll()
                this._trapFocus(panel)
            })
        } else {
            this.classList.remove('tc-report-dialog--open')
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

    private _emitCancel(): void {
        this.dispatchEvent(new CustomEvent('tc-cancel', { bubbles: true, composed: true, detail: {} }))
        if (typeof this.onCancel === 'function') this.onCancel()
    }

    private _emitSubmit(): void {
        if (!this._selectedReason) return
        this.dispatchEvent(new CustomEvent('tc-submit', {
            bubbles: true,
            composed: true,
            detail: { reason: this._selectedReason, comment: this._comment },
        }))
        if (typeof this.onSubmit === 'function') this.onSubmit(this._selectedReason, this._comment)
    }

    // ── Focus management ───────────────────────────────────────────────────────

    private _trapFocus(panel: HTMLElement | null): void {
        if (!panel) return
        const focusable = getFocusable(panel)
        if (focusable.length > 0) focusable[0].focus()
        else panel.focus()
    }

    private _restoreFocus(): void {
        if (this._previousFocus instanceof HTMLElement) this._previousFocus.focus()
        this._previousFocus = null
    }

    private _lockScroll(): void {
        document.body.style.overflow = 'hidden'
    }

    private _restoreScroll(): void {
        document.body.style.overflow = ''
    }

    private _getTransitionDuration(el: HTMLElement | null): number {
        if (!el) return 0
        const raw = getComputedStyle(el).transitionDuration || '0s'
        let max = 0
        for (const p of raw.split(',')) {
            const sec = parseFloat(p.trim())
            if (!isNaN(sec)) max = Math.max(max, sec)
        }
        return max * 1000
    }

    // ── Event handlers (arrow-property, stable references) ────────────────────

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return
        if (e.key === 'Escape') {
            e.preventDefault()
            this._emitCancel()
            return
        }
        if (e.key === 'Tab') {
            const panel = this.querySelector<HTMLElement>('.tc-report-dialog__panel')
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
        if (target.classList.contains('tc-report-dialog__backdrop')) {
            this._emitCancel()
        } else if (target.closest('.tc-report-dialog__close')) {
            this._emitCancel()
        } else if (target.closest('.tc-report-dialog__cancel')) {
            this._emitCancel()
        } else {
            const submitBtn = target.closest<HTMLButtonElement>('.tc-report-dialog__submit')
            if (submitBtn && !submitBtn.disabled) this._emitSubmit()
        }
    }

    private _onReasonChange = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (!input || input.type !== 'radio') return
        this._patchReasonSelection(input.value)
        // Focus naturally stays on the clicked radio — no explicit refocus needed.
    }

    // Surgically update checked state without a full re-render, so the overlay
    // transition does not replay every time the user picks a reason.
    private _patchReasonSelection(chosenValue: string): void {
        this._selectedReason = chosenValue
        this.querySelectorAll<HTMLLabelElement>('.tc-report-dialog__reason').forEach(label => {
            const radio = label.querySelector<HTMLInputElement>('input[type="radio"]')
            if (!radio) return
            const isChosen = radio.value === chosenValue
            radio.checked = isChosen
            label.classList.toggle('tc-report-dialog__reason--checked', isChosen)
        })
        const submitBtn = this.querySelector<HTMLButtonElement>('.tc-report-dialog__submit')
        if (submitBtn) submitBtn.disabled = !chosenValue
    }

    private _onCommentInput = (e: Event): void => {
        const textarea = e.target as HTMLTextAreaElement
        if (!textarea || textarea.tagName !== 'TEXTAREA') return
        this._comment = textarea.value
    }

    private _attachHandlers(): void {
        document.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onClick)
        this.addEventListener('change', this._onReasonChange)
        this.addEventListener('input', this._onCommentInput)
    }

    private _detachHandlers(): void {
        document.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('change', this._onReasonChange)
        this.removeEventListener('input', this._onCommentInput)
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    private render(): void {
        const isOpen = this.open
        const hiddenAttr = isOpen ? '' : ' hidden'
        const labelId = `${this._idPrefix}-title`
        const playerNameText = esc(this.getAttribute('player-name') ?? 'Unknown')

        const reasonsHtml = this._reasons.map((reason, idx) => {
            const checked = reason === this._selectedReason
            const inputId = `${this._idPrefix}-reason-${idx}`
            return (
                `<label class="tc-report-dialog__reason${checked ? ' tc-report-dialog__reason--checked' : ''}" for="${inputId}">` +
                `<input type="radio" id="${inputId}" name="${this._idPrefix}-report-reason" value="${esc(reason)}"${checked ? ' checked' : ''} />` +
                `<span class="tc-report-dialog__radio" aria-hidden="true"></span>` +
                `<span class="tc-report-dialog__reason-label">${esc(reason)}</span>` +
                `</label>`
            )
        }).join('')

        this.innerHTML =
            `<div class="tc-report-dialog__backdrop" aria-hidden="true"${hiddenAttr}></div>` +
            `<div class="tc-report-dialog__panel" role="dialog" aria-modal="true"` +
            ` aria-labelledby="${labelId}" tabindex="-1"` +
            ` aria-hidden="${isOpen ? 'false' : 'true'}"${hiddenAttr}>` +
            `<div class="tc-report-dialog__header">` +
            `<span class="tc-report-dialog__eyebrow">Report Player</span>` +
            `<h2 class="tc-report-dialog__title" id="${labelId}">${playerNameText}</h2>` +
            `<button type="button" class="tc-report-dialog__close" aria-label="Close">${closeIcon}</button>` +
            `</div>` +
            `<div class="tc-report-dialog__body">` +
            `<p class="tc-report-dialog__message">Select the reason this player should be reported. Your report stays anonymous.</p>` +
            `<div class="tc-report-dialog__reasons" role="radiogroup" aria-label="Report reason">${reasonsHtml}</div>` +
            `<textarea class="tc-report-dialog__comment" placeholder="Additional details (optional)">${esc(this._comment)}</textarea>` +
            `</div>` +
            `<div class="tc-report-dialog__actions">` +
            `<button type="button" class="tc-report-dialog__btn tc-report-dialog__cancel">Cancel</button>` +
            `<button type="button" class="tc-report-dialog__btn tc-report-dialog__submit"${this._selectedReason ? '' : ' disabled'}>Submit Report</button>` +
            `</div>` +
            `</div>`

        if (isOpen) {
            this.classList.add('tc-report-dialog--open')
        } else {
            this.classList.remove('tc-report-dialog--open')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ReportDialog
    }
}

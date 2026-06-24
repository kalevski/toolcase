import { DialogBase, esc } from './internal/dialog-base'
import { closeIcon } from './icons'

const TAG_NAME = 'tc-report-dialog'

const DEFAULT_REASONS = [
    'Cheating / hacks',
    'Toxic behavior',
    'Inappropriate name',
    'Griefing / sabotage',
    'Other',
]

/**
 * tc-report-dialog — a centered "report a player" modal on the shared
 * {@link DialogBase} scaffold. Adds the reason radio-group + optional comment
 * body, the player-name attribute, in-place reason selection, and the tc-cancel
 * / tc-submit events.
 */
export class ReportDialog extends DialogBase {
    private _reasons: string[] = DEFAULT_REASONS.slice()
    private _selectedReason = ''
    private _comment = ''

    onCancel: (() => void) | null = null
    onSubmit: ((reason: string, comment: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['open', 'player-name']
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
        this._reasons =
            Array.isArray(value) && value.length > 0 ? value.slice() : DEFAULT_REASONS.slice()
        this._selectedReason = ''
        if (this._initialised) {
            this.render()
            if (this.open) this._applyOpenState(true)
        }
    }

    protected onCloseRequest(): void {
        this._emitCancel()
    }

    protected onBodyClick(e: MouseEvent): void {
        const target = e.target as Element | null
        if (!target) return
        if (target.closest(`.${this.classPrefix}__close`)) {
            this._emitCancel()
        } else if (target.closest(`.${this.classPrefix}__cancel`)) {
            this._emitCancel()
        } else {
            const submitBtn = target.closest<HTMLButtonElement>(`.${this.classPrefix}__submit`)
            if (submitBtn && !submitBtn.disabled) this._emitSubmit()
        }
    }

    protected attachExtraHandlers(): void {
        this.addEventListener('change', this._onReasonChange)
        this.addEventListener('input', this._onCommentInput)
    }

    protected detachExtraHandlers(): void {
        this.removeEventListener('change', this._onReasonChange)
        this.removeEventListener('input', this._onCommentInput)
    }

    private _emitCancel(): void {
        this.dispatchEvent(
            new CustomEvent('tc-cancel', { bubbles: true, composed: true, detail: {} }),
        )
        if (typeof this.onCancel === 'function') this.onCancel()
    }

    private _emitSubmit(): void {
        if (!this._selectedReason) return
        this.dispatchEvent(
            new CustomEvent('tc-submit', {
                bubbles: true,
                composed: true,
                detail: { reason: this._selectedReason, comment: this._comment },
            }),
        )
        if (typeof this.onSubmit === 'function') this.onSubmit(this._selectedReason, this._comment)
    }

    private _onReasonChange = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (!input || input.type !== 'radio') return
        this._patchReasonSelection(input.value)
    }

    // Surgically update checked state without a full re-render, so the overlay
    // transition does not replay every time the user picks a reason.
    private _patchReasonSelection(chosenValue: string): void {
        this._selectedReason = chosenValue
        this.querySelectorAll<HTMLLabelElement>('.tc-report-dialog__reason').forEach((label) => {
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

    protected render(): void {
        const isOpen = this.open
        const hiddenAttr = isOpen ? '' : ' hidden'
        const labelId = `${this._idPrefix}-title`
        const playerNameText = esc(this.getAttribute('player-name') ?? 'Unknown')

        const reasonsHtml = this._reasons
            .map((reason, idx) => {
                const checked = reason === this._selectedReason
                const inputId = `${this._idPrefix}-reason-${idx}`
                return (
                    `<label class="tc-report-dialog__reason${checked ? ' tc-report-dialog__reason--checked' : ''}" for="${inputId}">` +
                    `<input type="radio" id="${inputId}" name="${this._idPrefix}-report-reason" value="${esc(reason)}"${checked ? ' checked' : ''} />` +
                    `<span class="tc-report-dialog__radio" aria-hidden="true"></span>` +
                    `<span class="tc-report-dialog__reason-label">${esc(reason)}</span>` +
                    `</label>`
                )
            })
            .join('')

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

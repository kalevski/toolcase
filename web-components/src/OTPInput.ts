import { esc } from './internal/esc'
import { msg } from './messages'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'
const TAG_NAME = 'tc-otp-input'

let _idCounter = 0

export type OTPInputMode = 'numeric' | 'alphanumeric'
export type OTPInputState = 'valid' | 'invalid'

const MODES: OTPInputMode[] = ['numeric', 'alphanumeric']
const STATES: OTPInputState[] = ['valid', 'invalid']

export class OTPInput extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _idPrefix: string
    // Shared id for the reserved field-message slot, referenced by aria-describedby.
    private _helpId: string
    private _labelId: string
    private _cells: string[] = []
    private _internals: ElementInternals
    private _defaultValue = ''

    onChange: ((value: string) => void) | null = null
    onComplete: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'length',
            'value',
            'name',
            'mode',
            'masked',
            'label',
            'placeholder',
            'disabled',
            'required',
            'error',
            'state',
            'help',
        ]
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._idPrefix = `tc-otp-${uid}`
        this._helpId = `${this._idPrefix}-help`
        this._labelId = `${this._idPrefix}-label`
        this._internals = this.attachInternals()
    }

    // ── length ─────────────────────────────────────────────────────────────
    get length(): number {
        const raw = this.getAttribute('length')
        if (raw === null) return 6
        const n = parseInt(raw, 10)
        return isNaN(n) || n < 1 ? 6 : Math.min(n, 20)
    }
    set length(v: number) {
        this.setAttribute('length', String(v))
    }

    // ── value ──────────────────────────────────────────────────────────────
    get value(): string {
        return this._cells.join('')
    }
    set value(v: string | null) {
        const str = v ?? ''
        const len = this.length
        this._cells = Array.from({ length: len }, (_, i) => str[i] ?? '')
        if (str) this.setAttribute('value', str)
        else this.removeAttribute('value')
        if (this._initialised) {
            this._patchCellValues()
            const hidden = this.querySelector<HTMLInputElement>('input[type="hidden"]')
            if (hidden) hidden.value = str
        }
    }

    // ── name ───────────────────────────────────────────────────────────────
    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    // ── mode ───────────────────────────────────────────────────────────────
    get mode(): OTPInputMode {
        const v = this.getAttribute('mode') as OTPInputMode
        return MODES.includes(v) ? v : 'numeric'
    }
    set mode(v: OTPInputMode) {
        this.setAttribute('mode', v)
    }

    // ── masked ─────────────────────────────────────────────────────────────
    get masked(): boolean {
        return this.hasAttribute('masked')
    }
    set masked(v: boolean) {
        if (v) this.setAttribute('masked', '')
        else this.removeAttribute('masked')
    }

    // ── label ──────────────────────────────────────────────────────────────
    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    // ── error ──────────────────────────────────────────────────────────────
    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    // ── help (hint text shown in the reserved message slot) ──────────────────
    get help(): string | null {
        return this.getAttribute('help')
    }
    set help(v: string | null) {
        if (v != null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    // ── state ('valid' | 'invalid'); an `error` message forces 'invalid' ─────
    get state(): OTPInputState | null {
        const v = this.getAttribute('state') as OTPInputState
        return STATES.includes(v) ? v : null
    }
    set state(v: OTPInputState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    // ── placeholder (shown in each empty cell) ───────────────────────────────
    get placeholder(): string {
        return this.getAttribute('placeholder') ?? ''
    }
    set placeholder(v: string) {
        this.setAttribute('placeholder', v)
    }

    // ── disabled ─────────────────────────────────────────────────────────────
    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ── required ─────────────────────────────────────────────────────────────
    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    // ───────────────────────────────────────────────────────────────────────

    connectedCallback(): void {
        if (!this._initialised) {
            const len = this.length
            const val = this.getAttribute('value') ?? ''
            this._cells = Array.from({ length: len }, (_, i) => val[i] ?? '')
            // Capture the initial value once so formResetCallback can restore it.
            this._defaultValue = val
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('keydown', this._onKeydown)
        this.addEventListener('input', this._onInput)
        this.addEventListener('paste', this._onPaste)
        this.addEventListener('focusin', this._onFocusin)
        this._syncForm()
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('input', this._onInput)
        this.removeEventListener('paste', this._onPaste)
        this.removeEventListener('focusin', this._onFocusin)
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        this.value = this._defaultValue
        this._syncForm()
    }

    /** Called by the browser when a containing fieldset/form is disabled/enabled. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    /** Push value + validity into the form. Effective invalid = error / state
     *  invalid / required-but-empty. */
    private _syncForm(): void {
        const value = this.value
        setFieldFormValue(this._internals, this.name, value === '' ? null : value)
        const error = this.error
        const requiredEmpty = this.required && value === ''
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? msg('fieldRequired') : msg('invalidCode')),
            anchor: this.querySelector<HTMLInputElement>('.tc-otp-input__cell') ?? undefined,
        })
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'value') {
            const str = next ?? ''
            const len = this.length
            this._cells = Array.from({ length: len }, (_, i) => str[i] ?? '')
            this._patchCellValues()
            const hidden = this.querySelector<HTMLInputElement>('input[type="hidden"]')
            if (hidden) hidden.value = str
            this._syncForm()
            return
        }

        if (name === 'length') {
            const newLen = this.length
            this._cells = Array.from({ length: newLen }, (_, i) => this._cells[i] ?? '')
        }

        const focusedIdx = this._getFocusedCellIndex()
        this.render()
        // required/state/error all affect the reflected validity computed in _syncForm.
        this._syncForm()
        if (focusedIdx >= 0) {
            const cells = this._getCells()
            const target = cells[Math.min(focusedIdx, cells.length - 1)]
            target?.focus()
        }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Event handlers (arrow-function properties for stable references)
    // ───────────────────────────────────────────────────────────────────────

    private _onKeydown = (e: KeyboardEvent): void => {
        const input = e.target as HTMLInputElement
        if (!input.classList.contains('tc-otp-input__cell')) return

        const cells = this._getCells()
        const idx = cells.indexOf(input)
        if (idx < 0) return

        if (e.key === 'Backspace') {
            e.preventDefault()
            if (this._cells[idx] !== '') {
                this._cells[idx] = ''
                input.value = ''
                input.classList.remove('tc-otp-input__cell--filled')
                this._syncValue()
            } else if (idx > 0) {
                const prev = cells[idx - 1]
                this._cells[idx - 1] = ''
                prev.value = ''
                prev.classList.remove('tc-otp-input__cell--filled')
                prev.focus()
                this._syncValue()
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            if (idx > 0) cells[idx - 1].focus()
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            if (idx < cells.length - 1) cells[idx + 1].focus()
        } else if (e.key === 'Delete') {
            e.preventDefault()
            this._cells[idx] = ''
            input.value = ''
            input.classList.remove('tc-otp-input__cell--filled')
            this._syncValue()
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // Validate character before browser inserts it
            if (!this._isAllowed(e.key)) {
                e.preventDefault()
            }
        }
    }

    private _onInput = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (!input.classList.contains('tc-otp-input__cell')) return

        const cells = this._getCells()
        const idx = cells.indexOf(input)
        if (idx < 0) return

        const raw = input.value
        const filtered = this._filterChars(raw)
        const char = filtered.slice(0, 1)

        this._cells[idx] = char
        input.value = char

        if (char) {
            input.classList.add('tc-otp-input__cell--filled')
            if (idx < cells.length - 1) {
                cells[idx + 1].focus()
            }
        } else {
            input.classList.remove('tc-otp-input__cell--filled')
        }

        this._syncValue()
    }

    private _onPaste = (e: ClipboardEvent): void => {
        e.preventDefault()
        const input = e.target as HTMLInputElement
        if (!input.classList.contains('tc-otp-input__cell')) return

        const cells = this._getCells()
        const startIdx = cells.indexOf(input)
        if (startIdx < 0) return

        const pasted = e.clipboardData?.getData('text') ?? ''
        const filtered = this._filterChars(pasted)

        for (let i = 0; i < filtered.length && startIdx + i < cells.length; i++) {
            const char = filtered[i]
            this._cells[startIdx + i] = char
            cells[startIdx + i].value = char
            if (char) {
                cells[startIdx + i].classList.add('tc-otp-input__cell--filled')
            } else {
                cells[startIdx + i].classList.remove('tc-otp-input__cell--filled')
            }
        }

        const lastIdx = Math.min(startIdx + filtered.length, cells.length - 1)
        cells[lastIdx]?.focus()
        this._syncValue()
    }

    private _onFocusin = (e: FocusEvent): void => {
        const input = e.target as HTMLInputElement
        if (input.classList.contains('tc-otp-input__cell')) {
            input.select()
        }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Private helpers
    // ───────────────────────────────────────────────────────────────────────

    private _isAllowed(char: string): boolean {
        if (this.mode === 'numeric') return /^[0-9]$/.test(char)
        return /^[a-zA-Z0-9]$/.test(char)
    }

    private _filterChars(s: string): string {
        if (this.mode === 'numeric') return s.replace(/[^0-9]/g, '')
        return s.replace(/[^a-zA-Z0-9]/g, '')
    }

    private _getCells(): HTMLInputElement[] {
        return Array.from(this.querySelectorAll<HTMLInputElement>('.tc-otp-input__cell'))
    }

    private _getFocusedCellIndex(): number {
        const cells = this._getCells()
        const focused = this.querySelector<HTMLInputElement>('.tc-otp-input__cell:focus')
        return focused ? cells.indexOf(focused) : -1
    }

    private _patchCellValues(): void {
        const cells = this._getCells()
        cells.forEach((cell, i) => {
            const char = this._cells[i] ?? ''
            cell.value = char
            if (char) cell.classList.add('tc-otp-input__cell--filled')
            else cell.classList.remove('tc-otp-input__cell--filled')
        })
    }

    private _syncValue(): void {
        const combined = this._cells.join('')

        const hidden = this.querySelector<HTMLInputElement>('input[type="hidden"]')
        if (hidden) hidden.value = combined

        // Reflect the new value into the form before notifying listeners.
        this._syncForm()
        dispatchFieldChange(this, combined)
        if (typeof this.onChange === 'function') this.onChange(combined)

        // OTP-specific: announce completion separately from the contract's tc-change.
        if (this._cells.length > 0 && this._cells.every((c) => c !== '')) {
            this.dispatchEvent(
                new CustomEvent('tc-complete', {
                    bubbles: true,
                    composed: true,
                    detail: { value: combined },
                }),
            )
            if (typeof this.onComplete === 'function') this.onComplete(combined)
        }
    }

    private render(): void {
        const len = this.length
        const label = this.label
        const error = this.error
        const masked = this.masked
        const mode = this.mode
        const required = this.required
        const disabled = this.disabled
        const placeholder = this.placeholder
        // An `error` message forces the invalid state; `state` covers valid/invalid
        // without an accompanying message string.
        const state: OTPInputState | null = error ? 'invalid' : this.state
        const isInvalid = state === 'invalid'

        const inputType = masked ? 'password' : 'text'
        const inputMode = mode === 'numeric' ? 'numeric' : 'text'

        const ariaLabelledBy = label
            ? ` aria-labelledby="${this._labelId}"`
            : ` aria-label="One-time password"`
        // The invalid cell border is driven by [aria-invalid='true'] on the wrapper.
        const ariaInvalid = isInvalid ? ' aria-invalid="true"' : ''
        // Cells point at the single reserved slot whenever it carries a message.
        const ariaDescribedBy =
            error || state || this.help ? ` aria-describedby="${this._helpId}"` : ''
        // Only the first cell carries aria-required so SRs announce the group once.
        const disabledAttr = disabled ? ' disabled' : ''
        // A single-char placeholder per cell hints at the expected input.
        const placeholderChar = placeholder.slice(0, 1)
        const placeholderAttr = placeholderChar ? ` placeholder="${esc(placeholderChar)}"` : ''

        const labelHtml = label
            ? `<label class="tc-otp-input__label" id="${this._labelId}">${esc(label)}${requiredMark(required)}</label>`
            : ''

        const cellsHtml = Array.from({ length: len }, (_, i) => {
            const char = this._cells[i] ?? ''
            const valueAttr = char ? ` value="${esc(char)}"` : ''
            const filledClass = char ? ' tc-otp-input__cell--filled' : ''
            const cellAriaLabel = `Digit ${i + 1} of ${len}`
            return [
                `<input`,
                ` class="tc-otp-input__cell${filledClass}"`,
                ` type="${inputType}"`,
                ` inputmode="${inputMode}"`,
                ` maxlength="1"`,
                ` autocomplete="one-time-code"`,
                ` aria-label="${esc(cellAriaLabel)}"`,
                // aria-required on the first cell only — represents the whole group.
                required && i === 0 ? ' aria-required="true"' : '',
                isInvalid ? ' aria-invalid="true"' : '',
                ariaDescribedBy,
                placeholderAttr,
                disabledAttr,
                valueAttr,
                `>`,
            ].join('')
        }).join('')

        // Value submission flows through ElementInternals (formAssociated) — no
        // hidden mirror input, which would double-submit under the same name.

        // One reserved message slot below the cells: invalid > valid > hint.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: msg('invalidCode'),
            validText: 'Looks good!',
        })

        this.innerHTML = [
            `<div class="tc-otp-input"`,
            ` role="group"`,
            ariaLabelledBy,
            ariaInvalid,
            `>`,
            labelHtml,
            `<div class="tc-otp-input__cells">`,
            cellsHtml,
            `</div>`,
            messageHtml,
            `</div>`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: OTPInput
    }
}

import { esc } from './internal/esc'
import { msg } from './messages'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'
import { ChevronUp, ChevronDown } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-number-input'

let _idCounter = 0

export type NumberInputState = 'valid' | 'invalid'
const STATES: NumberInputState[] = ['valid', 'invalid']

const chevronUpIconHtml = icon(ChevronUp)
const chevronDownIconHtml = icon(ChevronDown)

export class NumberInput extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _inputId: string
    // Shared id for the reserved field-message slot, referenced by aria-describedby.
    private _helpId: string
    private _internals: ElementInternals
    private _defaultValue = ''

    onChange: ((value: number | '') => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'value',
            'step',
            'min',
            'max',
            'precision',
            'label',
            'name',
            'placeholder',
            'disabled',
            'required',
            'error',
            'state',
            'help',
            'prefix',
            'suffix',
        ]
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._inputId = `tc-number-input-${uid}`
        this._helpId = `tc-number-input-help-${uid}`
        this._internals = this.attachInternals()
    }

    // ── value ──────────────────────────────────────────────────────────────
    get value(): number | '' {
        const raw =
            this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value')
        if (raw === null || raw === '') return ''
        const n = parseFloat(raw)
        return isNaN(n) ? '' : n
    }
    set value(v: number | '') {
        const str = v === '' ? '' : String(v)
        const input = this.querySelector<HTMLInputElement>('input')
        if (input && input.value !== str) input.value = str
        if (v === '') this.removeAttribute('value')
        else this.setAttribute('value', str)
    }

    // ── step ───────────────────────────────────────────────────────────────
    get step(): number {
        const raw = this.getAttribute('step')
        if (raw === null) return 1
        const n = parseFloat(raw)
        return isNaN(n) || n <= 0 ? 1 : n
    }
    set step(v: number) {
        this.setAttribute('step', String(v))
    }

    // ── min ────────────────────────────────────────────────────────────────
    get min(): number | null {
        const raw = this.getAttribute('min')
        if (raw === null) return null
        const n = parseFloat(raw)
        return isNaN(n) ? null : n
    }
    set min(v: number | null) {
        if (v !== null) this.setAttribute('min', String(v))
        else this.removeAttribute('min')
    }

    // ── max ────────────────────────────────────────────────────────────────
    get max(): number | null {
        const raw = this.getAttribute('max')
        if (raw === null) return null
        const n = parseFloat(raw)
        return isNaN(n) ? null : n
    }
    set max(v: number | null) {
        if (v !== null) this.setAttribute('max', String(v))
        else this.removeAttribute('max')
    }

    // ── precision ──────────────────────────────────────────────────────────
    get precision(): number | null {
        const raw = this.getAttribute('precision')
        if (raw === null) return null
        const n = parseInt(raw, 10)
        return isNaN(n) || n < 0 ? null : n
    }
    set precision(v: number | null) {
        if (v !== null) this.setAttribute('precision', String(v))
        else this.removeAttribute('precision')
    }

    // ── label ──────────────────────────────────────────────────────────────
    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v !== null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    // ── error ──────────────────────────────────────────────────────────────
    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v !== null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    // ── help (hint text shown in the reserved message slot) ──────────────────
    get help(): string | null {
        return this.getAttribute('help')
    }
    set help(v: string | null) {
        if (v !== null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    // ── state ('valid' | 'invalid'); an `error` message forces 'invalid' ─────
    get state(): NumberInputState | null {
        const v = this.getAttribute('state') as NumberInputState
        return STATES.includes(v) ? v : null
    }
    set state(v: NumberInputState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    // ── name (form field name) ───────────────────────────────────────────────
    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v !== null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    // ── placeholder ──────────────────────────────────────────────────────────
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

    // ── prefix ─────────────────────────────────────────────────────────────
    get prefix(): string | null {
        return this.getAttribute('prefix')
    }
    set prefix(v: string | null) {
        if (v !== null) this.setAttribute('prefix', v)
        else this.removeAttribute('prefix')
    }

    // ── suffix ─────────────────────────────────────────────────────────────
    get suffix(): string | null {
        return this.getAttribute('suffix')
    }
    set suffix(v: string | null) {
        if (v !== null) this.setAttribute('suffix', v)
        else this.removeAttribute('suffix')
    }

    // ───────────────────────────────────────────────────────────────────────

    connectedCallback(): void {
        if (!this._initialised) {
            this._defaultValue = this.getAttribute('value') ?? ''
            this.render()
            this._initialised = true
        }
        this._attachListeners()
        this._syncForm()
    }

    disconnectedCallback(): void {
        this._detachListeners()
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        this.value = this._defaultValue === '' ? '' : Number(this._defaultValue)
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
            message:
                error || (requiredEmpty ? msg('fieldRequired') : 'Please enter a valid number.'),
            anchor: this.querySelector<HTMLInputElement>('input') ?? undefined,
        })
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            const input = this.querySelector<HTMLInputElement>('input')
            const str = next ?? ''
            if (input && input.value !== str) input.value = str
            this._updateStepperState()
            this._syncForm()
            return
        }
        const focusedInput = this.querySelector<HTMLInputElement>('input:focus')
        const selStart = focusedInput?.selectionStart ?? null
        const selEnd = focusedInput?.selectionEnd ?? null
        const wasFocused = focusedInput !== null
        this.render()
        this._attachListeners()
        this._syncForm()
        if (wasFocused) {
            const input = this.querySelector<HTMLInputElement>('input')
            if (input) {
                input.focus()
                if (selStart !== null && selEnd !== null) {
                    input.setSelectionRange(selStart, selEnd)
                }
            }
        }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Private helpers
    // ───────────────────────────────────────────────────────────────────────

    private _formatValue(n: number): string {
        const p = this.precision
        if (p !== null) return n.toFixed(p)
        // Format to remove floating point noise, e.g. 0.1 + 0.2 = 0.30000...
        return parseFloat(n.toPrecision(15)).toString()
    }

    private _clamp(n: number): number {
        const mn = this.min
        const mx = this.max
        if (mn !== null) n = Math.max(mn, n)
        if (mx !== null) n = Math.min(mx, n)
        return n
    }

    private _commit(newValue: number | ''): void {
        const prev = this.value
        if (prev === newValue) return
        if (newValue === '') {
            this.removeAttribute('value')
        } else {
            this.setAttribute('value', this._formatValue(newValue))
        }
        const input = this.querySelector<HTMLInputElement>('input')
        if (input) {
            input.value = newValue === '' ? '' : this._formatValue(newValue)
            if (newValue === '') input.removeAttribute('aria-valuenow')
            else input.setAttribute('aria-valuenow', String(newValue))
        }
        this._updateStepperState()
        this._syncForm()
        dispatchFieldChange(this, newValue)
        if (typeof this.onChange === 'function') this.onChange(newValue)
    }

    private _step(direction: 1 | -1): void {
        const current = this.value
        const step = this.step
        const base = current === '' ? 0 : (current as number)
        const raw = base + direction * step
        const clamped = this._clamp(parseFloat(raw.toPrecision(15)))
        this._commit(clamped)
    }

    private _onInputKeydown = (e: KeyboardEvent): void => {
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            this._step(1)
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            this._step(-1)
        }
    }

    private _onInputBlur = (e: FocusEvent): void => {
        const input = e.target as HTMLInputElement
        const raw = input.value.trim()
        if (raw === '') {
            this._commit('')
            return
        }
        const n = parseFloat(raw)
        if (isNaN(n)) {
            // Restore previous value
            const prev = this.value
            input.value = prev === '' ? '' : this._formatValue(prev as number)
            return
        }
        const clamped = this._clamp(n)
        this._commit(clamped)
    }

    private _onIncrement = (e: MouseEvent): void => {
        e.preventDefault()
        this._step(1)
        this.querySelector<HTMLInputElement>('input')?.focus()
    }

    private _onDecrement = (e: MouseEvent): void => {
        e.preventDefault()
        this._step(-1)
        this.querySelector<HTMLInputElement>('input')?.focus()
    }

    private _attachListeners(): void {
        const input = this.querySelector<HTMLInputElement>('input')
        const incBtn = this.querySelector<HTMLButtonElement>('.tc-number-input__inc')
        const decBtn = this.querySelector<HTMLButtonElement>('.tc-number-input__dec')

        if (input) {
            input.addEventListener('keydown', this._onInputKeydown)
            input.addEventListener('blur', this._onInputBlur)
        }
        if (incBtn) incBtn.addEventListener('click', this._onIncrement)
        if (decBtn) decBtn.addEventListener('click', this._onDecrement)
    }

    private _detachListeners(): void {
        const input = this.querySelector<HTMLInputElement>('input')
        const incBtn = this.querySelector<HTMLButtonElement>('.tc-number-input__inc')
        const decBtn = this.querySelector<HTMLButtonElement>('.tc-number-input__dec')

        if (input) {
            input.removeEventListener('keydown', this._onInputKeydown)
            input.removeEventListener('blur', this._onInputBlur)
        }
        if (incBtn) incBtn.removeEventListener('click', this._onIncrement)
        if (decBtn) decBtn.removeEventListener('click', this._onDecrement)
    }

    private _updateStepperState(): void {
        const current = this.value
        const mn = this.min
        const mx = this.max
        const decBtn = this.querySelector<HTMLButtonElement>('.tc-number-input__dec')
        const incBtn = this.querySelector<HTMLButtonElement>('.tc-number-input__inc')

        if (decBtn) {
            const atMin = mn !== null && current !== '' && (current as number) <= mn
            if (atMin) {
                decBtn.setAttribute('disabled', '')
                decBtn.setAttribute('aria-disabled', 'true')
            } else {
                decBtn.removeAttribute('disabled')
                decBtn.setAttribute('aria-disabled', 'false')
            }
        }
        if (incBtn) {
            const atMax = mx !== null && current !== '' && (current as number) >= mx
            if (atMax) {
                incBtn.setAttribute('disabled', '')
                incBtn.setAttribute('aria-disabled', 'true')
            } else {
                incBtn.removeAttribute('disabled')
                incBtn.setAttribute('aria-disabled', 'false')
            }
        }
    }

    private render(): void {
        const label = this.label
        const error = this.error
        const prefix = this.prefix
        const suffix = this.suffix
        const required = this.required
        const disabled = this.disabled
        const placeholder = this.placeholder
        const mn = this.min
        const mx = this.max
        const current = this.value
        const currentStr = current === '' ? '' : this._formatValue(current as number)
        // An `error` message forces the invalid state; `state` covers valid/invalid
        // without an accompanying message string.
        const state: NumberInputState | null = error ? 'invalid' : this.state
        const isInvalid = state === 'invalid'

        const atMin = mn !== null && current !== '' && (current as number) <= mn
        const atMax = mx !== null && current !== '' && (current as number) >= mx

        // The control points at the single reserved slot whenever it carries a
        // message (hint / valid / invalid) so SRs read it.
        const describe = error || state || this.help ? ` aria-describedby="${this._helpId}"` : ''
        const ariaInvalidAttr = isInvalid ? ' aria-invalid="true"' : ''
        const ariaRequiredAttr = required ? ' aria-required="true"' : ''
        const ariaDescribedBy = describe
        const ariaValueMin = mn !== null ? ` aria-valuemin="${mn}"` : ''
        const ariaValueMax = mx !== null ? ` aria-valuemax="${mx}"` : ''
        const ariaValueNow = current !== '' ? ` aria-valuenow="${current as number}"` : ''
        const placeholderAttr = placeholder ? ` placeholder="${esc(placeholder)}"` : ''
        const disabledAttr = disabled ? ' disabled' : ''

        const labelHtml =
            label !== null
                ? `<label class="tc-number-input__label form-label" for="${this._inputId}">${esc(label)}${requiredMark(required)}</label>`
                : ''

        const prefixHtml =
            prefix !== null
                ? `<span class="tc-number-input__addon tc-number-input__addon--prefix input-group-text">${esc(prefix)}</span>`
                : ''

        const suffixHtml =
            suffix !== null
                ? `<span class="tc-number-input__addon tc-number-input__addon--suffix input-group-text">${esc(suffix)}</span>`
                : ''

        const decDisabled =
            disabled || atMin ? ' disabled aria-disabled="true"' : ' aria-disabled="false"'
        const incDisabled =
            disabled || atMax ? ' disabled aria-disabled="true"' : ' aria-disabled="false"'

        const stepperHtml = [
            `<div class="tc-number-input__stepper">`,
            `<button type="button" class="tc-number-input__step-btn tc-number-input__inc"`,
            ` aria-label="Increase"${incDisabled}>${chevronUpIconHtml}</button>`,
            `<button type="button" class="tc-number-input__step-btn tc-number-input__dec"`,
            ` aria-label="Decrease"${decDisabled}>${chevronDownIconHtml}</button>`,
            `</div>`,
        ].join('')

        const inputGroupClass = isInvalid
            ? 'tc-number-input__group input-group tc-number-input__group--error'
            : 'tc-number-input__group input-group'

        // One reserved message slot below the group: invalid > valid > hint.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: 'Please enter a valid number.',
            validText: 'Looks good!',
        })

        this.innerHTML = [
            labelHtml,
            `<div class="${inputGroupClass}">`,
            prefixHtml,
            `<input`,
            ` id="${this._inputId}"`,
            ` class="tc-number-input__input form-control"`,
            ` type="text"`,
            ` inputmode="decimal"`,
            ` role="spinbutton"`,
            placeholderAttr,
            disabledAttr,
            ariaInvalidAttr,
            ariaRequiredAttr,
            ariaDescribedBy,
            ariaValueMin,
            ariaValueMax,
            ariaValueNow,
            currentStr !== '' ? ` value="${esc(currentStr)}"` : '',
            `>`,
            stepperHtml,
            suffixHtml,
            `</div>`,
            messageHtml,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: NumberInput
    }
}

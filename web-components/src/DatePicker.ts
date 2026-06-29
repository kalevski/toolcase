import { esc } from './internal/esc'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'
const TAG_NAME = 'tc-date-picker'

let _idCounter = 0

export type DatePickerState = 'valid' | 'invalid'

const STATES: DatePickerState[] = ['valid', 'invalid']

export class DatePicker extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _inputId: string
    // Stable id for the reserved message slot so the native input can
    // aria-describedby it (mirrors tc-select's _helpId pattern).
    private _helpId: string
    private _initialised = false
    private _internals: ElementInternals
    // Initial `value` attribute, captured on first connect for formResetCallback.
    private _defaultValue = ''

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'label',
            'value',
            'name',
            'required',
            'disabled',
            'min',
            'max',
            'help',
            'error',
            'state',
        ]
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._inputId = `tc-date-picker-${uid}`
        this._helpId = `tc-date-picker-help-${uid}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture the authored value so a form reset can restore it.
            this._defaultValue = this.getAttribute('value') ?? ''
            this.render()
            this._initialised = true
        }
        this.addEventListener('change', this._onNativeChange)
        this._syncForm()
    }

    disconnectedCallback(): void {
        this.removeEventListener('change', this._onNativeChange)
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

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            const input = this.querySelector<HTMLInputElement>('input')
            if (input && input.value !== (next ?? '')) input.value = next ?? ''
            this._syncForm()
            return
        }
        const hadFocus = this.querySelector('input') === document.activeElement
        this.render()
        // required/error/state changes shift effective validity, so re-sync.
        this._syncForm()
        if (hadFocus) this.querySelector<HTMLInputElement>('input')?.focus()
    }

    /** Push value + validity into the form. Effective invalid = error / state
     *  invalid / required-but-empty. */
    private _syncForm(): void {
        const value = this.value
        // Date value is a plain string (or null when empty).
        setFieldFormValue(this._internals, this.name, value === '' ? null : value)
        const error = this.error
        const requiredEmpty = this.required && value === ''
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message:
                error ||
                (requiredEmpty ? 'This field is required.' : 'Please provide a valid date.'),
            anchor: this.querySelector<HTMLInputElement>('input') ?? undefined,
        })
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get value(): string {
        return (
            this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value') ?? ''
        )
    }
    set value(v: string) {
        const input = this.querySelector<HTMLInputElement>('input')
        if (input) input.value = v
        this.setAttribute('value', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ── name (form field name) ───────────────────────────────────────────────
    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    // ── required ─────────────────────────────────────────────────────────────
    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    get min(): string | null {
        return this.getAttribute('min')
    }
    set min(v: string | null) {
        if (v != null) this.setAttribute('min', v)
        else this.removeAttribute('min')
    }

    get max(): string | null {
        return this.getAttribute('max')
    }
    set max(v: string | null) {
        if (v != null) this.setAttribute('max', v)
        else this.removeAttribute('max')
    }

    get help(): string | null {
        return this.getAttribute('help')
    }
    set help(v: string | null) {
        if (v != null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    get state(): DatePickerState | null {
        const v = this.getAttribute('state') as DatePickerState
        return STATES.includes(v) ? v : null
    }
    set state(v: DatePickerState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    private _onNativeChange = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (input.tagName !== 'INPUT') return
        const newValue = input.value
        this.setAttribute('value', newValue)
        // setAttribute triggers attributeChangedCallback → _syncForm, but call it
        // here too so the form sees the value before listeners react to tc-change.
        this._syncForm()
        // Canonical tc-change carries `detail: { value }` (shared contract).
        dispatchFieldChange(this, newValue)
        if (typeof this.onChange === 'function') this.onChange(newValue)
    }

    private render(): void {
        const label = this.label
        const disabled = this.disabled
        const required = this.required
        const min = this.min
        const max = this.max
        const error = this.error
        // A non-empty `error` forces the invalid state (matches tc-select).
        const state: DatePickerState | null = error ? 'invalid' : this.state
        const currentValue =
            this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value') ?? ''

        const disabledAttr = disabled ? ' disabled' : ''
        const requiredAttr = required ? ' required aria-required="true"' : ''
        const minAttr = min != null ? ` min="${esc(min)}"` : ''
        const maxAttr = max != null ? ` max="${esc(max)}"` : ''
        const valueAttr = currentValue ? ` value="${esc(currentValue)}"` : ''
        // The native .form-control already carries .is-invalid / .is-valid borders
        // from _input.scss, so just toggle the class.
        const stateClass =
            state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
        // Point aria-describedby at the slot only when it actually carries a message.
        const describe = this.help || state ? ` aria-describedby="${this._helpId}"` : ''

        const labelHtml =
            label != null
                ? `<label class="form-label" for="${this._inputId}">${esc(label)}${requiredMark(required)}</label>`
                : ''

        // One reserved message slot below the control (invalid > valid > hint).
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: 'Please provide a valid date.',
            validText: 'Looks good!',
        })

        this.innerHTML = [
            `<div class="tc-date-picker">`,
            labelHtml,
            `<input id="${this._inputId}" type="date" class="form-control${stateClass}"${minAttr}${maxAttr}${valueAttr}${requiredAttr}${disabledAttr}${describe}>`,
            messageHtml,
            `</div>`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DatePicker
    }
}

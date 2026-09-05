import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-range'

let _idCounter = 0

export type RangeState = 'valid' | 'invalid'

const STATES: RangeState[] = ['valid', 'invalid']

export class Range extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _inputId: string
    // Stable id for the reserved message slot (aria-describedby target).
    private _helpId: string
    private _initialised = false
    private _internals: ElementInternals
    // Initial `value` attribute, captured on first connect for formResetCallback.
    private _defaultValue: string | null = null

    static get observedAttributes(): string[] {
        return [
            'min',
            'max',
            'step',
            'value',
            'name',
            'required',
            'disabled',
            'label',
            'help',
            'error',
            'state',
        ]
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._inputId = `tc-range-${uid}`
        this._helpId = `tc-range-help-${uid}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture the authored value so a form reset can restore it.
            this._defaultValue = this.getAttribute('value')
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
        // Restore the authored value (or clear it so the native input recenters).
        if (this._defaultValue != null) this.setAttribute('value', this._defaultValue)
        else this.removeAttribute('value')
        const input = this.querySelector<HTMLInputElement>('input')
        if (input) input.value = this._defaultValue ?? input.value
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
        this.render()
        // A re-render replaces the native input, so rebind the change listener.
        this._attachListeners()
        // required/error/state changes shift effective validity, so re-sync.
        this._syncForm()
    }

    /** Push value + validity into the form. A native range always has a value, so
     *  required-but-empty never triggers; required just renders the asterisk/aria. */
    private _syncForm(): void {
        const value = this.value
        setFieldFormValue(this._internals, this.name, value === '' ? null : value)
        const error = this.error
        const invalid = !!error || this.state === 'invalid'
        reflectFieldValidity(this._internals, {
            invalid,
            message: error || 'Please select a valid value.',
            anchor: this.querySelector<HTMLInputElement>('input') ?? undefined,
        })
    }

    private _onNativeChange = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (input.tagName !== 'INPUT') return
        const newValue = input.value
        this.setAttribute('value', newValue)
        this._syncForm()
        // Range previously relied on the native `change` only; add the canonical
        // tc-change `detail: { value }` while leaving the native event intact.
        dispatchFieldChange(this, newValue)
    }

    private _attachListeners(): void {
        this._detachListeners()
        this.addEventListener('change', this._onNativeChange)
    }

    private _detachListeners(): void {
        this.removeEventListener('change', this._onNativeChange)
    }

    get min(): string {
        return this.getAttribute('min') ?? '0'
    }
    set min(v: string) {
        setAttr(this, 'min', v)
    }

    get max(): string {
        return this.getAttribute('max') ?? '100'
    }
    set max(v: string) {
        setAttr(this, 'max', v)
    }

    get step(): string | null {
        return this.getAttribute('step')
    }
    set step(v: string | null) {
        if (v != null) this.setAttribute('step', v)
        else this.removeAttribute('step')
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

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
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

    get state(): RangeState | null {
        const v = this.getAttribute('state') as RangeState
        return STATES.includes(v) ? v : null
    }
    set state(v: RangeState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    private render(): void {
        const label = this.label
        const min = this.min
        const max = this.max
        const step = this.step
        const disabled = this.disabled
        const required = this.required
        const error = this.error
        // A non-empty `error` forces the invalid state (matches tc-select).
        const state: RangeState | null = error ? 'invalid' : this.state
        const currentValue =
            this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value') ?? ''

        const stepAttr = step != null ? ` step="${esc(step)}"` : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const requiredAttr = required ? ' required aria-required="true"' : ''
        const valueAttr = currentValue !== '' ? ` value="${esc(currentValue)}"` : ''
        // .form-range isn't covered by _input.scss's .is-invalid selector, so the
        // invalid track treatment lives in _range.scss; we just toggle the class.
        const stateClass =
            state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
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
            invalidText: 'Please select a valid value.',
            validText: 'Looks good!',
        })

        patchHtml(
            this,
            [
                labelHtml,
                `<input id="${this._inputId}" type="range" class="form-range${stateClass}"`,
                ` min="${esc(min)}" max="${esc(max)}"${stepAttr}${valueAttr}${requiredAttr}${disabledAttr}${describe}>`,
                messageHtml,
            ].join(''),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Range
    }
}

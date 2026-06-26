import { esc } from './internal/esc'
import { fieldMessageHtml } from './internal/field-message'
import { setFieldFormValue, reflectFieldValidity, dispatchFieldChange } from './internal/form-field'
// tc-form-input — universal form-input dispatcher (port of react-components
// FormInput). A single light-DOM custom element whose `type` attribute selects
// which native control to render, with built-in validation, helper/error lines,
// and full ARIA wiring. Composes the established toolcase form classes
// (.form-control, .form-select, .form-check, .form-range) rather than the
// individual tc-* elements so it stays self-contained.

const TAG_NAME = 'tc-form-input'

let _idCounter = 0

export type FormInputType =
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'tel'
    | 'url'
    | 'search'
    | 'textarea'
    | 'dropdown'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'switch'
    | 'date'
    | 'time'
    | 'datetime'
    | 'color'
    | 'range'
    | 'file'

const TYPES: FormInputType[] = [
    'text',
    'email',
    'password',
    'number',
    'tel',
    'url',
    'search',
    'textarea',
    'dropdown',
    'select',
    'checkbox',
    'radio',
    'switch',
    'date',
    'time',
    'datetime',
    'color',
    'range',
    'file',
]

// Types whose control + label sit on one inline row (form-check motif).
const INLINE_TYPES: FormInputType[] = ['checkbox', 'switch']

export type ValidationResult = boolean | string | { valid: boolean; message?: string }

export type FormInputValidator = (value: unknown) => ValidationResult

export interface FormInputOption {
    value: string
    label: string
    disabled?: boolean
}

const isEmpty = (value: unknown): boolean => {
    if (value == null) return true
    if (typeof value === 'string') return value.trim() === ''
    if (typeof value === 'boolean') return value === false
    if (Array.isArray(value)) return value.length === 0
    return false
}

export class FormInput extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    // (Composes native controls, so the form would also see those directly; the
    // ElementInternals value is the single coerced/validated source of truth.)
    static formAssociated = true

    private _initialised = false
    private _inputId: string
    private _helpId: string
    private _internals: ElementInternals

    private _currentValue: unknown = undefined
    private _valueExplicit: unknown = undefined
    private _defaultValue: unknown = undefined
    // Snapshot of the value at first connect, restored by formResetCallback.
    private _resetValue: unknown = undefined
    private _options: FormInputOption[] = []
    private _slotOptions: FormInputOption[] = []
    private _validate: FormInputValidator | FormInputValidator[] | null = null
    private _onErrorMessage: ((result: Exclude<ValidationResult, true>) => string) | null = null
    private _lastSignature: string | null = null

    onChange: ((value: unknown, hasError: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'type',
            'label',
            'help',
            'helper',
            'error',
            'name',
            'id',
            'placeholder',
            'disabled',
            'required',
            'loading',
            'min',
            'max',
            'step',
            'rows',
        ]
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._inputId = `tc-form-input-${uid}`
        this._helpId = `tc-form-input-help-${uid}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._captureSlotOptions()
            this._currentValue =
                this._valueExplicit !== undefined ? this._valueExplicit : this._defaultValue
            // Remember the initial value so a native form reset can restore it.
            this._resetValue = this._currentValue
            this.render()
            this._initialised = true
            this._runValidation(false)
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('input', this._onControlEvent)
        this.addEventListener('change', this._onControlEvent)
    }

    disconnectedCallback(): void {
        this.removeEventListener('input', this._onControlEvent)
        this.removeEventListener('change', this._onControlEvent)
    }

    /** Restore the value captured at first connect when the form resets, then
     *  re-run validation so the slot/validity reflect the reset state. */
    formResetCallback(): void {
        this._valueExplicit = this._resetValue
        this._currentValue = this._resetValue
        if (this._initialised) {
            this.render()
            this._runValidation(false)
        }
    }

    /** Mirror a containing fieldset/form disabling into the host attribute. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        // Keep the current value across structural re-renders.
        this._currentValue = this._getValue()
        this.render()
        this._runValidation(false)
    }

    // ── Attribute-backed props ──────────────────────────────────────────────

    get type(): FormInputType {
        const v = this.getAttribute('type') as FormInputType
        return TYPES.includes(v) ? v : 'text'
    }
    set type(v: FormInputType) {
        this.setAttribute('type', v)
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get help(): string | null {
        return this.getAttribute('help') ?? this.getAttribute('helper')
    }
    set help(v: string | null) {
        if (v != null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    get helper(): string | null {
        return this.help
    }
    set helper(v: string | null) {
        if (v != null) this.setAttribute('helper', v)
        else this.removeAttribute('helper')
    }

    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? ''
    }
    set placeholder(v: string) {
        this.setAttribute('placeholder', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ── JS-property props ───────────────────────────────────────────────────

    get value(): unknown {
        return this._initialised ? this._getValue() : this._valueExplicit
    }
    set value(v: unknown) {
        this._valueExplicit = v
        this._currentValue = v
        if (this._initialised) {
            this.render()
            this._runValidation(false)
        }
    }

    get defaultValue(): unknown {
        return this._defaultValue
    }
    set defaultValue(v: unknown) {
        this._defaultValue = v
        if (this._valueExplicit === undefined) {
            this._currentValue = v
            if (this._initialised) {
                this.render()
                this._runValidation(false)
            }
        }
    }

    get options(): FormInputOption[] {
        return this._options
    }
    set options(v: FormInputOption[]) {
        this._options = Array.isArray(v) ? v : []
        if (this._initialised) {
            this.render()
            this._runValidation(false)
        }
    }

    get validate(): FormInputValidator | FormInputValidator[] | null {
        return this._validate
    }
    set validate(v: FormInputValidator | FormInputValidator[] | null) {
        this._validate = v
        if (this._initialised) this._runValidation(false)
    }

    get onErrorMessage(): ((result: Exclude<ValidationResult, true>) => string) | null {
        return this._onErrorMessage
    }
    set onErrorMessage(v: ((result: Exclude<ValidationResult, true>) => string) | null) {
        this._onErrorMessage = typeof v === 'function' ? v : null
        if (this._initialised) this._runValidation(false)
    }

    // ── Slotted <option> capture ────────────────────────────────────────────

    private _captureSlotOptions(): void {
        const children = Array.from(this.children).filter((c) => {
            const t = c.tagName.toLowerCase()
            return t === 'option' || t === 'tc-option'
        })
        if (children.length === 0) return
        this._slotOptions = children.map((c) => ({
            value: c.getAttribute('value') ?? c.textContent?.trim() ?? '',
            label: c.textContent?.trim() ?? '',
            disabled: c.hasAttribute('disabled'),
        }))
    }

    private _optionList(): FormInputOption[] {
        return this._options.length > 0 ? this._options : this._slotOptions
    }

    private _hasOptions(): boolean {
        return this._optionList().length > 0
    }

    // ── Value reading / coercion ────────────────────────────────────────────

    private _getValue(): unknown {
        const type = this.type
        if (type === 'checkbox' || type === 'switch') {
            const input = this.querySelector<HTMLInputElement>('input.form-check-input')
            return input ? input.checked : false
        }
        if (type === 'radio') {
            if (this._hasOptions()) {
                const checked = this.querySelector<HTMLInputElement>(
                    'input.form-check-input:checked',
                )
                return checked ? checked.value : ''
            }
            const input = this.querySelector<HTMLInputElement>('input.form-check-input')
            return input ? input.checked : false
        }
        if (type === 'dropdown' || type === 'select') {
            const sel = this.querySelector<HTMLSelectElement>('select')
            return sel ? sel.value : ''
        }
        if (type === 'number' || type === 'range') {
            const input = this.querySelector<HTMLInputElement>('input')
            if (!input) return ''
            return input.value === '' ? '' : Number(input.value)
        }
        const ctrl = this.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
        return ctrl ? ctrl.value : ''
    }

    // ── Validation ──────────────────────────────────────────────────────────

    private _validators(): FormInputValidator[] {
        if (!this._validate) return []
        return Array.isArray(this._validate) ? this._validate : [this._validate]
    }

    private _deriveMessage(result: Exclude<ValidationResult, true>): string {
        if (this._onErrorMessage) {
            try {
                const m = this._onErrorMessage(result)
                if (typeof m === 'string' && m.length > 0) return m
            } catch {
                /* fall through */
            }
        }
        if (typeof result === 'string') return result
        if (result && typeof result === 'object' && typeof result.message === 'string')
            return result.message
        return 'Invalid value'
    }

    private _computeValidationMessage(value: unknown): string | null {
        for (const validator of this._validators()) {
            let result: ValidationResult
            try {
                result = validator(value)
            } catch {
                continue
            }
            if (result === true || result == null) continue
            if (typeof result === 'string') {
                if (result.trim() === '') continue
                return this._deriveMessage(result)
            }
            if (typeof result === 'object') {
                if (result.valid === true) continue
                return this._deriveMessage(result)
            }
            // result === false
            return this._deriveMessage(result)
        }
        if (this.required && isEmpty(value)) return 'This field is required'
        return null
    }

    private _runValidation(dispatch: boolean): boolean {
        const value = this._currentValue
        const forced = this.getAttribute('error')
        const message = forced && forced.length > 0 ? forced : this._computeValidationMessage(value)
        const hasError = message != null
        this._applyValidationState(message, hasError)
        if (dispatch) {
            const sig = `${hasError}::${JSON.stringify(value ?? null)}`
            if (sig === this._lastSignature) return hasError
            this._lastSignature = sig
            // Canonical tc-change carries only `{ value }` for cross-component
            // uniformity; hasError stays available through the onChange callback.
            dispatchFieldChange(this, value)
            if (typeof this.onChange === 'function') this.onChange(value, hasError)
        }
        return hasError
    }

    private _applyValidationState(message: string | null, hasError: boolean): void {
        this.classList.toggle('tc-form-input--error', hasError)

        // Push the coerced value + validity into the form. _currentValue is already
        // the coerced shape (_getValue: boolean for checkbox/switch/optionless radio,
        // number for number/range, string otherwise). For the boolean controls the
        // native checkbox submits "on" when checked, which is setFieldFormValue's
        // default trueValue — so no per-control value lookup is needed here.
        const value = this._currentValue
        setFieldFormValue(this._internals, this.name, value == null ? null : value)
        reflectFieldValidity(this._internals, {
            invalid: hasError,
            message: message ?? 'Invalid value',
            anchor:
                this.querySelector<HTMLElement>(
                    '.form-control, .form-select, .form-range, .form-check-input',
                ) ?? undefined,
        })

        // Swap the reserved slot's contents in place (control is untouched, so a
        // focused field is never disrupted). Invalid shows the message; otherwise
        // it falls back to the hint, keeping the same reserved height either way.
        const slot = this.querySelector('.tc-field-message')
        if (slot) {
            slot.outerHTML = fieldMessageHtml({
                id: this._helpId,
                error: hasError ? (message ?? '') : null,
                hint: this.help,
            })
        }

        const describedBy = this.help || hasError ? this._helpId : ''

        const controls = this.querySelectorAll<HTMLElement>(
            '.form-control, .form-select, .form-range, .form-check-input',
        )
        controls.forEach((ctrl) => {
            ctrl.classList.toggle('is-invalid', hasError)
            if (hasError) ctrl.setAttribute('aria-invalid', 'true')
            else ctrl.removeAttribute('aria-invalid')
            if (describedBy) ctrl.setAttribute('aria-describedby', describedBy)
            else ctrl.removeAttribute('aria-describedby')
        })
    }

    private _onControlEvent = (): void => {
        if (this.loading) return
        this._currentValue = this._getValue()
        this._runValidation(true)
    }

    // ── Rendering ───────────────────────────────────────────────────────────

    private render(): void {
        this.classList.add('tc-form-input')
        this.classList.add(`tc-form-input--${this.type}`)
        // Drop stale type modifiers from a previous render.
        TYPES.forEach((t) => {
            if (t !== this.type) this.classList.remove(`tc-form-input--${t}`)
        })

        if (this.loading) {
            this.setAttribute('aria-busy', 'true')
            this.innerHTML = this._renderLoading()
            return
        }
        this.removeAttribute('aria-busy')

        const type = this.type
        const inline = INLINE_TYPES.includes(type) || (type === 'radio' && !this._hasOptions())

        // One reserved slot below the control; _runValidation() fills it with the
        // error message when invalid, otherwise it shows the hint (or stays empty
        // but height-reserved). Always present so the field never changes height.
        const messageHtml = fieldMessageHtml({ id: this._helpId, hint: this.help })

        if (inline) {
            this.innerHTML = [this._renderInlineControl(), messageHtml].join('')
        } else {
            this.innerHTML = [this._renderLabel(), this._renderControl(), messageHtml].join('')
        }

        // Restore current value into freshly-built controls where needed.
        this._seedControlValue()
    }

    private _renderLoading(): string {
        const labelHtml = this.label
            ? `<div class="tc-form-input-label">${esc(this.label)}</div>`
            : ''
        return [
            labelHtml,
            `<div class="tc-form-input-loading" aria-hidden="true">`,
            `<span class="spinner-border spinner-border-sm" role="status"></span>`,
            `<span class="tc-form-input-loading-bar"></span>`,
            `</div>`,
            `<span class="visually-hidden">Loading…</span>`,
        ].join('')
    }

    private _renderLabel(): string {
        if (!this.label) return ''
        const req = this.required
            ? `<span class="tc-form-input-required" aria-hidden="true">*</span>`
            : ''
        return `<label class="tc-form-input-label" for="${this._inputId}">${esc(this.label)}${req}</label>`
    }

    private _commonAttrs(): string {
        const parts: string[] = []
        // No `name` on the inner native control: the host is formAssociated and
        // submits the coerced value through ElementInternals under its own `name`.
        // A name here would double-submit. (Radio grouping uses an internal name —
        // see _renderRadioGroup.)
        if (this.disabled) parts.push('disabled')
        if (this.required) parts.push('required aria-required="true"')
        return parts.length ? ` ${parts.join(' ')}` : ''
    }

    private _minMaxStep(): string {
        const parts: string[] = []
        const min = this.getAttribute('min')
        const max = this.getAttribute('max')
        const step = this.getAttribute('step')
        if (min != null) parts.push(`min="${esc(min)}"`)
        if (max != null) parts.push(`max="${esc(max)}"`)
        if (step != null) parts.push(`step="${esc(step)}"`)
        return parts.length ? ` ${parts.join(' ')}` : ''
    }

    private _valueAttr(): string {
        const v = this._currentValue
        if (v == null || v === '') return ''
        return ` value="${esc(String(v))}"`
    }

    private _renderControl(): string {
        const type = this.type
        const id = this._inputId
        const ph = this.placeholder ? ` placeholder="${esc(this.placeholder)}"` : ''

        switch (type) {
            case 'textarea': {
                const rows = this.getAttribute('rows')
                const rowsAttr = rows ? ` rows="${esc(rows)}"` : ''
                const content = this._currentValue != null ? esc(String(this._currentValue)) : ''
                return `<textarea id="${id}" class="form-control"${ph}${rowsAttr}${this._commonAttrs()}>${content}</textarea>`
            }
            case 'dropdown':
            case 'select':
                return this._renderSelect()
            case 'radio':
                return this._renderRadioGroup()
            case 'range':
                return `<input id="${id}" type="range" class="form-range"${this._valueAttr()}${this._minMaxStep()}${this._commonAttrs()}>`
            case 'color': {
                const v =
                    this._currentValue != null && this._currentValue !== ''
                        ? String(this._currentValue)
                        : '#1e293b'
                return `<input id="${id}" type="color" class="form-control tc-form-input-color" value="${esc(v)}"${this._commonAttrs()}>`
            }
            case 'file':
                return `<input id="${id}" type="file" class="form-control"${this._commonAttrs()}>`
            default: {
                const native = nativeType(type)
                return `<input id="${id}" type="${native}" class="form-control"${ph}${this._valueAttr()}${this._minMaxStep()}${this._commonAttrs()}>`
            }
        }
    }

    private _renderSelect(): string {
        const id = this._inputId
        const current = this._currentValue != null ? String(this._currentValue) : ''
        const ph = this.placeholder
            ? `<option value="" disabled${current === '' ? ' selected' : ''}>${esc(this.placeholder)}</option>`
            : ''
        const opts = this._optionList()
            .map((o) => {
                const sel = String(o.value) === current ? ' selected' : ''
                const dis = o.disabled ? ' disabled' : ''
                return `<option value="${esc(String(o.value))}"${sel}${dis}>${esc(o.label)}</option>`
            })
            .join('')
        return `<select id="${id}" class="form-select"${this._commonAttrs()}>${ph}${opts}</select>`
    }

    private _renderRadioGroup(): string {
        // Internal-only group name (not this.name): the radios share it for native
        // single-selection grouping, while form submission flows through the host's
        // ElementInternals under the user's `name`. Avoids double submission.
        const name = `${this._inputId}-group`
        const current = this._currentValue != null ? String(this._currentValue) : ''
        const rows = this._optionList()
            .map((o, idx) => {
                const optId = `${this._inputId}-${idx}`
                const checked = String(o.value) === current ? ' checked' : ''
                const dis = o.disabled || this.disabled ? ' disabled' : ''
                return [
                    `<div class="form-check">`,
                    `<input class="form-check-input" type="radio" name="${esc(name)}" id="${optId}" value="${esc(String(o.value))}"${checked}${dis}>`,
                    `<label class="form-check-label" for="${optId}">${esc(o.label)}</label>`,
                    `</div>`,
                ].join('')
            })
            .join('')
        const reqAttr = this.required ? ' aria-required="true"' : ''
        return `<div class="tc-form-input-radio-group" role="radiogroup"${reqAttr}>${rows}</div>`
    }

    private _renderInlineControl(): string {
        const type = this.type
        const id = this._inputId
        const checked = isEmpty(this._currentValue) ? '' : ' checked'
        const isSwitch = type === 'switch'
        const wrapClass = isSwitch ? 'form-check form-switch' : 'form-check'
        const inputType = type === 'radio' ? 'radio' : 'checkbox'
        const req = this.required
            ? `<span class="tc-form-input-required" aria-hidden="true">*</span>`
            : ''
        const labelText = this.label ? `${esc(this.label)}${req}` : ''
        const labelHtml = labelText
            ? `<label class="form-check-label" for="${id}">${labelText}</label>`
            : ''
        return [
            `<div class="${wrapClass}">`,
            `<input class="form-check-input" type="${inputType}" id="${id}"${checked}${this._commonAttrs()}>`,
            labelHtml,
            `</div>`,
        ].join('')
    }

    private _seedControlValue(): void {
        const type = this.type
        if (type === 'dropdown' || type === 'select') {
            const sel = this.querySelector<HTMLSelectElement>('select')
            const current = this._currentValue != null ? String(this._currentValue) : ''
            if (sel && current) sel.value = current
        }
    }
}

function nativeType(type: FormInputType): string {
    if (type === 'datetime') return 'datetime-local'
    return type
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FormInput
    }
}

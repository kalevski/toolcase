import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { fieldMessageHtml } from './internal/field-message'
import { setFieldFormValue, reflectFieldValidity, dispatchFieldChange } from './internal/form-field'
import { msg } from './messages'
import { setAttr } from './internal/tc-element'
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

/** When validation feedback becomes visible. Validity itself is always kept
 *  current on the ElementInternals (so form gating works); this only controls
 *  the visual error treatment. */
export type FormInputValidateOn = 'blur' | 'input' | 'submit' | 'mount'
const VALIDATE_ON: FormInputValidateOn[] = ['blur', 'input', 'submit', 'mount']

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

    // Interaction lifecycle: pristine → touched (blur) → dirty (input) →
    // submitted. Errors only render once the gate for `validate-on` is passed.
    private _touched = false
    private _dirty = false
    private _submitted = false

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
            'validate-on',
            'required-message',
            // Software-keyboard hints, passed through to the native control.
            'inputmode',
            'enterkeyhint',
            'autocomplete',
            // Opt back in to the reserved one-line message gutter.
            'reserve-message',
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
        this.addEventListener('focusout', this._onFocusout)
        // Native `invalid` fires on the host (form-associated) and on the inner
        // controls when a containing form submits/reports — it does not bubble,
        // so listen in the capture phase to catch both. That is the submit gate.
        this.addEventListener('invalid', this._onInvalid, true)
    }

    disconnectedCallback(): void {
        this.removeEventListener('input', this._onControlEvent)
        this.removeEventListener('change', this._onControlEvent)
        this.removeEventListener('focusout', this._onFocusout)
        this.removeEventListener('invalid', this._onInvalid, true)
    }

    /** Restore the value captured at first connect when the form resets, then
     *  re-run validation so the slot/validity reflect the reset state. */
    formResetCallback(): void {
        this._valueExplicit = this._resetValue
        this._currentValue = this._resetValue
        // A reset field is pristine again — no error chrome until re-interaction.
        this._touched = false
        this._dirty = false
        this._submitted = false
        if (this._initialised) {
            this.render()
            this._runValidation(false)
        }
    }

    /** Mirror a containing fieldset/form disabling into the host attribute. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    /**
     * THE CONTROLLED-INPUT CONTRACT.
     *
     * Nothing here rebuilds the control unless the control itself has to change.
     * A full `render()` replaces the inner `<input>`, and replacing a focused
     * input drops the caret to the end of the text — so a host that showed a
     * validation message while someone typed, or flipped `disabled` on submit,
     * used to yank the field out from under them. That is why consumers ended up
     * writing the field as UNCONTROLLED with a `key` remount.
     *
     * Only two attributes genuinely need new markup: `type` (a different native
     * control) and `loading` (the skeleton replaces the control outright).
     * Everything else patches the existing nodes.
     */
    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return

        // Purely a CSS hook on the host (see the reserve-message note above) —
        // the message slot is always rendered, so there is nothing to update.
        if (name === 'reserve-message') return

        // Only these two change which control exists.
        if (name === 'type' || name === 'loading') {
            this._syncCurrentFromControl()
            this.render()
            this._runValidation(false)
            return
        }

        switch (name) {
            case 'error':
            case 'help':
            case 'helper':
            case 'validate-on':
            case 'required-message':
            case 'name':
            case 'id':
                // Message slot / validity only — _runValidation patches both in place.
                break
            case 'disabled':
                this._patchDisabled()
                break
            case 'required':
                this._patchRequired()
                break
            case 'label':
                if (!this._patchLabelText()) {
                    // A label appearing or disappearing adds or removes a node, so
                    // this one case does need the markup back. It cannot happen
                    // mid-keystroke the way `error` can.
                    this._syncCurrentFromControl()
                    this.render()
                }
                break
            case 'placeholder':
                if (!this._patchPlaceholder()) {
                    this._syncCurrentFromControl()
                    this.render()
                }
                break
            case 'min':
            case 'max':
            case 'step':
                this._patchConstraints()
                break
            case 'rows':
                this._patchRows()
                break
            case 'inputmode':
            case 'enterkeyhint':
            case 'autocomplete':
                this._patchKeyboardAttrs()
                break
            default:
                this._syncCurrentFromControl()
                this.render()
                break
        }

        this._syncCurrentFromControl()
        this._runValidation(false)
    }

    /** Re-read the live control into `_currentValue`. Guarded on the control
     *  actually existing: while `loading` renders the skeleton there is nothing
     *  to read, and reading anyway would silently reset the field to ''. */
    private _syncCurrentFromControl(): void {
        if (this.querySelector('input, textarea, select')) this._currentValue = this._getValue()
    }

    // ── Attribute-backed props ──────────────────────────────────────────────

    get type(): FormInputType {
        const v = this.getAttribute('type') as FormInputType
        return TYPES.includes(v) ? v : 'text'
    }
    set type(v: FormInputType) {
        setAttr(this, 'type', v)
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
        setAttr(this, 'placeholder', v)
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

    /** When error feedback becomes visible: 'blur' (default), 'input',
     *  'submit', or 'mount' (the pre-5.1 eager behaviour). */
    get validateOn(): FormInputValidateOn {
        const v = this.getAttribute('validate-on') as FormInputValidateOn
        return VALIDATE_ON.includes(v) ? v : 'blur'
    }
    set validateOn(v: FormInputValidateOn) {
        setAttr(this, 'validate-on', v)
    }

    /** Per-instance override of the registry's `fieldRequired` message. */
    get requiredMessage(): string | null {
        return this.getAttribute('required-message')
    }
    set requiredMessage(v: string | null) {
        if (v != null) this.setAttribute('required-message', v)
        else this.removeAttribute('required-message')
    }

    // ── Software-keyboard hints ─────────────────────────────────────────────
    //
    // WHY THESE ARE FIRST-CLASS AND NOT "just pass any attribute through".
    // On a phone, the difference between a correct and a wrong on-screen keyboard
    // is the difference between typing a weight in two taps and hunting for the
    // decimal point behind a shift layer. `type` already implies most of it, so the
    // element supplies the implication (see _keyboardAttrs) and these three
    // attributes are the per-field override.

    /** `inputmode` on the rendered control. Absent → derived from `type`. */
    get inputMode(): string {
        return this.getAttribute('inputmode') ?? ''
    }
    set inputMode(v: string) {
        if (v) this.setAttribute('inputmode', v)
        else this.removeAttribute('inputmode')
    }

    /** The Enter key's label. Absent → `search` for `type="search"`, else the UA default. */
    get enterKeyHint(): string {
        return this.getAttribute('enterkeyhint') ?? ''
    }
    set enterKeyHint(v: string) {
        if (v) this.setAttribute('enterkeyhint', v)
        else this.removeAttribute('enterkeyhint')
    }

    /** `autocomplete` on the rendered control. Absent → derived from `type`. */
    get autocomplete(): string {
        return this.getAttribute('autocomplete') ?? ''
    }
    set autocomplete(v: string) {
        if (v) this.setAttribute('autocomplete', v)
        else this.removeAttribute('autocomplete')
    }

    /**
     * Reserve one line of height under the control for the hint / error message,
     * so a row of fields stays aligned whether or not any of them has a message.
     *
     * OFF BY DEFAULT — this reverses the pre-5.2 behaviour. The gutter was always
     * reserved, which cost ~19px of invisible height under every field, and on a
     * phone that is a third of a control. It also forced every toolbar containing a
     * tc-form-input to `align-items: start`, because centring a field that carries a
     * phantom row below it lifts the field above its neighbours.
     *
     * The slot is still always RENDERED (the validation code patches it in place);
     * `reserve-message` only controls whether an EMPTY slot keeps its line of
     * height. See `.tc-form-input:not([reserve-message]) > .tc-field-message:empty`
     * in style/components/_form-input.scss.
     */
    get reserveMessage(): boolean {
        return this.hasAttribute('reserve-message')
    }
    set reserveMessage(v: boolean) {
        if (v) this.setAttribute('reserve-message', '')
        else this.removeAttribute('reserve-message')
    }

    // ── JS-property props ───────────────────────────────────────────────────

    get value(): unknown {
        if (!this._initialised) return this._valueExplicit
        // While `loading` is on there is no control to read; the last known value
        // is the honest answer, not the '' an absent control would report.
        return this.querySelector('input, textarea, select') ? this._getValue() : this._currentValue
    }
    /**
     * Assigning `value` never re-renders. The inner control is written directly
     * and only when it differs, so the caret and selection survive — which is
     * what makes `<tc-form-input value={state} ontc-change={…} />` work as a
     * controlled React input. A programmatic write also never emits `tc-change`
     * (only user input does), or a controlled field would feed back into itself.
     */
    set value(v: unknown) {
        this._valueExplicit = v
        this._currentValue = v
        if (!this._initialised) return
        if (!this._writeControlValue(v)) this.render()
        this._runValidation(false)
    }

    get defaultValue(): unknown {
        return this._defaultValue
    }
    set defaultValue(v: unknown) {
        this._defaultValue = v
        if (this._valueExplicit !== undefined) return
        this._currentValue = v
        if (!this._initialised) return
        if (!this._writeControlValue(v)) this.render()
        this._runValidation(false)
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
        // querySelectorAll, not a childNodes snapshot: these nodes are READ for
        // their value/label and never moved — a capture list would read like the
        // re-parenting rule 1 forbids.
        const children = Array.from(this.querySelectorAll(':scope > option, :scope > tc-option'))
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
        return msg('invalidValue')
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
        if (this.required && isEmpty(value)) return this.requiredMessage ?? msg('fieldRequired')
        return null
    }

    /** Whether the current error (if any) should be visually rendered yet.
     *  A consumer-forced `error` attribute always shows. */
    private _shouldShowValidation(forced: boolean): boolean {
        if (forced) return true
        switch (this.validateOn) {
            case 'mount':
                return true
            case 'submit':
                return this._submitted
            case 'input':
                return this._submitted || this._dirty || this._touched
            default:
                return this._submitted || this._touched
        }
    }

    /** Mark as submitted, surface any error, and (when invalid) trigger the
     *  browser's native report UI. Mirrors HTMLInputElement.reportValidity. */
    reportValidity(): boolean {
        this._submitted = true
        const hasError = this._runValidation(false)
        if (hasError) this._internals.reportValidity()
        return !hasError
    }

    checkValidity(): boolean {
        return this._internals.checkValidity()
    }

    /** Return the field to its pristine (no visible errors) state without
     *  touching the value. */
    resetValidity(): void {
        this._touched = false
        this._dirty = false
        this._submitted = false
        this._runValidation(false)
    }

    private _runValidation(dispatch: boolean): boolean {
        const value = this._currentValue
        const forced = this.getAttribute('error')
        const message = forced && forced.length > 0 ? forced : this._computeValidationMessage(value)
        const hasError = message != null
        const show = hasError && this._shouldShowValidation(!!forced && forced.length > 0)
        this._applyValidationState(message, hasError, show)
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

    private _applyValidationState(message: string | null, hasError: boolean, show: boolean): void {
        // Visual error chrome is gated on interaction (`show`); the internals
        // below always carry the real validity so form submission gating and
        // checkValidity() stay accurate from the first render.
        this.classList.toggle('tc-form-input--error', show)

        // Push the coerced value + validity into the form. _currentValue is already
        // the coerced shape (_getValue: boolean for checkbox/switch/optionless radio,
        // number for number/range, string otherwise). For the boolean controls the
        // native checkbox submits "on" when checked, which is setFieldFormValue's
        // default trueValue — so no per-control value lookup is needed here.
        const value = this._currentValue
        setFieldFormValue(this._internals, this.name, value == null ? null : value)
        reflectFieldValidity(this._internals, {
            invalid: hasError,
            message: message ?? msg('invalidValue'),
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
                error: show ? (message ?? '') : null,
                hint: this.help,
            })
        }

        const describedBy = this.help || show ? this._helpId : ''

        const controls = this.querySelectorAll<HTMLElement>(
            '.form-control, .form-select, .form-range, .form-check-input',
        )
        controls.forEach((ctrl) => {
            ctrl.classList.toggle('is-invalid', show)
            if (show) ctrl.setAttribute('aria-invalid', 'true')
            else ctrl.removeAttribute('aria-invalid')
            if (describedBy) ctrl.setAttribute('aria-describedby', describedBy)
            else ctrl.removeAttribute('aria-describedby')
        })
    }

    private _onControlEvent = (): void => {
        if (this.loading) return
        this._dirty = true
        this._currentValue = this._getValue()
        this._runValidation(true)
    }

    // Leaving any inner control marks the field touched (the `blur` gate).
    private _onFocusout = (): void => {
        if (this.loading || this._touched) return
        this._touched = true
        this._runValidation(false)
    }

    // A form-level submit/reportValidity rejected this field — from now on the
    // error is visible regardless of the interaction gate.
    private _onInvalid = (): void => {
        if (this._submitted) return
        this._submitted = true
        this._runValidation(false)
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
            patchHtml(this, this._renderLoading())
            return
        }
        this.removeAttribute('aria-busy')

        const type = this.type
        const inline = INLINE_TYPES.includes(type) || (type === 'radio' && !this._hasOptions())

        // One message slot below the control; _runValidation() fills it with the
        // error message when invalid, otherwise it shows the hint. ALWAYS RENDERED —
        // the validation code patches this node in place, so making it conditional
        // would mean an error had nowhere to appear. Whether an EMPTY slot keeps a
        // line of height is the `reserve-message` question, decided in CSS.
        const messageHtml = fieldMessageHtml({ id: this._helpId, hint: this.help })

        if (inline) {
            patchHtml(this, [this._renderInlineControl(), messageHtml].join(''))
        } else {
            patchHtml(this, [this._renderLabel(), this._renderControl(), messageHtml].join(''))
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
            `<span class="visually-hidden">${esc(msg('loading'))}</span>`,
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

    /**
     * `inputmode` / `enterkeyhint` / `autocomplete` for the rendered control: the
     * host's attribute when present, otherwise the one the `type` implies.
     *
     * Only unambiguous implications are supplied. `password` deliberately gets NO
     * autocomplete default — `current-password` and `new-password` are opposite
     * instructions to a password manager and only the consumer knows which form
     * this is, so guessing here would be worse than omitting it.
     */
    private _keyboardAttrs(): string {
        const parts = this._keyboardAttrEntries().map(([k, v]) => `${k}="${esc(v)}"`)
        return parts.length ? ` ${parts.join(' ')}` : ''
    }

    /** The resolved `inputmode` / `enterkeyhint` / `autocomplete` pairs. Shared by
     *  the render path (which stringifies them) and the in-place patch path. */
    private _keyboardAttrEntries(): Array<[string, string]> {
        const type = this.type
        const parts: Array<[string, string]> = []

        const explicitMode = this.getAttribute('inputmode')
        // `decimal` and not `numeric` for numbers: `numeric` is the PIN pad, with no
        // decimal separator — wrong for every weight, price and portion in a recipe.
        const impliedMode =
            type === 'number'
                ? 'decimal'
                : type === 'tel'
                  ? 'tel'
                  : type === 'email'
                    ? 'email'
                    : type === 'url'
                      ? 'url'
                      : type === 'search'
                        ? 'search'
                        : null
        const mode = explicitMode ?? impliedMode
        if (mode) parts.push(['inputmode', mode])

        // The Enter key's LABEL, not its behaviour: a search field whose Enter key
        // reads „go" instead of a newline glyph is the affordance that tells someone
        // the field submits.
        const hint = this.getAttribute('enterkeyhint') ?? (type === 'search' ? 'search' : null)
        if (hint) parts.push(['enterkeyhint', hint])

        const explicitAuto = this.getAttribute('autocomplete')
        const impliedAuto =
            type === 'email'
                ? 'email'
                : type === 'tel'
                  ? 'tel'
                  : type === 'url'
                    ? 'url'
                    : // A search box has nothing to autofill, and an autofill dropdown
                      // over a live result list is a fight the results lose.
                      type === 'search'
                      ? 'off'
                      : null
        const auto = explicitAuto ?? impliedAuto
        if (auto) parts.push(['autocomplete', auto])

        return parts
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
                return `<textarea id="${id}" class="form-control"${ph}${rowsAttr}${this._keyboardAttrs()}${this._commonAttrs()}>${content}</textarea>`
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
                return `<input id="${id}" type="${native}" class="form-control"${ph}${this._valueAttr()}${this._minMaxStep()}${this._keyboardAttrs()}${this._commonAttrs()}>`
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

    // ── In-place patching (the controlled-input contract) ───────────────────
    //
    // Each of these updates the already-rendered control instead of rebuilding
    // it. Returning `false` means "this change needs new markup" and the caller
    // falls back to render() — which is the exception, not the rule.

    /** Every rendered native control inside the field, in document order. */
    private _controls(): HTMLInputElement[] {
        return Array.from(
            this.querySelectorAll<HTMLInputElement>(
                '.form-control, .form-select, .form-range, .form-check-input',
            ),
        )
    }

    /** The control the field's own `value` lives in, if one is rendered. */
    private _valueControl(): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
        return this.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            'input, textarea, select',
        )
    }

    /**
     * Write `v` into the rendered control without touching any other node.
     * Returns false when the value cannot be expressed against the current
     * markup — an unrendered control, or a select whose option list does not
     * contain the value — in which case the caller re-renders.
     */
    private _writeControlValue(v: unknown): boolean {
        const type = this.type
        // The skeleton has no control; _currentValue already holds the value and
        // the next render (when `loading` clears) seeds it.
        if (this.loading) return true

        if (type === 'checkbox' || type === 'switch' || (type === 'radio' && !this._hasOptions())) {
            const input = this.querySelector<HTMLInputElement>('input.form-check-input')
            if (!input) return false
            const next = !isEmpty(v)
            if (input.checked !== next) input.checked = next
            return true
        }

        if (type === 'radio') {
            const inputs = this.querySelectorAll<HTMLInputElement>('input.form-check-input')
            if (inputs.length === 0) return false
            const next = v == null ? '' : String(v)
            inputs.forEach((input) => {
                const on = input.value === next
                if (input.checked !== on) input.checked = on
            })
            return true
        }

        if (type === 'dropdown' || type === 'select') {
            const select = this.querySelector<HTMLSelectElement>('select')
            if (!select) return false
            const next = v == null ? '' : String(v)
            if (select.value === next) return true
            if (!Array.from(select.options).some((o) => o.value === next)) return false
            select.value = next
            return true
        }

        const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            'input, textarea',
        )
        if (!control) return false
        // A colour input rejects '' and silently becomes #000000, so the same
        // fallback the render path uses applies here.
        const next = v == null || v === '' ? (type === 'color' ? '#1e293b' : '') : String(v)
        if (control.value !== next) control.value = next
        return true
    }

    /** The controls that carry `required` in the render path. A radio GROUP does
     *  not — the group element carries aria-required and the inputs stay clean. */
    private _requireableControls(): HTMLInputElement[] {
        if (this.type === 'radio' && this._hasOptions()) return []
        return this._controls()
    }

    private _patchDisabled(): void {
        const disabled = this.disabled
        const radioGroup = this.type === 'radio' && this._hasOptions()
        const options = radioGroup ? this._optionList() : []
        this._controls().forEach((control, index) => {
            control.disabled = radioGroup ? disabled || !!options[index]?.disabled : disabled
        })
    }

    private _patchRequired(): void {
        const required = this.required
        this._requireableControls().forEach((control) => {
            control.required = required
            if (required) control.setAttribute('aria-required', 'true')
            else control.removeAttribute('aria-required')
        })

        const group = this.querySelector('.tc-form-input-radio-group')
        if (group) {
            if (required) group.setAttribute('aria-required', 'true')
            else group.removeAttribute('aria-required')
        }

        // The asterisk lives inside the label, which may not exist.
        const label = this._labelEl()
        if (!label) return
        const mark = label.querySelector('.tc-form-input-required')
        if (required && !mark) {
            label.insertAdjacentHTML(
                'beforeend',
                `<span class="tc-form-input-required" aria-hidden="true">*</span>`,
            )
        } else if (!required && mark) {
            mark.remove()
        }
    }

    /** The field's OWN label. `.tc-form-input-label` (block layouts, always first
     *  in document order) or the single `.form-check-label` of an inline control —
     *  never one of a radio group's per-option labels. */
    private _labelEl(): HTMLElement | null {
        return this.querySelector<HTMLElement>('.tc-form-input-label, .form-check-label')
    }

    /** Returns false when the label is appearing or disappearing, which adds or
     *  removes a node and therefore needs the render path. */
    private _patchLabelText(): boolean {
        const label = this._labelEl()
        const next = this.label
        if (!label || !next) return false
        const mark = label.querySelector('.tc-form-input-required')
        label.textContent = next
        if (mark) label.appendChild(mark)
        return true
    }

    /** Returns false for select, where the placeholder is an `<option>` node. */
    private _patchPlaceholder(): boolean {
        const type = this.type
        if (type === 'dropdown' || type === 'select') return false
        const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            'input, textarea',
        )
        if (!control) return false
        control.placeholder = this.placeholder
        return true
    }

    private _patchConstraints(): void {
        const control = this._valueControl()
        if (!control) return
        for (const name of ['min', 'max', 'step']) {
            const value = this.getAttribute(name)
            if (value != null) control.setAttribute(name, value)
            else control.removeAttribute(name)
        }
    }

    private _patchRows(): void {
        const textarea = this.querySelector<HTMLTextAreaElement>('textarea')
        if (!textarea) return
        const rows = this.getAttribute('rows')
        if (rows != null) textarea.setAttribute('rows', rows)
        else textarea.removeAttribute('rows')
    }

    private _patchKeyboardAttrs(): void {
        const control = this._valueControl()
        if (!control) return
        const resolved = new Map(this._keyboardAttrEntries())
        // Removing the host attribute falls back to whatever `type` implies, so
        // both directions go through the same resolver.
        for (const name of ['inputmode', 'enterkeyhint', 'autocomplete']) {
            const value = resolved.get(name)
            if (value != null) control.setAttribute(name, value)
            else control.removeAttribute(name)
        }
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

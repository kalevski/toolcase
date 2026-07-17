import { esc as escShared } from './esc'
import { fieldMessageHtml } from './field-message'
import { requiredMark, dispatchFieldChange } from './form-field'
import { msg } from '../messages'
// Shared scaffold for tc-input and tc-textarea. Both render the same
// label + form-control + validation-feedback + help-text frame and share an
// identical accessor set (value/placeholder/label/name/size/disabled/readonly/
// required/state/help) plus the in-place `value` fast-path. They differ only in
// the control element: Input emits `<input type>`, Textarea emits
// `<textarea rows>`. The subclass supplies `controlSelector` + `renderControl`.
//
// Form association: both subclasses inherit `static formAssociated = true` and
// use ElementInternals to participate in `<form>` submission, reset, and
// validation. The `name` attribute on the outer custom element is what FormData
// uses; the inner native control intentionally carries no `name` to avoid
// double-submission.

let _idCounter = 0

export type FieldSize = 'sm' | 'lg'
export type FieldState = 'valid' | 'invalid'

const SIZES: FieldSize[] = ['sm', 'lg']
const STATES: FieldState[] = ['valid', 'invalid']

/** Attributes observed by both fields; subclasses prepend their own (`type` / `rows`). */
export const TEXT_FIELD_ATTRIBUTES = [
    'value',
    'placeholder',
    'label',
    'name',
    'size',
    'disabled',
    'readonly',
    'required',
    'state',
    'help',
    'error',
    'min',
    'max',
    'step',
    'pattern',
    'minlength',
    'maxlength',
    'inputmode',
    'autocomplete',
]

export function esc(str: string): string {
    return escShared(str)
}

export interface ControlRenderContext {
    /** The control's `id` (matches the label's `for`). */
    id: string
    /** The full `class` value, e.g. `form-control form-control-sm is-invalid`. */
    classAttr: string
    /** Current value (already resolved from the live control or the attribute). */
    value: string
    placeholder: string
    /** Pre-built shared attribute string: aria-describedby + disabled/readonly/required. */
    commonAttrs: string
}

export abstract class TextFieldBase extends HTMLElement {
    // Form participation: the outer custom element is the form participant.
    // The inner native control carries no `name` to avoid double-submission.
    static formAssociated = true

    protected _controlId: string
    protected _helpId: string
    protected _initialised = false
    protected _internals: ElementInternals
    // The value captured at first connectedCallback — used to restore on form reset.
    private _defaultValue = ''

    /** CSS selector for the inner control element (`input` / `textarea`). */
    protected abstract get controlSelector(): string
    /** Render the control element from the shared context. */
    protected abstract renderControl(ctx: ControlRenderContext): string

    constructor() {
        super()
        const uid = ++_idCounter
        const prefix = this.localName || 'tc-field'
        this._controlId = `${prefix}-${uid}`
        this._helpId = `${prefix}-help-${uid}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._defaultValue = this.getAttribute('value') ?? ''
        }
        this.render()
        this._syncFormValue()
        this._initialised = true
        this.addEventListener('input', this._onInput)
        this.addEventListener('focusout', this._onFocusout)
        this.addEventListener('change', this._onChange)
    }

    disconnectedCallback(): void {
        this.removeEventListener('input', this._onInput)
        this.removeEventListener('focusout', this._onFocusout)
        this.removeEventListener('change', this._onChange)
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(
                this.controlSelector,
            )
            if (control && control.value !== (next ?? '')) control.value = next ?? ''
            this._syncFormValue()
            return
        }
        // Fast path: updating only the state class/feedback avoids destroying + recreating the
        // inner control (which would steal focus while the user is typing). `error`
        // shares this path since it only affects the validity chrome + message slot.
        if (name === 'state' || name === 'error') {
            this._patchState(this.state)
            return
        }
        this.render()
        this._syncFormValue()
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            this.controlSelector,
        )
        if (control) control.value = this._defaultValue
        this._syncFormValue()
    }

    /** Called by the browser when a containing fieldset or form is disabled/enabled. */
    formDisabledCallback(disabled: boolean): void {
        const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            this.controlSelector,
        )
        if (control) control.disabled = disabled
    }

    private _onInput = (): void => {
        this._syncFormValue()
        this._reflectValidity()
    }

    private _onFocusout = (): void => {
        this._reflectValidity()
    }

    // Unified change event: re-emit the native commit as tc-change {value}.
    private _onChange = (): void => {
        dispatchFieldChange(this, this.value)
    }

    private _reflectValidity(): void {
        const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            this.controlSelector,
        )
        if (!control) return
        const newState: FieldState = control.validity.valid ? 'valid' : 'invalid'
        if (this.getAttribute('state') !== newState) {
            this.setAttribute('state', newState)
        }
    }

    /** In-place update of validity chrome — does not replace the control so the
     *  focused element is never disrupted. The reserved message slot already
     *  exists; we swap its contents (invalid > valid > hint) and keep aria wiring. */
    private _patchState(stateAttr: FieldState | null): void {
        const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            this.controlSelector,
        )
        if (!control) return
        const error = this.error
        // A custom `error` message wins over native/explicit state.
        const state: FieldState | null = error ? 'invalid' : stateAttr
        control.classList.remove('is-valid', 'is-invalid')
        if (state === 'valid') control.classList.add('is-valid')
        else if (state === 'invalid') control.classList.add('is-invalid')

        const slot = this.querySelector('.tc-field-message')
        const html = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: msg('fieldInvalid'),
        })
        if (slot) slot.outerHTML = html

        if (this.help || state) control.setAttribute('aria-describedby', this._helpId)
        else control.removeAttribute('aria-describedby')
    }

    private _syncFormValue(): void {
        const value = this.value
        this._internals.setFormValue(value || null)
        const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            this.controlSelector,
        )
        if (control) {
            const v = control.validity
            if (v.valid) {
                this._internals.setValidity({})
            } else {
                this._internals.setValidity(
                    {
                        badInput: v.badInput,
                        customError: v.customError,
                        patternMismatch: v.patternMismatch,
                        rangeOverflow: v.rangeOverflow,
                        rangeUnderflow: v.rangeUnderflow,
                        stepMismatch: v.stepMismatch,
                        tooLong: v.tooLong,
                        tooShort: v.tooShort,
                        typeMismatch: v.typeMismatch,
                        valueMissing: v.valueMissing,
                    },
                    control.validationMessage,
                    control,
                )
            }
        } else {
            this._internals.setValidity({})
        }
    }

    get value(): string {
        return (
            this.querySelector<HTMLInputElement | HTMLTextAreaElement>(this.controlSelector)
                ?.value ??
            this.getAttribute('value') ??
            ''
        )
    }
    set value(v: string) {
        const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            this.controlSelector,
        )
        if (control) control.value = v
        this.setAttribute('value', v)
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? ''
    }
    set placeholder(v: string) {
        this.setAttribute('placeholder', v)
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get size(): FieldSize | null {
        const v = this.getAttribute('size') as FieldSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: FieldSize | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get readonly(): boolean {
        return this.hasAttribute('readonly')
    }
    set readonly(v: boolean) {
        if (v) this.setAttribute('readonly', '')
        else this.removeAttribute('readonly')
    }

    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    get state(): FieldState | null {
        const v = this.getAttribute('state') as FieldState
        return STATES.includes(v) ? v : null
    }
    set state(v: FieldState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    get help(): string | null {
        return this.getAttribute('help')
    }
    set help(v: string | null) {
        if (v != null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    /** Custom invalid message. A non-empty `error` forces the invalid state and
     *  takes precedence over `state` / native validity in the reserved slot. */
    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    protected render(): void {
        const label = this.label
        const size = this.size
        const help = this.help
        const error = this.error
        // A custom `error` message forces the invalid state.
        const state: FieldState | null = error ? 'invalid' : this.state
        const placeholder = this.placeholder
        const currentValue =
            this.querySelector<HTMLInputElement | HTMLTextAreaElement>(this.controlSelector)
                ?.value ??
            this.getAttribute('value') ??
            ''

        const sizeClass = size ? ` form-control-${size}` : ''
        const stateClass =
            state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
        const ariaDescribedBy = help || state ? ` aria-describedby="${this._helpId}"` : ''
        const disabledAttr = this.disabled ? ' disabled' : ''
        const readonlyAttr = this.readonly ? ' readonly' : ''
        const requiredAttr = this.required ? ' required aria-required="true"' : ''

        const attrOrEmpty = (attrName: string) => {
            const v = this.getAttribute(attrName)
            return v != null ? ` ${attrName}="${esc(v)}"` : ''
        }
        const constraintAttrs =
            attrOrEmpty('min') +
            attrOrEmpty('max') +
            attrOrEmpty('step') +
            attrOrEmpty('pattern') +
            attrOrEmpty('minlength') +
            attrOrEmpty('maxlength') +
            attrOrEmpty('inputmode') +
            attrOrEmpty('autocomplete')

        const labelHtml = label
            ? `<label class="form-label" for="${this._controlId}">${esc(label)}${requiredMark(this.required)}</label>`
            : ''

        // One reserved slot below the control, used by invalid > valid > hint.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: help,
            invalidText: msg('fieldInvalid'),
        })

        const control = this.renderControl({
            id: this._controlId,
            classAttr: `form-control${sizeClass}${stateClass}`,
            value: currentValue,
            placeholder,
            commonAttrs: `${ariaDescribedBy}${disabledAttr}${readonlyAttr}${requiredAttr}${constraintAttrs}`,
        })

        this.innerHTML = [labelHtml, control, messageHtml].join('')
    }
}

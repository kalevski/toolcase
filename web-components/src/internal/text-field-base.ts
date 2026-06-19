import { esc as escShared } from "./esc"
// Shared scaffold for tc-input and tc-textarea. Both render the same
// label + form-control + validation-feedback + help-text frame and share an
// identical accessor set (value/placeholder/label/size/disabled/readonly/
// required/state/help) plus the in-place `value` fast-path. They differ only in
// the control element: Input emits `<input type>`, Textarea emits
// `<textarea rows>`. The subclass supplies `controlSelector` + `renderControl`.

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
    'size',
    'disabled',
    'readonly',
    'required',
    'state',
    'help',
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
    protected _controlId: string
    protected _helpId: string
    protected _initialised = false

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
    }

    connectedCallback(): void {
        this.render()
        this._initialised = true
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(this.controlSelector)
            if (control && control.value !== (next ?? '')) control.value = next ?? ''
            return
        }
        this.render()
    }

    get value(): string {
        return (
            this.querySelector<HTMLInputElement | HTMLTextAreaElement>(this.controlSelector)?.value ??
            this.getAttribute('value') ??
            ''
        )
    }
    set value(v: string) {
        const control = this.querySelector<HTMLInputElement | HTMLTextAreaElement>(this.controlSelector)
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

    protected render(): void {
        const label = this.label
        const size = this.size
        const state = this.state
        const help = this.help
        const placeholder = this.placeholder
        const currentValue =
            this.querySelector<HTMLInputElement | HTMLTextAreaElement>(this.controlSelector)?.value ??
            this.getAttribute('value') ??
            ''

        const sizeClass = size ? ` form-control-${size}` : ''
        const stateClass = state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
        const ariaDescribedBy = help ? ` aria-describedby="${this._helpId}"` : ''
        const disabledAttr = this.disabled ? ' disabled' : ''
        const readonlyAttr = this.readonly ? ' readonly' : ''
        const requiredAttr = this.required ? ' required' : ''

        const labelHtml = label
            ? `<label class="form-label" for="${this._controlId}">${esc(label)}</label>`
            : ''

        const feedbackHtml =
            state === 'valid'
                ? `<div class="valid-feedback">Looks good!</div>`
                : state === 'invalid'
                  ? `<div class="invalid-feedback">Please provide a valid value.</div>`
                  : ''

        const helpHtml = help ? `<div id="${this._helpId}" class="form-text">${esc(help)}</div>` : ''

        const control = this.renderControl({
            id: this._controlId,
            classAttr: `form-control${sizeClass}${stateClass}`,
            value: currentValue,
            placeholder,
            commonAttrs: `${ariaDescribedBy}${disabledAttr}${readonlyAttr}${requiredAttr}`,
        })

        this.innerHTML = [labelHtml, control, feedbackHtml, helpHtml].join('')
    }
}

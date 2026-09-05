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
const TAG_NAME = 'tc-check'

let _idCounter = 0

export type CheckState = 'valid' | 'invalid'

const STATES: CheckState[] = ['valid', 'invalid']

export class Check extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    // A checkbox submits its `value` (default 'on') only when checked.
    static formAssociated = true

    private _inputId: string
    private _helpId: string
    private _initialised = false
    private _internals: ElementInternals
    private _defaultChecked = false

    static get observedAttributes(): string[] {
        return [
            'checked',
            'value',
            'name',
            'label',
            'indeterminate',
            'disabled',
            'required',
            'inline',
            'reverse',
            'state',
            'help',
            'error',
        ]
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._inputId = `tc-check-${uid}`
        this._helpId = `tc-check-help-${uid}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Snapshot the authored checked state so formResetCallback can restore it.
            this._defaultChecked = this.hasAttribute('checked')
        }
        this.addEventListener('change', this._onNativeChange)
        this.render()
        this._initialised = true
        this._syncForm()
    }

    disconnectedCallback(): void {
        this.removeEventListener('change', this._onNativeChange)
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        this.checked = this._defaultChecked
        this._syncForm()
    }

    /** Called by the browser when a containing fieldset/form is disabled/enabled. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    /** Push checked-as-value + validity into the form. A checkbox submits
     *  `value` (default 'on') only when checked; a `required` checkbox that is
     *  unchecked is value-missing. */
    private _syncForm(): void {
        setFieldFormValue(this._internals, this.name, this.checked, this.value || 'on')
        const error = this.error
        const requiredEmpty = this.required && !this.checked
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? 'Please check this field.' : 'Invalid value.'),
            anchor: this.querySelector<HTMLInputElement>('input') ?? undefined,
        })
    }

    attributeChangedCallback(name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'checked' || name === 'indeterminate') {
            const input = this.querySelector<HTMLInputElement>('input')
            if (input) {
                input.checked = this.hasAttribute('checked')
                input.indeterminate = this.hasAttribute('indeterminate')
            }
            // checked toggles both the submitted value and the required-empty
            // validity, so resync the form on either flag without a full re-render.
            this._syncForm()
            return
        }
        this.render()
        this._syncForm()
    }

    get checked(): boolean {
        return (
            this.querySelector<HTMLInputElement>('input')?.checked ?? this.hasAttribute('checked')
        )
    }
    set checked(v: boolean) {
        const input = this.querySelector<HTMLInputElement>('input')
        if (input) input.checked = v
        if (v) this.setAttribute('checked', '')
        else this.removeAttribute('checked')
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        setAttr(this, 'value', v)
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

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

    get indeterminate(): boolean {
        return this.hasAttribute('indeterminate')
    }
    set indeterminate(v: boolean) {
        if (v) this.setAttribute('indeterminate', '')
        else this.removeAttribute('indeterminate')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get inline(): boolean {
        return this.hasAttribute('inline')
    }
    set inline(v: boolean) {
        if (v) this.setAttribute('inline', '')
        else this.removeAttribute('inline')
    }

    get reverse(): boolean {
        return this.hasAttribute('reverse')
    }
    set reverse(v: boolean) {
        if (v) this.setAttribute('reverse', '')
        else this.removeAttribute('reverse')
    }

    get state(): CheckState | null {
        const v = this.getAttribute('state') as CheckState
        return STATES.includes(v) ? v : null
    }
    set state(v: CheckState | null) {
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

    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    private _onNativeChange = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (input.tagName === 'INPUT') {
            const isChecked = input.checked
            if (isChecked !== this.hasAttribute('checked')) {
                if (isChecked) this.setAttribute('checked', '')
                else this.removeAttribute('checked')
                // attributeChangedCallback('checked') resyncs the form value.
            } else {
                // No attribute flip (already in sync) → resync explicitly so the
                // form value always tracks the native input's checked state.
                this._syncForm()
            }
            // Unified change event alongside the native one: detail.value is the boolean.
            dispatchFieldChange(this, this.checked)
        }
    }

    private render(): void {
        const label = this.label
        const error = this.error
        // An `error` message forces the invalid state, mirroring tc-select.
        const state: CheckState | null = error ? 'invalid' : this.state
        const help = this.help
        const checkedAttr = this.hasAttribute('checked') ? ' checked' : ''
        const indeterminate = this.indeterminate
        const disabled = this.disabled
        const required = this.required
        const inline = this.inline
        const reverse = this.reverse
        const value = this.value

        const inlineClass = inline ? ' form-check-inline' : ''
        const reverseClass = reverse ? ' form-check-reverse' : ''
        const stateClass =
            state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const requiredAttr = required ? ' aria-required="true"' : ''
        const valueAttr = value ? ` value="${esc(value)}"` : ''

        // The asterisk belongs on the visible label; an inline check defers its
        // labelling to the enclosing group, so only labelled non-inline checks
        // append the mark.
        const labelHtml =
            label != null
                ? `<label class="form-check-label" for="${this._inputId}">${esc(label)}${
                      inline ? '' : requiredMark(required)
                  }</label>`
                : ''

        // Reserved field-message slot lives BELOW the control row, as the last
        // child. Gated: (1) a bare <tc-check> with no label/help/error/state (e.g.
        // embedded inside another control) must add NO gutter, and (2) an `inline`
        // check is part of a horizontal set — its messaging belongs to the
        // enclosing group, so a per-item block slot would break the row. Either
        // case skips the slot.
        const hasField =
            !inline && (label != null || help != null || error != null || state != null)
        const messageHtml = hasField
            ? fieldMessageHtml({
                  id: this._helpId,
                  state,
                  error,
                  hint: help,
                  invalidText: 'Please check this field.',
                  validText: 'Looks good!',
              })
            : ''
        const describe = hasField && (help || state) ? ` aria-describedby="${this._helpId}"` : ''

        patchHtml(
            this,
            [
                `<div class="form-check${inlineClass}${reverseClass}">`,
                `<input id="${this._inputId}" class="form-check-input${stateClass}" type="checkbox"${valueAttr}${checkedAttr}${disabledAttr}${requiredAttr}${describe}>`,
                labelHtml,
                `</div>`,
                messageHtml,
            ].join(''),
        )

        // indeterminate cannot be set via HTML attribute — must be applied imperatively.
        const input = this.querySelector<HTMLInputElement>('input')
        if (input) input.indeterminate = indeterminate
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Check
    }
}

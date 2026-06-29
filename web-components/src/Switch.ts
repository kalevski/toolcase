import { esc } from './internal/esc'
import { fieldMessageHtml } from './internal/field-message'
import { requiredMark, reflectFieldValidity, dispatchFieldChange } from './internal/form-field'
const TAG_NAME = 'tc-switch'

let _idCounter = 0

export type SwitchState = 'valid' | 'invalid'

const STATES: SwitchState[] = ['valid', 'invalid']

// tc-switch — pill-track switch with a pure-circle sliding knob, paired with an
// optional label. Modelled on the tc-fullscreen-toggle control (button +
// role="switch") rather than the bootstrap form-check: the off track is a crisp
// slate well with a white, shadowed knob (reads as an interactive control), the
// checked track carries the signature 135° slate-ink gradient, and the disabled
// state fades the whole row well past the off state so the two never look alike.
// All cosmetics flow through `--bs-switch-*`.
export class Switch extends HTMLElement {
    static formAssociated = true

    private _inputId: string
    private _labelId: string
    private _helpId: string
    private _initialised = false
    private _internals: ElementInternals
    private _defaultChecked = false
    private _btnEl: HTMLButtonElement | null = null
    private _labelEl: HTMLLabelElement | null = null

    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'checked',
            'value',
            'label',
            'disabled',
            'required',
            'reverse',
            'name',
            'state',
            'help',
            'error',
        ]
    }

    constructor() {
        super()
        const n = ++_idCounter
        this._inputId = `tc-switch-${n}`
        this._labelId = `tc-switch-label-${n}`
        this._helpId = `tc-switch-help-${n}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._defaultChecked = this.hasAttribute('checked')
        }
        this.render()
        this._syncFormValue()
        this._initialised = true
    }

    disconnectedCallback(): void {
        if (this._btnEl) {
            this._btnEl.removeEventListener('click', this._onToggle)
            this._btnEl = null
        }
        if (this._labelEl) {
            this._labelEl.removeEventListener('click', this._onToggle)
            this._labelEl = null
        }
    }

    formResetCallback(): void {
        this.checked = this._defaultChecked
        this._syncFormValue()
    }

    formDisabledCallback(disabled: boolean): void {
        const btn = this.querySelector<HTMLButtonElement>('.tc-switch__track')
        if (btn) btn.disabled = disabled
        const row = this.querySelector<HTMLElement>('.tc-switch__row')
        if (row) row.classList.toggle('tc-switch__row--disabled', disabled)
    }

    private _syncFormValue(): void {
        // Keep the existing setFormValue contract: submit `value` (default 'on')
        // only when on, nothing when off.
        if (this.checked) {
            this._internals.setFormValue(this.value || 'on')
        } else {
            this._internals.setFormValue(null)
        }
        // Reflect validity so form.checkValidity()/:invalid work. A required
        // switch that is off is value-missing; an `error`/state="invalid" forces
        // invalid regardless.
        const error = this.error
        const requiredEmpty = this.required && !this.checked
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message:
                error ||
                (requiredEmpty ? 'Please enable this setting.' : 'Please review this setting.'),
            anchor: this.querySelector<HTMLButtonElement>('.tc-switch__track') ?? undefined,
        })
    }

    attributeChangedCallback(name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch checked/disabled in place — a full re-render would drop the
        // button's focus on every toggle.
        if (name === 'checked') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-switch__track')
            const checked = this.checked
            if (btn) {
                btn.setAttribute('aria-checked', String(checked))
                btn.dataset.checked = String(checked)
            }
            this._syncFormValue()
            return
        }
        if (name === 'disabled') {
            const btn = this.querySelector<HTMLButtonElement>('.tc-switch__track')
            if (btn) btn.disabled = this.disabled
            const row = this.querySelector<HTMLElement>('.tc-switch__row')
            if (row) row.classList.toggle('tc-switch__row--disabled', this.disabled)
            return
        }
        // error/state/required/label etc. re-render the control chrome and the
        // reserved message slot; resync so validity tracks the new attributes.
        this.render()
        this._syncFormValue()
    }

    get checked(): boolean {
        return this.hasAttribute('checked')
    }
    set checked(v: boolean) {
        if (v) this.setAttribute('checked', '')
        else this.removeAttribute('checked')
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        this.setAttribute('value', v)
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
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

    get reverse(): boolean {
        return this.hasAttribute('reverse')
    }
    set reverse(v: boolean) {
        if (v) this.setAttribute('reverse', '')
        else this.removeAttribute('reverse')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get state(): SwitchState | null {
        const v = this.getAttribute('state') as SwitchState
        return STATES.includes(v) ? v : null
    }
    set state(v: SwitchState | null) {
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

    private render(): void {
        if (this._btnEl) {
            this._btnEl.removeEventListener('click', this._onToggle)
            this._btnEl = null
        }
        if (this._labelEl) {
            this._labelEl.removeEventListener('click', this._onToggle)
            this._labelEl = null
        }

        const label = this.label
        const checked = this.checked
        const disabled = this.disabled
        const required = this.required
        const reverse = this.reverse
        const error = this.error
        // An `error` message forces the invalid state, mirroring tc-select.
        const state: SwitchState | null = error ? 'invalid' : this.state
        const help = this.help

        const reverseClass = reverse ? ' tc-switch__row--reverse' : ''
        const disabledClass = disabled ? ' tc-switch__row--disabled' : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const requiredAttr = required ? ' aria-required="true"' : ''
        // Control's invalid/valid visual — painted in _switch.scss off these classes.
        const stateClass =
            state === 'valid'
                ? ' tc-switch__track--valid'
                : state === 'invalid'
                  ? ' tc-switch__track--invalid'
                  : ''
        const labelledBy = label != null ? ` aria-labelledby="${this._labelId}"` : ''

        // Reserved field-message slot below the inline control row, as the last
        // child. Gated: a bare <tc-switch> with no label/help/error/state (e.g.
        // FullscreenToggle embeds a bare switch) must add NO gutter, which would
        // break dense layouts. Only render the slot when this is a field.
        const hasField = label != null || help != null || error != null || state != null
        const messageHtml = hasField
            ? fieldMessageHtml({
                  id: this._helpId,
                  state,
                  error,
                  hint: help,
                  invalidText: 'Please review this setting.',
                  validText: 'Looks good!',
              })
            : ''
        const describe = hasField && (help || state) ? ` aria-describedby="${this._helpId}"` : ''

        // A labelled switch carries the asterisk on its visible label.
        const labelHtml =
            label != null
                ? `<label class="tc-switch__label" id="${this._labelId}" for="${this._inputId}">${esc(label)}${requiredMark(required)}</label>`
                : ''

        this.innerHTML = [
            `<div class="tc-switch__row${reverseClass}${disabledClass}">`,
            `<button type="button" id="${this._inputId}" class="tc-switch__track${stateClass}" role="switch" aria-checked="${checked}" data-checked="${checked}"${labelledBy}${disabledAttr}${requiredAttr}${describe}>`,
            `<span class="tc-switch__knob"></span>`,
            `</button>`,
            labelHtml,
            `</div>`,
            messageHtml,
        ].join('')

        this._btnEl = this.querySelector<HTMLButtonElement>('.tc-switch__track')
        if (this._btnEl) this._btnEl.addEventListener('click', this._onToggle)
        this._labelEl = this.querySelector<HTMLLabelElement>('.tc-switch__label')
        if (this._labelEl) this._labelEl.addEventListener('click', this._onToggle)
    }

    private _onToggle = (): void => {
        if (this.disabled) return
        const next = !this.checked
        this.checked = next // triggers attributeChangedCallback → _syncFormValue
        // Unified change event with the canonical { value } detail shape.
        dispatchFieldChange(this, next)
        // Keep the native input/change events so plain DOM listeners still fire.
        this.dispatchEvent(new Event('input', { bubbles: true }))
        this.dispatchEvent(new Event('change', { bubbles: true }))
        if (typeof this.onChange === 'function') this.onChange(next)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Switch
    }
}

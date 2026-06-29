import { esc } from './internal/esc'
import { fieldMessageHtml } from './internal/field-message'
import { requiredMark, reflectFieldValidity, dispatchFieldChange } from './internal/form-field'
const TAG_NAME = 'tc-radio-group'

let _idCounter = 0

export type RadioGroupState = 'valid' | 'invalid'

const STATES: RadioGroupState[] = ['valid', 'invalid']

export interface RadioGroupOption {
    value: string
    label: string
    disabled?: boolean
}

export class RadioGroup extends HTMLElement {
    // Form association: the outer custom element is the form participant (via
    // ElementInternals). Inner radio inputs carry NO `name` attribute to avoid
    // double-submission. Mutual exclusion and keyboard grouping are handled
    // entirely in JS (_patchCheckedAndTabindex / _onKeydown).
    static formAssociated = true

    private _initialised = false
    private _idPrefix: string
    private _helpId: string
    private _options: RadioGroupOption[] = []
    private _value = ''
    private _internals: ElementInternals
    private _defaultValue = ''

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'label',
            'value',
            'name',
            'inline',
            'disabled',
            'required',
            'state',
            'help',
            'error',
        ]
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._idPrefix = `tc-rg-${uid}`
        this._helpId = `tc-rg-help-${uid}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._value = this.getAttribute('value') ?? ''
            this._defaultValue = this._value
            this.render()
            this._initialised = true
        }
        this._syncForm()
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('change', this._onNativeChange)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('change', this._onNativeChange)
        this.removeEventListener('keydown', this._onKeydown)
    }

    formResetCallback(): void {
        this._value = this._defaultValue
        if (this._defaultValue) this.setAttribute('value', this._defaultValue)
        else this.removeAttribute('value')
        this._patchCheckedAndTabindex()
        this._syncForm()
    }

    formDisabledCallback(disabled: boolean): void {
        for (const input of Array.from(
            this.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
        )) {
            input.disabled = disabled
        }
    }

    /** Push value + validity into the form. A `required` group with no selection
     *  is value-missing; an `error`/state="invalid" forces invalid. Centralised so
     *  every value-commit path reflects the same validity. */
    private _syncForm(): void {
        this._internals.setFormValue(this._value || null)
        const error = this.error
        const requiredEmpty = this.required && this._value === ''
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? 'Please make a selection.' : 'Invalid selection.'),
            anchor: this.querySelector<HTMLInputElement>('input[type="radio"]') ?? undefined,
        })
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            // Surgical patch for value changes — avoids destroying focus on user interaction
            this._value = next ?? ''
            this._patchCheckedAndTabindex()
            this._syncForm()
            return
        }
        const focusedValue = this.querySelector<HTMLInputElement>('input:focus')?.value ?? null
        this.render()
        // required/state/error re-render the chrome + slot; resync validity.
        this._syncForm()
        if (focusedValue !== null) {
            for (const input of Array.from(
                this.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
            )) {
                if (input.value === focusedValue) {
                    input.focus()
                    break
                }
            }
        }
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get value(): string {
        return this._value
    }
    set value(v: string) {
        this._value = v ?? ''
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get inline(): boolean {
        return this.hasAttribute('inline')
    }
    set inline(v: boolean) {
        if (v) this.setAttribute('inline', '')
        else this.removeAttribute('inline')
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

    get state(): RadioGroupState | null {
        const v = this.getAttribute('state') as RadioGroupState
        return STATES.includes(v) ? v : null
    }
    set state(v: RadioGroupState | null) {
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

    get options(): RadioGroupOption[] {
        return this._options
    }
    set options(v: RadioGroupOption[]) {
        this._options = Array.isArray(v) ? v : []
        if (this._initialised) {
            const focusedValue = this.querySelector<HTMLInputElement>('input:focus')?.value ?? null
            this.render()
            if (focusedValue !== null) {
                for (const input of Array.from(
                    this.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
                )) {
                    if (input.value === focusedValue) {
                        input.focus()
                        break
                    }
                }
            }
        }
    }

    private _patchCheckedAndTabindex(): void {
        const inputs = Array.from(this.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
        let tabbableSet = false

        for (const input of inputs) {
            const isSelected = input.value === this._value
            input.checked = isSelected
            if (isSelected && !input.disabled) {
                input.setAttribute('tabindex', '0')
                tabbableSet = true
            } else {
                input.setAttribute('tabindex', '-1')
            }
        }

        if (!tabbableSet) {
            const first = this.querySelector<HTMLInputElement>(
                'input[type="radio"]:not([disabled])',
            )
            if (first) first.setAttribute('tabindex', '0')
        }
    }

    private _onNativeChange = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (input.type !== 'radio') return

        const optValue = input.value
        const option = this._options.find((o) => o.value === optValue)
        if (option?.disabled) return
        if (optValue === this._value) return

        this._value = optValue
        // Triggers attributeChangedCallback('value') → _patchCheckedAndTabindex +
        // _syncForm (surgical, no full re-render).
        this.setAttribute('value', optValue)

        // Unified change event with the canonical { value } detail shape.
        dispatchFieldChange(this, optValue)
        if (typeof this.onChange === 'function') this.onChange(optValue)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'radio') return

        const key = e.key
        if (key !== 'ArrowDown' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowLeft')
            return

        e.preventDefault()

        const enabledOptions = this._options.filter((o) => !o.disabled)
        if (enabledOptions.length === 0) return

        const currentIdx = enabledOptions.findIndex((o) => o.value === this._value)
        let nextIdx: number

        if (key === 'ArrowDown' || key === 'ArrowRight') {
            nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % enabledOptions.length
        } else {
            nextIdx = currentIdx <= 0 ? enabledOptions.length - 1 : currentIdx - 1
        }

        const nextOption = enabledOptions[nextIdx]
        if (!nextOption || nextOption.value === this._value) return

        this._value = nextOption.value
        // Triggers attributeChangedCallback('value') → _patchCheckedAndTabindex + _syncForm
        this.setAttribute('value', nextOption.value)

        // Focus the newly selected input after DOM patch
        const nextInput = Array.from(
            this.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
        ).find((inp) => inp.value === nextOption.value)
        if (nextInput) nextInput.focus()

        // Unified change event with the canonical { value } detail shape.
        dispatchFieldChange(this, nextOption.value)
        if (typeof this.onChange === 'function') this.onChange(nextOption.value)
    }

    private render(): void {
        const label = this.label
        const inline = this.inline
        const disabled = this.disabled
        const required = this.required
        const error = this.error
        // An `error` message forces the invalid state, mirroring tc-select.
        const state: RadioGroupState | null = error ? 'invalid' : this.state
        const help = this.help

        const selectedEnabled = this._options.find((o) => o.value === this._value && !o.disabled)
        const firstEnabled = this._options.find((o) => !o.disabled)
        const tabbableValue = selectedEnabled
            ? selectedEnabled.value
            : (firstEnabled?.value ?? null)

        const optionsClass = inline
            ? 'tc-radio-group-options tc-radio-group-options--inline'
            : 'tc-radio-group-options'

        // Each radio gets the control's invalid/valid visual when the group state set.
        const inputStateClass =
            state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''

        const legendHtml =
            label != null
                ? `<legend class="tc-radio-group-label">${esc(label)}${requiredMark(required)}</legend>`
                : ''

        const optionsHtml = this._options
            .map((opt, idx) => {
                const inputId = `${this._idPrefix}-${idx}`
                const isSelected = opt.value === this._value
                const isTabbable = opt.value === tabbableValue
                const checkedAttr = isSelected ? ' checked' : ''
                // A group-level `disabled` disables every option; a per-option
                // `disabled` only that row.
                const disabledAttr =
                    disabled || opt.disabled ? ' disabled aria-disabled="true"' : ''
                const tabindex = isTabbable ? '0' : '-1'

                // Inner radios carry no `name` — ElementInternals owns form
                // submission. Mutual exclusion (only one checked) is enforced
                // by _patchCheckedAndTabindex rather than native browser grouping.
                return [
                    `<div class="form-check">`,
                    `<input type="radio" class="form-check-input${inputStateClass}" id="${inputId}"`,
                    ` value="${esc(opt.value)}"${checkedAttr}${disabledAttr} tabindex="${tabindex}">`,
                    `<label class="form-check-label" for="${inputId}">${esc(opt.label)}</label>`,
                    `</div>`,
                ].join('')
            })
            .join('')

        // A radio group is always a standalone field: ALWAYS render the reserved
        // slot (even empty) so it reserves its line and groups stay aligned. It is
        // the last child, placed after the option rows.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: help,
            invalidText: 'Please make a selection.',
            validText: 'Looks good!',
        })
        // Group has no single input — describe the fieldset itself.
        const describe = help || state ? ` aria-describedby="${this._helpId}"` : ''
        const requiredAttr = required ? ' aria-required="true"' : ''

        this.innerHTML = [
            `<fieldset class="tc-radio-group"${requiredAttr}${describe}>`,
            legendHtml,
            `<div class="${optionsClass}">`,
            optionsHtml,
            `</div>`,
            messageHtml,
            `</fieldset>`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RadioGroup
    }
}

import { esc } from './internal/esc'
import { msg } from './messages'
import { fieldMessageHtml } from './internal/field-message'
import { requiredMark, reflectFieldValidity, dispatchFieldChange } from './internal/form-field'
const TAG_NAME = 'tc-checkbox-group'

let _idCounter = 0

export type CheckboxGroupState = 'valid' | 'invalid'

const STATES: CheckboxGroupState[] = ['valid', 'invalid']

export interface CheckboxGroupOption {
    value: string
    label: string
    disabled?: boolean
}

export class CheckboxGroup extends HTMLElement {
    // Form association: the outer custom element is the form participant (via
    // ElementInternals). Inner checkboxes use `_idPrefix` as their HTML `name`
    // attribute for grouping; the user-facing `name` attribute is consumed by
    // ElementInternals for form submission. For multiple selections, setFormValue
    // receives a FormData object with one entry per checked value.
    static formAssociated = true

    private _initialised = false
    private _idPrefix: string
    private _helpId: string
    private _options: CheckboxGroupOption[] = []
    private _value: string[] = []
    private _internals: ElementInternals

    onChange: ((checkedValues: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'inline', 'name', 'disabled', 'required', 'state', 'help', 'error']
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._idPrefix = `tc-cbg-${uid}`
        this._helpId = `tc-cbg-help-${uid}`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._syncFormValue()
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('change', this._onNativeChange)
    }

    disconnectedCallback(): void {
        this.removeEventListener('change', this._onNativeChange)
    }

    attributeChangedCallback(attr: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
        // A name change rekeys the FormData; required/state/error change the
        // effective validity. Both need a fresh _syncFormValue (which now also
        // reflects validity). Other attrs (label/inline) don't touch the form.
        if (attr === 'name' || attr === 'required' || attr === 'state' || attr === 'error') {
            this._syncFormValue()
        }
    }

    formResetCallback(): void {
        this._value = []
        this.render()
        this._syncFormValue()
    }

    formDisabledCallback(disabled: boolean): void {
        for (const input of Array.from(
            this.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
        )) {
            input.disabled = disabled
        }
    }

    private _syncFormValue(): void {
        const name = this.name ?? ''
        if (this._value.length === 0) {
            this._internals.setFormValue(null)
        } else {
            const fd = new FormData()
            for (const v of this._value) {
                fd.append(name, v)
            }
            this._internals.setFormValue(fd)
        }
        // Reflect validity so form.checkValidity()/:invalid work. Reuse the
        // centralised _effectiveState (which already folds in required-empty) so
        // the form's validity matches the visible chrome exactly.
        const error = this.error
        const requiredEmpty = this.required && this._value.length === 0
        const invalid = this._effectiveState() === 'invalid'
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message: error || (requiredEmpty ? msg('selectionMinOne') : msg('selectionInvalid')),
            anchor: this.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? undefined,
        })
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
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

    get state(): CheckboxGroupState | null {
        const v = this.getAttribute('state') as CheckboxGroupState
        return STATES.includes(v) ? v : null
    }
    set state(v: CheckboxGroupState | null) {
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

    /** Effective validity: an `error` string or `state="invalid"` forces invalid;
     *  otherwise a `required` group with nothing checked is invalid; else honour
     *  `state` (which may be 'valid'). Centralised so render() and the in-place
     *  change-patch agree. */
    private _effectiveState(): CheckboxGroupState | null {
        if (this.error || this.state === 'invalid') return 'invalid'
        if (this.required && this._value.length === 0) return 'invalid'
        return this.state
    }

    /** In-place validity-chrome update — used on change so the focused checkbox
     *  is never disrupted. Keeps the fieldset aria-invalid, the per-box
     *  is-invalid/is-valid classes, and the reserved message slot in sync with
     *  _effectiveState(), matching exactly what render() would emit. */
    private _patchState(): void {
        const state = this._effectiveState()

        const fieldset = this.querySelector<HTMLElement>('.tc-checkbox-group')
        if (fieldset) {
            if (state === 'invalid') fieldset.setAttribute('aria-invalid', 'true')
            else fieldset.removeAttribute('aria-invalid')
            if (this.help || state) fieldset.setAttribute('aria-describedby', this._helpId)
            else fieldset.removeAttribute('aria-describedby')
        }

        for (const input of Array.from(
            this.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
        )) {
            input.classList.remove('is-valid', 'is-invalid')
            if (state === 'valid') input.classList.add('is-valid')
            else if (state === 'invalid') input.classList.add('is-invalid')
        }

        const slot = this.querySelector('.tc-field-message')
        if (slot) {
            slot.outerHTML = fieldMessageHtml({
                id: this._helpId,
                state,
                error: this.error,
                hint: this.help,
                invalidText: msg('selectionMinOne'),
                validText: 'Looks good!',
            })
        }
    }

    get options(): CheckboxGroupOption[] {
        return this._options
    }
    set options(v: CheckboxGroupOption[]) {
        this._options = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get value(): string[] {
        return this._value
    }
    set value(v: string[]) {
        this._value = Array.isArray(v) ? v : []
        if (this._initialised) {
            this.render()
            this._syncFormValue()
        }
    }

    private _onNativeChange = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (input.type !== 'checkbox') return

        const optValue = input.value
        const checked = input.checked
        const option = this._options.find((o) => o.value === optValue)
        if (option?.disabled) return

        if (checked && !this._value.includes(optValue)) {
            this._value = [...this._value, optValue]
        } else if (!checked) {
            this._value = this._value.filter((v) => v !== optValue)
        }

        // Patch validity chrome in place without a full re-render — re-rendering
        // here would drop focus on the just-clicked checkbox. We mirror what
        // render() would produce: aria-invalid on the fieldset, is-invalid/is-valid
        // on each box, and the reserved message slot's contents.
        this._patchState()

        this._syncFormValue()

        // Unified change event: detail.value carries the selected-values array.
        dispatchFieldChange(this, this._value)
        if (typeof this.onChange === 'function') this.onChange(this._value)
    }

    private render(): void {
        const label = this.label
        const inline = this.inline
        const disabled = this.disabled
        const required = this.required
        const error = this.error
        const help = this.help
        const state = this._effectiveState()

        // Preserve focus across re-renders
        const focusedValue = this.querySelector<HTMLInputElement>('input:focus')?.value ?? null

        const isInvalid = state === 'invalid'
        const ariaRequiredAttr = required ? ' aria-required="true"' : ''
        const ariaInvalidAttr = isInvalid ? ' aria-invalid="true"' : ''

        // Each checkbox gets the control's invalid/valid visual when invalid/valid.
        const inputStateClass =
            state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''

        const legendHtml =
            label != null
                ? `<legend class="tc-checkbox-group-label">${esc(label)}${requiredMark(required)}</legend>`
                : ''

        const optionsClass = inline
            ? 'tc-checkbox-group-options tc-checkbox-group-options--inline'
            : 'tc-checkbox-group-options'

        const valueSet = new Set(this._value)
        const optionsHtml = this._options
            .map((opt, idx) => {
                const inputId = `${this._idPrefix}-${idx}`
                const checkedAttr = valueSet.has(opt.value) ? ' checked' : ''
                // A group-level `disabled` disables every box; a per-option
                // `disabled` only that row.
                const disabledAttr = disabled || opt.disabled ? ' disabled' : ''
                // Inner checkboxes carry no `name` — ElementInternals owns form
                // submission. Checkbox mutual exclusion is not applicable; the
                // checked state is managed entirely in JS.
                return [
                    `<div class="form-check">`,
                    `<input type="checkbox" class="form-check-input${inputStateClass}" id="${inputId}"`,
                    ` value="${esc(opt.value)}"${checkedAttr}${disabledAttr}>`,
                    `<label class="form-check-label" for="${inputId}">${esc(opt.label)}</label>`,
                    `</div>`,
                ].join('')
            })
            .join('')

        // A checkbox group is always a standalone field: ALWAYS render the reserved
        // slot (even empty) so it reserves its line and groups stay aligned. It is
        // the last child, placed after the option rows. The required-empty case
        // feeds the slot via _effectiveState → invalidText.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: help,
            invalidText: msg('selectionMinOne'),
            validText: 'Looks good!',
        })
        // Group has no single input — describe the fieldset itself.
        const describe = help || state ? ` aria-describedby="${this._helpId}"` : ''

        this.innerHTML = [
            `<fieldset class="tc-checkbox-group"${ariaRequiredAttr}${ariaInvalidAttr}${describe}>`,
            legendHtml,
            `<div class="${optionsClass}">`,
            optionsHtml,
            `</div>`,
            messageHtml,
            `</fieldset>`,
        ].join('')

        if (focusedValue !== null) {
            const inputs = this.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
            for (const input of Array.from(inputs)) {
                if (input.value === focusedValue) {
                    input.focus()
                    break
                }
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CheckboxGroup
    }
}

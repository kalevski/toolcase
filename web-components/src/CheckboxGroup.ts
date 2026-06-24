import { esc } from './internal/esc'
const TAG_NAME = 'tc-checkbox-group'

let _idCounter = 0

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
    private _options: CheckboxGroupOption[] = []
    private _value: string[] = []
    private _internals: ElementInternals

    onChange: ((checkedValues: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'inline', 'name', 'required']
    }

    constructor() {
        super()
        this._idPrefix = `tc-cbg-${++_idCounter}`
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
        // Re-sync form value when name changes — FormData keys are baked in at
        // setFormValue call time, so a name change requires a fresh call.
        if (attr === 'name') this._syncFormValue()
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

        // Patch aria-invalid in place without full re-render (preserves focus)
        const fieldset = this.querySelector<HTMLElement>('.tc-checkbox-group')
        if (fieldset && this.required) {
            if (this._value.length === 0) fieldset.setAttribute('aria-invalid', 'true')
            else fieldset.removeAttribute('aria-invalid')
        }

        this._syncFormValue()

        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value: this._value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(this._value)
    }

    private render(): void {
        const label = this.label
        const inline = this.inline
        const required = this.required

        // Preserve focus across re-renders
        const focusedValue = this.querySelector<HTMLInputElement>('input:focus')?.value ?? null

        const isInvalid = required && this._value.length === 0
        const ariaRequiredAttr = required ? ' aria-required="true"' : ''
        const ariaInvalidAttr = isInvalid ? ' aria-invalid="true"' : ''

        const legendHtml =
            label != null ? `<legend class="tc-checkbox-group-label">${esc(label)}</legend>` : ''

        const optionsClass = inline
            ? 'tc-checkbox-group-options tc-checkbox-group-options--inline'
            : 'tc-checkbox-group-options'

        const optionsHtml = this._options
            .map((opt, idx) => {
                const inputId = `${this._idPrefix}-${idx}`
                const checkedAttr = this._value.includes(opt.value) ? ' checked' : ''
                const disabledAttr = opt.disabled ? ' disabled' : ''
                // Inner checkboxes carry no `name` — ElementInternals owns form
                // submission. Checkbox mutual exclusion is not applicable; the
                // checked state is managed entirely in JS.
                return [
                    `<div class="form-check">`,
                    `<input type="checkbox" class="form-check-input" id="${inputId}"`,
                    ` value="${esc(opt.value)}"${checkedAttr}${disabledAttr}>`,
                    `<label class="form-check-label" for="${inputId}">${esc(opt.label)}</label>`,
                    `</div>`,
                ].join('')
            })
            .join('')

        this.innerHTML = [
            `<fieldset class="tc-checkbox-group"${ariaRequiredAttr}${ariaInvalidAttr}>`,
            legendHtml,
            `<div class="${optionsClass}">`,
            optionsHtml,
            `</div>`,
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

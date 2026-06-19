import { esc } from './internal/esc'
const TAG_NAME = 'tc-checkbox-group'

let _idCounter = 0

export interface CheckboxGroupOption {
    value: string
    label: string
    disabled?: boolean
}

export class CheckboxGroup extends HTMLElement {
    private _initialised = false
    private _idPrefix: string
    private _options: CheckboxGroupOption[] = []
    private _value: string[] = []

    onChange: ((checkedValues: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'inline', 'name', 'required']
    }

    constructor() {
        super()
        this._idPrefix = `tc-cbg-${++_idCounter}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('change', this._onNativeChange)
    }

    disconnectedCallback(): void {
        this.removeEventListener('change', this._onNativeChange)
    }

    attributeChangedCallback(_name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        if (this._initialised) this.render()
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
        const name = this.name
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
                const nameAttr = name ? ` name="${esc(name)}"` : ''

                return [
                    `<div class="form-check">`,
                    `<input type="checkbox" class="form-check-input" id="${inputId}"${nameAttr}`,
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

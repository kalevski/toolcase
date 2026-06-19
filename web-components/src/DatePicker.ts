import { esc } from './internal/esc'
const TAG_NAME = 'tc-date-picker'

let _idCounter = 0

export class DatePicker extends HTMLElement {
    private _inputId: string
    private _initialised = false

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'value', 'disabled', 'min', 'max']
    }

    constructor() {
        super()
        this._inputId = `tc-date-picker-${++_idCounter}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this.addEventListener('change', this._onNativeChange)
    }

    disconnectedCallback(): void {
        this.removeEventListener('change', this._onNativeChange)
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            const input = this.querySelector<HTMLInputElement>('input')
            if (input && input.value !== (next ?? '')) input.value = next ?? ''
            return
        }
        const hadFocus = this.querySelector('input') === document.activeElement
        this.render()
        if (hadFocus) this.querySelector<HTMLInputElement>('input')?.focus()
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get value(): string {
        return (
            this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value') ?? ''
        )
    }
    set value(v: string) {
        const input = this.querySelector<HTMLInputElement>('input')
        if (input) input.value = v
        this.setAttribute('value', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get min(): string | null {
        return this.getAttribute('min')
    }
    set min(v: string | null) {
        if (v != null) this.setAttribute('min', v)
        else this.removeAttribute('min')
    }

    get max(): string | null {
        return this.getAttribute('max')
    }
    set max(v: string | null) {
        if (v != null) this.setAttribute('max', v)
        else this.removeAttribute('max')
    }

    private _onNativeChange = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (input.tagName !== 'INPUT') return
        const newValue = input.value
        this.setAttribute('value', newValue)
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value: newValue },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(newValue)
    }

    private render(): void {
        const label = this.label
        const disabled = this.disabled
        const min = this.min
        const max = this.max
        const currentValue =
            this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value') ?? ''

        const disabledAttr = disabled ? ' disabled' : ''
        const minAttr = min != null ? ` min="${esc(min)}"` : ''
        const maxAttr = max != null ? ` max="${esc(max)}"` : ''
        const valueAttr = currentValue ? ` value="${esc(currentValue)}"` : ''

        const labelHtml =
            label != null
                ? `<label class="form-label" for="${this._inputId}">${esc(label)}</label>`
                : ''

        this.innerHTML = [
            `<div class="tc-date-picker">`,
            labelHtml,
            `<input id="${this._inputId}" type="date" class="form-control"${minAttr}${maxAttr}${valueAttr}${disabledAttr}>`,
            `</div>`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DatePicker
    }
}

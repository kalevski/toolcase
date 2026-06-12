const TAG_NAME = 'tc-range'

let _idCounter = 0

export class Range extends HTMLElement {

    private _inputId: string
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['min', 'max', 'step', 'value', 'disabled', 'label']
    }

    constructor() {
        super()
        this._inputId = `tc-range-${++_idCounter}`
    }

    connectedCallback(): void {
        this.render()
        this._initialised = true
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            const input = this.querySelector<HTMLInputElement>('input')
            if (input && input.value !== (next ?? '')) input.value = next ?? ''
            return
        }
        this.render()
    }

    get min(): string {
        return this.getAttribute('min') ?? '0'
    }
    set min(v: string) {
        this.setAttribute('min', v)
    }

    get max(): string {
        return this.getAttribute('max') ?? '100'
    }
    set max(v: string) {
        this.setAttribute('max', v)
    }

    get step(): string | null {
        return this.getAttribute('step')
    }
    set step(v: string | null) {
        if (v != null) this.setAttribute('step', v)
        else this.removeAttribute('step')
    }

    get value(): string {
        return this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value') ?? ''
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

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    private render(): void {
        const label = this.label
        const min = this.min
        const max = this.max
        const step = this.step
        const disabled = this.disabled
        const currentValue = this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value') ?? ''

        const stepAttr = step != null ? ` step="${esc(step)}"` : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const valueAttr = currentValue !== '' ? ` value="${esc(currentValue)}"` : ''

        const labelHtml = label != null
            ? `<label class="form-label" for="${this._inputId}">${esc(label)}</label>`
            : ''

        this.innerHTML = [
            labelHtml,
            `<input id="${this._inputId}" type="range" class="form-range"`,
            ` min="${esc(min)}" max="${esc(max)}"${stepAttr}${valueAttr}${disabledAttr}>`,
        ].join('')
    }
}

function esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Range
    }
}

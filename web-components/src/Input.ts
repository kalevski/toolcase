const TAG_NAME = 'tc-input'

let _idCounter = 0

export type InputSize = 'sm' | 'lg'
export type InputState = 'valid' | 'invalid'

const SIZES: InputSize[] = ['sm', 'lg']
const STATES: InputState[] = ['valid', 'invalid']

export class Input extends HTMLElement {

    private _inputId: string
    private _helpId: string
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['type', 'value', 'placeholder', 'label', 'size', 'disabled', 'readonly', 'required', 'state', 'help']
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._inputId = `tc-input-${uid}`
        this._helpId = `tc-input-help-${uid}`
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

    get type(): string {
        return this.getAttribute('type') ?? 'text'
    }
    set type(v: string) {
        this.setAttribute('type', v)
    }

    get value(): string {
        return this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        const input = this.querySelector<HTMLInputElement>('input')
        if (input) input.value = v
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

    get size(): InputSize | null {
        const v = this.getAttribute('size') as InputSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: InputSize | null) {
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

    get state(): InputState | null {
        const v = this.getAttribute('state') as InputState
        return STATES.includes(v) ? v : null
    }
    set state(v: InputState | null) {
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

    private render(): void {
        const label = this.label
        const size = this.size
        const state = this.state
        const help = this.help
        const disabled = this.disabled
        const readonly = this.readonly
        const required = this.required
        const placeholder = this.placeholder
        const currentValue = this.querySelector<HTMLInputElement>('input')?.value ?? this.getAttribute('value') ?? ''

        const sizeClass = size ? ` form-control-${size}` : ''
        const stateClass = state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
        const ariaDescribedBy = help ? ` aria-describedby="${this._helpId}"` : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const readonlyAttr = readonly ? ' readonly' : ''
        const requiredAttr = required ? ' required' : ''

        const labelHtml = label
            ? `<label class="form-label" for="${this._inputId}">${esc(label)}</label>`
            : ''

        const feedbackHtml = state === 'valid'
            ? `<div class="valid-feedback">Looks good!</div>`
            : state === 'invalid'
                ? `<div class="invalid-feedback">Please provide a valid value.</div>`
                : ''

        const helpHtml = help
            ? `<div id="${this._helpId}" class="form-text">${esc(help)}</div>`
            : ''

        this.innerHTML = [
            labelHtml,
            `<input id="${this._inputId}" type="${esc(this.type)}" class="form-control${sizeClass}${stateClass}"`,
            ` placeholder="${esc(placeholder)}" value="${esc(currentValue)}"${ariaDescribedBy}${disabledAttr}${readonlyAttr}${requiredAttr}>`,
            feedbackHtml,
            helpHtml,
        ].join('')
    }
}

function esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Input
    }
}

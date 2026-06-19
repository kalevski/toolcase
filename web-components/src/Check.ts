import { esc } from './internal/esc'
const TAG_NAME = 'tc-check'

let _idCounter = 0

export type CheckState = 'valid' | 'invalid'

const STATES: CheckState[] = ['valid', 'invalid']

export class Check extends HTMLElement {
    private _inputId: string
    private _initialised = false

    static get observedAttributes(): string[] {
        return [
            'checked',
            'value',
            'label',
            'indeterminate',
            'disabled',
            'inline',
            'reverse',
            'state',
        ]
    }

    constructor() {
        super()
        this._inputId = `tc-check-${++_idCounter}`
    }

    connectedCallback(): void {
        this.addEventListener('change', this._onNativeChange)
        this.render()
        this._initialised = true
    }

    disconnectedCallback(): void {
        this.removeEventListener('change', this._onNativeChange)
    }

    attributeChangedCallback(_name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        this.setAttribute('value', v)
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

    private _onNativeChange = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (input.tagName === 'INPUT') {
            if (input.checked) this.setAttribute('checked', '')
            else this.removeAttribute('checked')
        }
    }

    private render(): void {
        const label = this.label
        const state = this.state
        const checkedAttr = this.hasAttribute('checked') ? ' checked' : ''
        const indeterminate = this.indeterminate
        const disabled = this.disabled
        const inline = this.inline
        const reverse = this.reverse
        const value = this.value

        const inlineClass = inline ? ' form-check-inline' : ''
        const reverseClass = reverse ? ' form-check-reverse' : ''
        const stateClass =
            state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const valueAttr = value ? ` value="${esc(value)}"` : ''

        const labelHtml =
            label != null
                ? `<label class="form-check-label" for="${this._inputId}">${esc(label)}</label>`
                : ''

        const feedbackHtml =
            state === 'valid'
                ? `<div class="valid-feedback">Looks good!</div>`
                : state === 'invalid'
                  ? `<div class="invalid-feedback">Please check this field.</div>`
                  : ''

        this.innerHTML = [
            `<div class="form-check${inlineClass}${reverseClass}">`,
            `<input id="${this._inputId}" class="form-check-input${stateClass}" type="checkbox"${valueAttr}${checkedAttr}${disabledAttr}>`,
            labelHtml,
            feedbackHtml,
            `</div>`,
        ].join('')

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

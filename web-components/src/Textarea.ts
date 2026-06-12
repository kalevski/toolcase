const TAG_NAME = 'tc-textarea'

let _idCounter = 0

export type TextareaSize = 'sm' | 'lg'
export type TextareaState = 'valid' | 'invalid'

const SIZES: TextareaSize[] = ['sm', 'lg']
const STATES: TextareaState[] = ['valid', 'invalid']

export class Textarea extends HTMLElement {

    private _textareaId: string
    private _helpId: string
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['value', 'placeholder', 'label', 'size', 'disabled', 'readonly', 'required', 'state', 'help', 'rows']
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._textareaId = `tc-textarea-${uid}`
        this._helpId = `tc-textarea-help-${uid}`
    }

    connectedCallback(): void {
        this.render()
        this._initialised = true
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            const ta = this.querySelector<HTMLTextAreaElement>('textarea')
            if (ta && ta.value !== (next ?? '')) ta.value = next ?? ''
            return
        }
        this.render()
    }

    get value(): string {
        return this.querySelector<HTMLTextAreaElement>('textarea')?.value ?? this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        const ta = this.querySelector<HTMLTextAreaElement>('textarea')
        if (ta) ta.value = v
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

    get size(): TextareaSize | null {
        const v = this.getAttribute('size') as TextareaSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: TextareaSize | null) {
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

    get state(): TextareaState | null {
        const v = this.getAttribute('state') as TextareaState
        return STATES.includes(v) ? v : null
    }
    set state(v: TextareaState | null) {
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

    get rows(): number {
        const v = parseInt(this.getAttribute('rows') ?? '', 10)
        return isNaN(v) || v < 1 ? 3 : v
    }
    set rows(v: number) {
        this.setAttribute('rows', String(v))
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
        const rows = this.rows
        const currentValue = this.querySelector<HTMLTextAreaElement>('textarea')?.value ?? this.getAttribute('value') ?? ''

        const sizeClass = size ? ` form-control-${size}` : ''
        const stateClass = state === 'valid' ? ' is-valid' : state === 'invalid' ? ' is-invalid' : ''
        const ariaDescribedBy = help ? ` aria-describedby="${this._helpId}"` : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const readonlyAttr = readonly ? ' readonly' : ''
        const requiredAttr = required ? ' required' : ''

        const labelHtml = label
            ? `<label class="form-label" for="${this._textareaId}">${esc(label)}</label>`
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
            `<textarea id="${this._textareaId}" class="form-control${sizeClass}${stateClass}"`,
            ` rows="${rows}" placeholder="${esc(placeholder)}"${ariaDescribedBy}${disabledAttr}${readonlyAttr}${requiredAttr}>`,
            `${esc(currentValue)}</textarea>`,
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
        [TAG_NAME]: Textarea
    }
}

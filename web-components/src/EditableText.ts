import { esc } from './internal/esc'
const TAG_NAME = 'tc-editable-text'

export class EditableText extends HTMLElement {
    private _initialised = false
    private _committedValue = ''

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['default-value', 'disabled', 'placeholder', 'aria-label']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._committedValue = this.getAttribute('default-value') ?? ''
            this.render()
            this._initialised = true
        }
        this.addEventListener('keydown', this._onKeyDown)
        this.addEventListener('focusout', this._onFocusOut)
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this._onKeyDown)
        this.removeEventListener('focusout', this._onFocusOut)
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'default-value') {
            const newVal = next ?? ''
            this._committedValue = newVal
            const input = this.querySelector<HTMLInputElement>('input')
            if (input && !input.matches(':focus')) {
                input.value = newVal
            }
            return
        }
        const focusedDraft = this.querySelector<HTMLInputElement>('input:focus')?.value ?? null
        this.render()
        if (focusedDraft !== null) {
            const input = this.querySelector<HTMLInputElement>('input')
            if (input) {
                input.value = focusedDraft
                input.focus()
            }
        }
    }

    get defaultValue(): string {
        return this.getAttribute('default-value') ?? ''
    }
    set defaultValue(v: string) {
        this.setAttribute('default-value', v)
    }

    get value(): string {
        return this._committedValue
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? ''
    }
    set placeholder(v: string) {
        this.setAttribute('placeholder', v)
    }

    private _onKeyDown = (e: KeyboardEvent): void => {
        const input = e.target as HTMLInputElement
        if (!input || input.tagName !== 'INPUT') return
        if (e.key === 'Enter') {
            e.preventDefault()
            const draft = input.value
            if (draft !== this._committedValue) {
                this._committedValue = draft
                this._fireChange(draft)
            }
            input.blur()
        } else if (e.key === 'Escape') {
            input.value = this._committedValue
            input.blur()
        }
    }

    private _onFocusOut = (e: FocusEvent): void => {
        const input = e.target as HTMLInputElement
        if (!input || input.tagName !== 'INPUT') return
        const draft = input.value
        if (draft !== this._committedValue) {
            this._committedValue = draft
            this._fireChange(draft)
        }
    }

    private _fireChange(value: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    private render(): void {
        const placeholder = this.placeholder
        const disabled = this.disabled
        const ariaLabel = this.getAttribute('aria-label')

        const disabledAttr = disabled ? ' disabled' : ''
        const placeholderAttr = placeholder ? ` placeholder="${esc(placeholder)}"` : ''
        const ariaAttr = ariaLabel ? ` aria-label="${esc(ariaLabel)}"` : ''

        this.innerHTML = `<input type="text" class="form-control tc-editable-text__input"${disabledAttr}${placeholderAttr}${ariaAttr} value="${esc(this._committedValue)}">`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EditableText
    }
}

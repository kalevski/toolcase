const TAG_NAME = 'tc-key-binder'

export interface KeyBinderEventMap {
    'tc-change': CustomEvent<{ value: string; code: string; key: string }>
    'tc-cancel': CustomEvent<void>
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

export class KeyBinder extends HTMLElement {
    private _capturing = false

    /** Callback fired alongside the `tc-change` CustomEvent. */
    onChange: ((detail: { value: string; code: string; key: string }) => void) | null = null
    /** Callback fired alongside the `tc-cancel` CustomEvent. */
    onCancel: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'placeholder', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', this.disabled ? '-1' : '0')
        this.addEventListener('click', this._handleClick)
        this.addEventListener('keydown', this._handleHostKey)
        this.addEventListener('blur', this._handleBlur)
        this.render()
    }

    disconnectedCallback(): void {
        this._stopCapture(false)
        this.removeEventListener('click', this._handleClick)
        this.removeEventListener('keydown', this._handleHostKey)
        this.removeEventListener('blur', this._handleBlur)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected) return
        // Sync tabindex with the disabled state when that attribute changes.
        if (name === 'disabled') {
            this.setAttribute('tabindex', this.disabled ? '-1' : '0')
        }
        this.render()
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? 'Click to bind'
    }
    set placeholder(v: string) {
        if (v) this.setAttribute('placeholder', v)
        else this.removeAttribute('placeholder')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    /** Read-only: `true` while waiting for the next key press. */
    get capturing(): boolean {
        return this._capturing
    }

    private _keyHandler = (event: KeyboardEvent): void => this._handleCaptureKey(event)

    private _startCapture(): void {
        if (this._capturing) return
        this._capturing = true
        this.setAttribute('capturing', '')
        window.addEventListener('keydown', this._keyHandler, true)
        this.render()
    }

    private _stopCapture(emitCancel: boolean): void {
        if (!this._capturing) return
        this._capturing = false
        this.removeAttribute('capturing')
        window.removeEventListener('keydown', this._keyHandler, true)
        this.render()
        if (emitCancel) {
            this.dispatchEvent(new CustomEvent('tc-cancel', { bubbles: true, composed: true, detail: undefined }))
            if (typeof this.onCancel === 'function') this.onCancel()
        }
    }

    private _handleCaptureKey(event: KeyboardEvent): void {
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'Escape') {
            this._stopCapture(true)
            return
        }
        const code = event.code
        const key = event.key
        const value = key.length === 1 ? key.toUpperCase() : key
        this.value = value
        this._stopCapture(false)
        const detail = { value, code, key }
        this.dispatchEvent(new CustomEvent('tc-change', { bubbles: true, composed: true, detail }))
        if (typeof this.onChange === 'function') this.onChange(detail)
    }

    private _handleClick = (): void => {
        if (this.disabled) return
        this._startCapture()
    }

    private _handleHostKey = (event: KeyboardEvent): void => {
        if (this.disabled || this._capturing) return
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            this._startCapture()
        }
    }

    private _handleBlur = (): void => {
        if (this._capturing) this._stopCapture(true)
    }

    private render(): void {
        const capturing = this._capturing
        const hasValue = !!this.value
        const disabled = this.disabled

        // Reflect component-owned state classes onto the host.
        this.classList.toggle('tc-key-binder--capturing', capturing)
        this.classList.toggle('tc-key-binder--empty', !hasValue && !capturing)
        this.classList.toggle('tc-key-binder--disabled', disabled)

        // Keep aria-disabled in sync with the disabled state.
        if (disabled) {
            this.setAttribute('aria-disabled', 'true')
        } else {
            this.removeAttribute('aria-disabled')
        }

        const displayText = capturing
            ? 'Press any key…'
            : hasValue
              ? this.value
              : this.placeholder

        this.innerHTML = `<span class="tc-key-binder__label">${esc(displayText)}</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: KeyBinder
    }
}

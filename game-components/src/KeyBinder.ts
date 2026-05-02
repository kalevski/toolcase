const TAG_NAME = 'gc-key-binder'

export interface KeyBinderEventMap {
    change: CustomEvent<{ value: string; code: string; key: string }>
    cancel: CustomEvent<void>
}

export class KeyBinder extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['value', 'placeholder', 'disabled']
    }

    private _capturing: boolean = false
    private keyHandler = (event: KeyboardEvent) => this.handleCaptureKey(event)

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', this.disabled ? '-1' : '0')
        this.addEventListener('click', this.handleClick)
        this.addEventListener('keydown', this.handleHostKey)
        this.addEventListener('blur', this.handleBlur)
        this.render()
    }

    disconnectedCallback(): void {
        this.stopCapture(false)
        this.removeEventListener('click', this.handleClick)
        this.removeEventListener('keydown', this.handleHostKey)
        this.removeEventListener('blur', this.handleBlur)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
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

    get capturing(): boolean {
        return this._capturing
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private handleClick = (): void => {
        if (this.disabled) return
        this.startCapture()
    }

    private handleHostKey = (event: KeyboardEvent): void => {
        if (this.disabled || this._capturing) return
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            this.startCapture()
        }
    }

    private handleBlur = (): void => {
        if (this._capturing) this.stopCapture(true)
    }

    private startCapture(): void {
        if (this._capturing) return
        this._capturing = true
        this.setAttribute('capturing', '')
        window.addEventListener('keydown', this.keyHandler, true)
        this.render()
    }

    private stopCapture(emitCancel: boolean): void {
        if (!this._capturing) return
        this._capturing = false
        this.removeAttribute('capturing')
        window.removeEventListener('keydown', this.keyHandler, true)
        this.render()
        if (emitCancel) this.emit('cancel')
    }

    private handleCaptureKey(event: KeyboardEvent): void {
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'Escape') {
            this.stopCapture(true)
            return
        }
        const code = event.code
        const key = event.key
        const value = key.length === 1 ? key.toUpperCase() : key
        this.value = value
        this.stopCapture(false)
        this.emit('change', { value, code, key })
    }

    private render(): void {
        const display = this._capturing
            ? 'Press any key…'
            : (this.value || this.placeholder)
        const cls = `gc-key-binder-pad${this._capturing ? ' is-capturing' : ''}${!this.value && !this._capturing ? ' is-empty' : ''}`
        this.innerHTML = `<span class="${cls}">${this.escape(display)}</span>`
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, KeyBinder)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: KeyBinder
    }
}

const TAG_NAME = 'gc-toggle'

export interface ToggleEventMap {
    change: CustomEvent<{ on: boolean }>
}

export class Toggle extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['on', 'disabled']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'switch')
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', this.disabled ? '-1' : '0')
        this.setAttribute('aria-checked', String(this.on))
        if (this.disabled) this.setAttribute('aria-disabled', 'true')
        this.addEventListener('click', this.handleActivate)
        this.addEventListener('keydown', this.handleKey)
        this.render()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this.handleActivate)
        this.removeEventListener('keydown', this.handleKey)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected) return
        if (name === 'on') this.setAttribute('aria-checked', String(this.on))
        if (name === 'disabled') {
            if (this.disabled) {
                this.setAttribute('aria-disabled', 'true')
                this.setAttribute('tabindex', '-1')
            } else {
                this.removeAttribute('aria-disabled')
                this.setAttribute('tabindex', '0')
            }
        }
        this.render()
    }

    get on(): boolean {
        return this.hasAttribute('on')
    }
    set on(value: boolean) {
        if (value) this.setAttribute('on', '')
        else this.removeAttribute('on')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(value: boolean) {
        if (value) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private handleActivate = (event: Event): void => {
        if (this.disabled) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        this.toggle()
    }

    private handleKey = (event: KeyboardEvent): void => {
        if (this.disabled) return
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        this.toggle()
    }

    private toggle(): void {
        this.on = !this.on
        this.dispatchEvent(new CustomEvent('change', { detail: { on: this.on }, bubbles: true, composed: true }))
    }

    private render(): void {
        this.innerHTML = `<span class="gc-toggle-track" aria-hidden="true"><span class="gc-toggle-knob"></span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Toggle
    }
}

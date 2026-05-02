const TAG_NAME = 'gc-metal-button'

export type MetalButtonVariant = 'default' | 'primary' | 'danger' | 'ghost'
export type MetalButtonSize = 'sm' | 'md' | 'lg'

export class MetalButton extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['variant', 'size', 'disabled']
    }

    private root: ShadowRoot
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)
    private clickCaptureHandler = (event: Event) => this.handleClickCapture(event)

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        if (!this.hasAttribute('variant')) this.setAttribute('variant', 'default')
        if (!this.hasAttribute('size')) this.setAttribute('size', 'md')
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        this.updateState()
        this.addEventListener('keydown', this.keyHandler)
        this.addEventListener('click', this.clickCaptureHandler, true)
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this.keyHandler)
        this.removeEventListener('click', this.clickCaptureHandler, true)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.updateState()
    }

    get variant(): MetalButtonVariant {
        return (this.getAttribute('variant') as MetalButtonVariant) || 'default'
    }
    set variant(value: MetalButtonVariant) {
        this.setAttribute('variant', value)
    }

    get size(): MetalButtonSize {
        return (this.getAttribute('size') as MetalButtonSize) || 'md'
    }
    set size(value: MetalButtonSize) {
        this.setAttribute('size', value)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(value: boolean) {
        if (value) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private updateState(): void {
        if (this.disabled) {
            this.setAttribute('aria-disabled', 'true')
            this.removeAttribute('tabindex')
        } else {
            this.removeAttribute('aria-disabled')
            this.setAttribute('tabindex', '0')
        }
    }

    private handleClickCapture(event: Event): void {
        if (this.disabled) {
            event.stopImmediatePropagation()
            event.preventDefault()
        }
    }

    private handleKey(event: KeyboardEvent): void {
        if (this.disabled) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        this.click()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MetalButton
    }
}

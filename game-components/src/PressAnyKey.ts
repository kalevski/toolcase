const TAG_NAME = 'gc-press-any-key'

export interface PressAnyKeyEventMap {
    continue: CustomEvent<void>
}

export class PressAnyKey extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['text']
    }

    private keyHandler = (event: KeyboardEvent) => this.handleContinue(event)
    private mouseHandler = () => this.fire()

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')
        document.addEventListener('keydown', this.keyHandler)
        this.addEventListener('mousedown', this.mouseHandler)
        this.render()
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this.keyHandler)
        this.removeEventListener('mousedown', this.mouseHandler)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get text(): string {
        return this.getAttribute('text') ?? 'Press Any Key'
    }
    set text(v: string) {
        if (v) this.setAttribute('text', v)
        else this.removeAttribute('text')
    }

    private fire(): void {
        this.dispatchEvent(new CustomEvent('continue', { bubbles: true, composed: true }))
    }

    private handleContinue(event: KeyboardEvent): void {
        if (!this.isConnected) return
        const key = event.key
        if (key === 'Tab' || key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return
        this.fire()
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        this.innerHTML = `<span class="gc-press-any-key-text">${this.escape(this.text)}</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PressAnyKey
    }
}

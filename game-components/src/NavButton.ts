const TAG_NAME = 'gc-nav-button'

export type NavButtonKind = 'back' | 'close'

export class NavButton extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['kind', 'label', 'size']
    }

    private root: ShadowRoot
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        if (!this.hasAttribute('kind')) this.setAttribute('kind', 'back')
        if (!this.hasAttribute('role')) this.setAttribute('role', 'button')
        this.setAttribute('tabindex', '0')
        this.addEventListener('keydown', this.keyHandler)
        this.render()
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this.keyHandler)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get kind(): NavButtonKind {
        return (this.getAttribute('kind') as NavButtonKind) || 'back'
    }
    set kind(value: NavButtonKind) {
        this.setAttribute('kind', value)
    }

    get label(): string {
        return this.getAttribute('label') || ''
    }
    set label(value: string) {
        if (value) this.setAttribute('label', value)
        else this.removeAttribute('label')
    }

    get size(): number | null {
        const value = this.getAttribute('size')
        if (value == null) return null
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    set size(value: number | null) {
        if (value == null) this.removeAttribute('size')
        else this.setAttribute('size', String(value))
    }

    private handleKey(event: KeyboardEvent): void {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        this.click()
    }

    private render(): void {
        const size = this.size
        if (size != null) this.style.setProperty('--gc-nav-button-size', `${size}px`)
        else this.style.removeProperty('--gc-nav-button-size')

        const kind = this.kind
        const label = this.label
        const ariaLabel = label || (kind === 'close' ? 'Close' : 'Back')
        this.setAttribute('aria-label', ariaLabel)

        const glyph = kind === 'close' ? '✕' : '←'
        this.innerHTML = `<span class="gc-nav-button-glyph">${glyph}</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: NavButton
    }
}

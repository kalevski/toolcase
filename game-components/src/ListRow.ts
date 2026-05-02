const TAG_NAME = 'gc-list-row'

export interface ListRowEventMap {
    select: CustomEvent<void>
}

export class ListRow extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected', 'accent']
    }

    private root: ShadowRoot
    private clickHandler = () => this.handleClick()
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'option')
        this.setAttribute('tabindex', '0')
        this.addEventListener('click', this.clickHandler)
        this.addEventListener('keydown', this.keyHandler)
        this.updateAria()
        this.applyAccent()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this.clickHandler)
        this.removeEventListener('keydown', this.keyHandler)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected) return
        this.updateAria()
        this.applyAccent()
    }

    get selected(): boolean {
        return this.hasAttribute('selected')
    }
    set selected(value: boolean) {
        if (value) this.setAttribute('selected', '')
        else this.removeAttribute('selected')
    }

    get accent(): string {
        return this.getAttribute('accent') || ''
    }
    set accent(value: string) {
        if (value) this.setAttribute('accent', value)
        else this.removeAttribute('accent')
    }

    private updateAria(): void {
        this.setAttribute('aria-selected', this.selected ? 'true' : 'false')
    }

    private applyAccent(): void {
        const accent = this.accent
        if (accent) this.style.setProperty('--gc-list-row-accent', accent)
        else this.style.removeProperty('--gc-list-row-accent')
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private handleClick(): void {
        this.emit('select')
    }

    private handleKey(event: KeyboardEvent): void {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        this.handleClick()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ListRow
    }
}

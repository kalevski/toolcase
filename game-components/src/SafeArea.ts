const TAG_NAME = 'gc-safe-area'

export class SafeArea extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['extra']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback(): void {
        if (!this.root.firstChild) {
            this.root.innerHTML = `<slot></slot>`
        }
        this.applyExtra()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.applyExtra()
    }

    get extra(): string {
        return this.getAttribute('extra') ?? ''
    }
    set extra(value: string) {
        if (value) this.setAttribute('extra', value)
        else this.removeAttribute('extra')
    }

    private applyExtra(): void {
        const e = this.extra || '0px'
        this.style.setProperty('--gc-safe-area-extra', e)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SafeArea
    }
}

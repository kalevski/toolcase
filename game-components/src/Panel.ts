const TAG_NAME = 'gc-panel'

export class Panel extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['bordered', 'corners', 'parchment']
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
    }

    get bordered(): boolean {
        return this.hasAttribute('bordered')
    }
    set bordered(value: boolean) {
        if (value) this.setAttribute('bordered', '')
        else this.removeAttribute('bordered')
    }

    get corners(): boolean {
        return this.hasAttribute('corners')
    }
    set corners(value: boolean) {
        if (value) this.setAttribute('corners', '')
        else this.removeAttribute('corners')
    }

    get parchment(): boolean {
        return this.hasAttribute('parchment')
    }
    set parchment(value: boolean) {
        if (value) this.setAttribute('parchment', '')
        else this.removeAttribute('parchment')
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Panel)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Panel
    }
}

const TAG_NAME = 'gc-key'

export class Key extends HTMLElement {

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
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Key)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Key
    }
}

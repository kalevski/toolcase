const TAG_NAME = 'gc-gilded-frame'

export type GildedFrameTone = 'dark' | 'leather' | 'transparent'
export type GildedFramePadding = 'none' | 'sm' | 'md' | 'lg' | 'xl'

export class GildedFrame extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['tone', 'padding']
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
        if (!this.hasAttribute('tone')) {
            this.setAttribute('tone', 'dark')
        }
        if (!this.hasAttribute('padding')) {
            this.setAttribute('padding', 'md')
        }
    }

    get tone(): GildedFrameTone {
        return (this.getAttribute('tone') as GildedFrameTone) || 'dark'
    }
    set tone(value: GildedFrameTone) {
        this.setAttribute('tone', value)
    }

    get padding(): GildedFramePadding {
        return (this.getAttribute('padding') as GildedFramePadding) || 'md'
    }
    set padding(value: GildedFramePadding) {
        this.setAttribute('padding', value)
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, GildedFrame)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GildedFrame
    }
}

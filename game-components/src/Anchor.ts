const TAG_NAME = 'gc-anchor'

export type AnchorPosition =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right'

export class Anchor extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['position', 'inset']
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
        this.applyLayout()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.applyLayout()
        }
    }

    get position(): AnchorPosition {
        return (this.getAttribute('position') as AnchorPosition) ?? 'top-left'
    }
    set position(value: AnchorPosition) {
        this.setAttribute('position', value)
    }

    get inset(): string {
        return this.getAttribute('inset') ?? '0px'
    }
    set inset(value: string) {
        this.setAttribute('inset', value)
    }

    private applyLayout(): void {
        const i = this.inset
        const pos = this.position

        this.style.position = 'absolute'
        this.style.top = ''
        this.style.right = ''
        this.style.bottom = ''
        this.style.left = ''
        this.style.transform = ''

        switch (pos) {
            case 'top-left':
                this.style.top = i
                this.style.left = i
                break
            case 'top':
                this.style.top = i
                this.style.left = '50%'
                this.style.transform = 'translateX(-50%)'
                break
            case 'top-right':
                this.style.top = i
                this.style.right = i
                break
            case 'left':
                this.style.left = i
                this.style.top = '50%'
                this.style.transform = 'translateY(-50%)'
                break
            case 'center':
                this.style.top = '50%'
                this.style.left = '50%'
                this.style.transform = 'translate(-50%, -50%)'
                break
            case 'right':
                this.style.right = i
                this.style.top = '50%'
                this.style.transform = 'translateY(-50%)'
                break
            case 'bottom-left':
                this.style.bottom = i
                this.style.left = i
                break
            case 'bottom':
                this.style.bottom = i
                this.style.left = '50%'
                this.style.transform = 'translateX(-50%)'
                break
            case 'bottom-right':
                this.style.bottom = i
                this.style.right = i
                break
        }
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Anchor)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Anchor
    }
}

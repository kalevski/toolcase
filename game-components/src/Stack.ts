const TAG_NAME = 'gc-stack'

export class Stack extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['direction', 'gap', 'align', 'justify', 'wrap', 'inline']
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

    get direction(): 'vertical' | 'horizontal' {
        return (this.getAttribute('direction') as 'vertical' | 'horizontal') ?? 'vertical'
    }
    set direction(value: 'vertical' | 'horizontal') {
        this.setAttribute('direction', value)
    }

    get gap(): string {
        return this.getAttribute('gap') ?? ''
    }
    set gap(value: string) {
        this.setAttribute('gap', value)
    }

    get align(): string {
        return this.getAttribute('align') ?? ''
    }
    set align(value: string) {
        this.setAttribute('align', value)
    }

    get justify(): string {
        return this.getAttribute('justify') ?? ''
    }
    set justify(value: string) {
        this.setAttribute('justify', value)
    }

    get wrap(): boolean {
        return this.hasAttribute('wrap')
    }
    set wrap(value: boolean) {
        if (value) this.setAttribute('wrap', '')
        else this.removeAttribute('wrap')
    }

    get inline(): boolean {
        return this.hasAttribute('inline')
    }
    set inline(value: boolean) {
        if (value) this.setAttribute('inline', '')
        else this.removeAttribute('inline')
    }

    private applyLayout(): void {
        this.style.display = this.inline ? 'inline-flex' : 'flex'
        this.style.flexDirection = this.direction === 'horizontal' ? 'row' : 'column'
        this.style.gap = this.gap || '0px'
        this.style.alignItems = this.align || 'stretch'
        this.style.justifyContent = this.justify || 'flex-start'
        this.style.flexWrap = this.wrap ? 'wrap' : 'nowrap'
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Stack
    }
}

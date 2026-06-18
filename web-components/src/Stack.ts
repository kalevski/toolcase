const TAG_NAME = 'tc-stack'

export type StackDirection = 'vertical' | 'horizontal'
const DIRECTIONS: StackDirection[] = ['vertical', 'horizontal']

export class Stack extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['direction', 'gap', 'align', 'justify', 'wrap', 'inline']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get direction(): StackDirection {
        const v = this.getAttribute('direction')
        return DIRECTIONS.includes(v as StackDirection) ? (v as StackDirection) : 'vertical'
    }
    set direction(v: StackDirection) {
        if (DIRECTIONS.includes(v)) this.setAttribute('direction', v)
        else this.removeAttribute('direction')
    }

    get gap(): string {
        return this.getAttribute('gap') ?? ''
    }
    set gap(v: string) {
        if (v) this.setAttribute('gap', v)
        else this.removeAttribute('gap')
    }

    get align(): string {
        return this.getAttribute('align') ?? ''
    }
    set align(v: string) {
        if (v) this.setAttribute('align', v)
        else this.removeAttribute('align')
    }

    get justify(): string {
        return this.getAttribute('justify') ?? ''
    }
    set justify(v: string) {
        if (v) this.setAttribute('justify', v)
        else this.removeAttribute('justify')
    }

    get wrap(): boolean {
        return this.hasAttribute('wrap')
    }
    set wrap(v: boolean) {
        if (v) this.setAttribute('wrap', '')
        else this.removeAttribute('wrap')
    }

    get inline(): boolean {
        return this.hasAttribute('inline')
    }
    set inline(v: boolean) {
        if (v) this.setAttribute('inline', '')
        else this.removeAttribute('inline')
    }

    // Purely structural — no innerHTML, no slots. Mutates inline styles directly;
    // CSS provides defaults via --bs-stack-* vars when attributes are absent.
    private render(): void {
        this.style.flexDirection = this.direction === 'horizontal' ? 'row' : 'column'
        this.style.gap = this.getAttribute('gap') || ''
        this.style.alignItems = this.getAttribute('align') || ''
        this.style.justifyContent = this.getAttribute('justify') || ''
        this.style.flexWrap = this.wrap ? 'wrap' : 'nowrap'
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Stack
    }
}

import { setHostClass } from './internal/host-class'
const TAG_NAME = 'tc-input-group'

export type InputGroupSize = 'sm' | 'lg'

const SIZES: InputGroupSize[] = ['sm', 'lg']

export class InputGroup extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['size']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get size(): InputGroupSize | null {
        const v = this.getAttribute('size') as InputGroupSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: InputGroupSize | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    private render(): void {
        const size = this.size
        const sizeClass = size ? ` input-group-${size}` : ''
        // THE HOST IS THE GROUP — the controls stay the consumer's own children.
        setHostClass(this, `input-group${sizeClass}`)
    }

    private _updateGroup(): void {
        const inner = this.querySelector<HTMLElement>('.input-group')
        if (!inner) return
        const size = this.size
        inner.className = size ? `input-group input-group-${size}` : 'input-group'
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InputGroup
    }
}

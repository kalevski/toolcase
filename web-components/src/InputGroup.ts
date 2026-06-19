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
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector<HTMLElement>('.input-group')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._updateGroup()
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
        this.innerHTML = `<div class="input-group${sizeClass}"></div>`
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

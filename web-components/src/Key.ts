const TAG_NAME = 'tc-key'

export type KeySize = 'sm' | 'md' | 'lg'
export type KeyVariant = 'default' | 'active'

const SIZES: KeySize[] = ['sm', 'md', 'lg']
const VARIANTS: KeyVariant[] = ['default', 'active']

export class Key extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['size', 'variant']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-key-content')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-key-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-key-content')
        if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
    }

    get size(): KeySize {
        const v = this.getAttribute('size') as KeySize
        return SIZES.includes(v) ? v : 'md'
    }
    set size(v: KeySize) {
        this.setAttribute('size', v)
    }

    get variant(): KeyVariant {
        const v = this.getAttribute('variant') as KeyVariant
        return VARIANTS.includes(v) ? v : 'default'
    }
    set variant(v: KeyVariant) {
        this.setAttribute('variant', v)
    }

    private render(): void {
        const size = this.size
        const variant = this.variant
        const variantClass = variant === 'active' ? ' tc-key--active' : ''
        this.innerHTML = `<kbd class="tc-key tc-key--${size}${variantClass}"><span class="tc-key-content"></span></kbd>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Key
    }
}

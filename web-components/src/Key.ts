import { setHostClass } from './internal/host-class'
import { setAttr } from './internal/tc-element'
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
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get size(): KeySize {
        const v = this.getAttribute('size') as KeySize
        return SIZES.includes(v) ? v : 'md'
    }
    set size(v: KeySize) {
        setAttr(this, 'size', v)
    }

    get variant(): KeyVariant {
        const v = this.getAttribute('variant') as KeyVariant
        return VARIANTS.includes(v) ? v : 'default'
    }
    set variant(v: KeyVariant) {
        setAttr(this, 'variant', v)
    }

    private render(): void {
        const size = this.size
        const variant = this.variant
        const variantClass = variant === 'active' ? ' tc-key--active' : ''
        // THE HOST IS THE KEYCAP: the legend the consumer wrote stays their child.
        setHostClass(this, `tc-key tc-key--${size}${variantClass}`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Key
    }
}

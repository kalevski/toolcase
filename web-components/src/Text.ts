const TAG_NAME = 'tc-text'

export type TextVariant = 'default' | 'muted' | 'code' | 'mono' | 'truncate'
export type TextSize = 'small' | 'default' | 'large'
export type TextAs = 'p' | 'span' | 'small' | 'div'

const VARIANTS: TextVariant[] = ['default', 'muted', 'code', 'mono', 'truncate']
const SIZES: TextSize[] = ['small', 'default', 'large']
const AS_TAGS: TextAs[] = ['p', 'span', 'small', 'div']

export class Text extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'size', 'as']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-text-content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._setTruncateTitle()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-text-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-text-content')
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
        this._setTruncateTitle()
    }

    get variant(): TextVariant {
        const v = this.getAttribute('variant') as TextVariant
        return VARIANTS.includes(v) ? v : 'default'
    }
    set variant(v: TextVariant) {
        this.setAttribute('variant', v)
    }

    get size(): TextSize {
        const v = this.getAttribute('size') as TextSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: TextSize) {
        this.setAttribute('size', v)
    }

    get as(): TextAs {
        const v = this.getAttribute('as') as TextAs
        return AS_TAGS.includes(v) ? v : 'p'
    }
    set as(v: TextAs) {
        this.setAttribute('as', v)
    }

    // For truncate variant: expose full text via title so screen readers and
    // hover tooltips can access content that is visually clipped.
    private _setTruncateTitle(): void {
        const inner = this.querySelector('.tc-text-content')
        if (!inner) return
        const el = inner.parentElement
        if (!el) return
        if (this.variant === 'truncate') {
            el.setAttribute('title', el.textContent ?? '')
        } else {
            el.removeAttribute('title')
        }
    }

    private render(): void {
        const tag = this.as
        const variant = this.variant
        const size = this.size
        this.innerHTML = `<${tag} class="tc-text tc-text-${variant} tc-text-${size}"><span class="tc-text-content"></span></${tag}>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Text
    }
}

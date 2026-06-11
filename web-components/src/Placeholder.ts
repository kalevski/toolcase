const TAG_NAME = 'tc-placeholder'

export type PlaceholderSize = 'xs' | 'sm' | 'lg'
export type PlaceholderAnimation = 'glow' | 'wave'
export type PlaceholderVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'

const SIZES: PlaceholderSize[] = ['xs', 'sm', 'lg']
const ANIMATIONS: PlaceholderAnimation[] = ['glow', 'wave']
const VARIANTS: PlaceholderVariant[] = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']

export class Placeholder extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['width', 'size', 'animation', 'variant']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this._render(slotContent)
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-placeholder-content')
        const isUserContent = inner?.hasAttribute('data-tc-user') ?? false
        if (isUserContent && inner) {
            const slotContent = Array.from(inner.childNodes)
            this._render(slotContent)
        } else {
            this._render([])
        }
    }

    get width(): string | null {
        return this.getAttribute('width')
    }
    set width(v: string | null) {
        if (v != null) this.setAttribute('width', v)
        else this.removeAttribute('width')
    }

    get size(): PlaceholderSize | null {
        const v = this.getAttribute('size') as PlaceholderSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: PlaceholderSize | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    get animation(): PlaceholderAnimation | null {
        const v = this.getAttribute('animation') as PlaceholderAnimation
        return ANIMATIONS.includes(v) ? v : null
    }
    set animation(v: PlaceholderAnimation | null) {
        if (v != null) this.setAttribute('animation', v)
        else this.removeAttribute('animation')
    }

    get variant(): PlaceholderVariant | null {
        const v = this.getAttribute('variant') as PlaceholderVariant
        return VARIANTS.includes(v) ? v : null
    }
    set variant(v: PlaceholderVariant | null) {
        if (v != null) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }

    private _render(slotContent: Node[]): void {
        const animation = this.animation
        const animClass = animation ? ` placeholder-${animation}` : ''

        if (slotContent.length > 0) {
            this.innerHTML = `<div class="tc-placeholder-content${animClass}" data-tc-user></div>`
            const wrapper = this.querySelector('.tc-placeholder-content')!
            slotContent.forEach(n => wrapper.appendChild(n))
        } else {
            const rawWidth = this.getAttribute('width')
            const size = this.size
            const variant = this.variant

            let colClass = ''
            let styleAttr = ''
            if (rawWidth !== null) {
                const colNum = parseInt(rawWidth, 10)
                if (!isNaN(colNum) && colNum >= 1 && colNum <= 12) {
                    colClass = ` col-${colNum}`
                } else {
                    styleAttr = ` style="width:${rawWidth}"`
                }
            }

            const sizeClass = size ? ` placeholder-${size}` : ''
            const variantClass = variant ? ` bg-${variant}` : ''

            this.innerHTML = `<div class="tc-placeholder-content${animClass}"><span class="placeholder${colClass}${sizeClass}${variantClass}"${styleAttr}></span></div>`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Placeholder
    }
}

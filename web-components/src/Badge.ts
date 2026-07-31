import { VARIANTS_FULL } from './internal/variants'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-badge'

export type BadgeVariant =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'light'
    | 'dark'

const VARIANTS: BadgeVariant[] = [...VARIANTS_FULL]

/** `xs` is the phone design's chip scale: `3px 9px` padding, `700 10px` type. */
export type BadgeSize = 'xs'
const SIZES: BadgeSize[] = ['xs']

/**
 * `neutral` replaces the solid variant fill with the design's meta chip — a white
 * pill, hairline border, muted ink, regular weight. A TONE rather than a variant
 * because it is deliberately colourless: a chip reading „30 мин" must not compete
 * with the season badge beside it.
 */
export type BadgeTone = 'neutral'
const TONES: BadgeTone[] = ['neutral']

export class Badge extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'pill', 'text', 'size', 'tone']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            if (!this.hasAttribute('text')) {
                const inner = this.querySelector('.tc-badge-content')
                if (inner) slotContent.forEach((n) => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-badge-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        if (!this.hasAttribute('text')) {
            const newInner = this.querySelector('.tc-badge-content')
            if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
        }
    }

    get variant(): BadgeVariant {
        const v = this.getAttribute('variant') as BadgeVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: BadgeVariant) {
        this.setAttribute('variant', v)
    }

    get pill(): boolean {
        return this.hasAttribute('pill')
    }
    set pill(v: boolean) {
        if (v) this.setAttribute('pill', '')
        else this.removeAttribute('pill')
    }

    get text(): string | null {
        return this.getAttribute('text')
    }
    set text(v: string | null) {
        if (v != null) this.setAttribute('text', v)
        else this.removeAttribute('text')
    }

    get size(): BadgeSize | null {
        const v = this.getAttribute('size') as BadgeSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: BadgeSize | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    get tone(): BadgeTone | null {
        const v = this.getAttribute('tone') as BadgeTone
        return TONES.includes(v) ? v : null
    }
    set tone(v: BadgeTone | null) {
        if (v != null) this.setAttribute('tone', v)
        else this.removeAttribute('tone')
    }

    private render(): void {
        const variant = this.variant
        const pill = this.pill
        const text = this.getAttribute('text')
        const pillClass = pill ? ' rounded-pill' : ''
        const size = this.size
        const sizeClass = size ? ` badge-${size}` : ''
        const tone = this.tone
        // The neutral tone drops `text-bg-*` entirely rather than layering over it:
        // that utility carries `!important` on both colour and background (see
        // foundation/_utilities.scss), so a tone class could never win against it.
        const toneClass = tone ? ` badge-${tone}` : ''
        const variantClass = tone ? '' : ` text-bg-${variant}`
        const cls = `badge${variantClass}${toneClass}${sizeClass}${pillClass}`
        if (text != null) {
            this.innerHTML = `<span class="${cls}">${esc(text)}</span>`
        } else {
            this.innerHTML = `<span class="${cls}"><span class="tc-badge-content"></span></span>`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Badge
    }
}

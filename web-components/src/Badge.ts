import { VARIANTS_FULL } from './internal/variants'
import { setHostClass } from './internal/host-class'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-badge'

export type BadgeVariant =
    'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'

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

/**
 * tc-badge — THE HOST IS THE BADGE.
 *
 * It renders no wrapper and never moves your children. Before 5.1 it captured its
 * child nodes, rendered `<span class="badge"><span class="tc-badge-content">` and
 * re-appended them inside — which meant react-dom, which believes it owns those
 * children and that `tc-badge` is their parent, threw `NotFoundError` from
 * `parentInstance.removeChild(child)` the moment it removed one of them
 * individually. `{label}{n > 0 ? ` (${n})` : ''}` is two text children and `''` is
 * *no child*, so a count falling to zero was enough to blank the page.
 *
 * The `.badge` classes now live on the host itself (identical class names, so the
 * stylesheet did not move), and the only node the element ever creates is the
 * `text` label, which is PREPENDED.
 */
export class Badge extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        // `class` is observed so the element can re-assert its own classes after
        // react-dom overwrites `className` wholesale — see setHostClass.
        return ['variant', 'pill', 'text', 'size', 'tone', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    get variant(): BadgeVariant {
        const v = this.getAttribute('variant') as BadgeVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: BadgeVariant) {
        setAttr(this, 'variant', v)
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

    /** In-place: class list on the host, plus the one owned text node. Nothing is
     *  rebuilt, so a change of `variant` cannot disturb consumer children. */
    private patch(): void {
        const tone = this.tone
        const size = this.size
        // The neutral tone drops `text-bg-*` entirely rather than layering over it:
        // that utility carries `!important` on both colour and background (see
        // foundation/_utilities.scss), so a tone class could never win against it.
        const toneClass = tone ? ` badge-${tone}` : ''
        const variantClass = tone ? '' : ` text-bg-${this.variant}`
        const sizeClass = size ? ` badge-${size}` : ''
        const pillClass = this.pill ? ' rounded-pill' : ''
        const text = this.getAttribute('text')
        // `text` supersedes slotted content, and the leftovers are hidden in CSS
        // rather than removed — removing a node React created is what starts the
        // NotFoundError this element was rewritten to avoid.
        const textClass = text != null ? ' tc-badge--text' : ''
        // setHostClass, not `className =`: the host is the consumer's tag, so any
        // class they authored on it has to survive every patch — including the ones
        // react-dom writes after this element has already claimed the attribute.
        setHostClass(this, `badge${variantClass}${toneClass}${sizeClass}${pillClass}${textClass}`)

        let label = this.querySelector<HTMLElement>(':scope > .tc-badge-text')
        if (text == null) {
            label?.remove()
            return
        }
        if (!label) {
            label = document.createElement('span')
            label.className = 'tc-badge-text'
            // Prepended, never wrapped around anything: rule 1.
            this.prepend(label)
        }
        if (label.textContent !== text) label.textContent = text
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Badge
    }
}

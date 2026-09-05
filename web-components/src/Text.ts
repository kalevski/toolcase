import { setHostClass } from './internal/host-class'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-text'

export type TextVariant = 'default' | 'muted' | 'code' | 'mono' | 'truncate'
export type TextSize = 'small' | 'default' | 'large'
export type TextAs = 'p' | 'span' | 'small' | 'div'

const VARIANTS: TextVariant[] = ['default', 'muted', 'code', 'mono', 'truncate']
const SIZES: TextSize[] = ['small', 'default', 'large']
const AS_TAGS: TextAs[] = ['p', 'span', 'small', 'div']

/**
 * tc-text — body text with variant + size styling.
 *
 * THE HOST IS THE TEXT. It renders no wrapper and never moves your children.
 * Before 5.1 it rendered `<p class="tc-text"><span class="tc-text-content">` and
 * re-appended the consumer's nodes inside — which made react-dom throw
 * `NotFoundError` from `parentInstance.removeChild(child)` when it removed one of
 * them individually. `{label}{n > 0 ? ` (${n})` : ''}` is two text children and
 * `''` is *no child*, so a count falling to zero was enough.
 *
 * `as` is now a STYLING switch, not a tag: it selects the host's `display`
 * (`p`/`div` block, `span`/`small` inline) through the `[as]` rules in
 * style/components/_text.scss. A custom element cannot become a `<p>`, and the
 * alternative — keeping the inner tag — is the re-parenting this element was
 * rewritten to stop doing. Nothing about `<p>` here carried meaning to a screen
 * reader that the text itself did not.
 */
export class Text extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        // `class` is observed so the element can re-assert its own classes after
        // react-dom overwrites `className` wholesale — see setHostClass.
        return ['variant', 'size', 'as', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    get variant(): TextVariant {
        const v = this.getAttribute('variant') as TextVariant
        return VARIANTS.includes(v) ? v : 'default'
    }
    set variant(v: TextVariant) {
        setAttr(this, 'variant', v)
    }

    get size(): TextSize {
        const v = this.getAttribute('size') as TextSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: TextSize) {
        setAttr(this, 'size', v)
    }

    get as(): TextAs {
        const v = this.getAttribute('as') as TextAs
        return AS_TAGS.includes(v) ? v : 'p'
    }
    set as(v: TextAs) {
        setAttr(this, 'as', v)
    }

    private patch(): void {
        setHostClass(this, `tc-text tc-text-${this.variant} tc-text-${this.size}`)
        // For variant="truncate": expose the full text through `title` so a hover
        // tooltip and a screen reader can still reach what the ellipsis clipped.
        if (this.variant === 'truncate') this.setAttribute('title', this.textContent ?? '')
        else this.removeAttribute('title')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Text
    }
}

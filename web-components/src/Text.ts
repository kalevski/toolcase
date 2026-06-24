import { SlotWrapBase } from './internal/slot-wrap'

const TAG_NAME = 'tc-text'

export type TextVariant = 'default' | 'muted' | 'code' | 'mono' | 'truncate'
export type TextSize = 'small' | 'default' | 'large'
export type TextAs = 'p' | 'span' | 'small' | 'div'

const VARIANTS: TextVariant[] = ['default', 'muted', 'code', 'mono', 'truncate']
const SIZES: TextSize[] = ['small', 'default', 'large']
const AS_TAGS: TextAs[] = ['p', 'span', 'small', 'div']

/**
 * tc-text — body text in a chosen tag (`p`/`span`/`small`/`div`) with variant +
 * size styling. Built on the shared {@link SlotWrapBase} slot-wrapping scaffold;
 * the `truncate` variant mirrors the clipped content into a `title` via the
 * `afterRender` hook.
 */
export class Text extends SlotWrapBase {
    static get observedAttributes(): string[] {
        return ['variant', 'size', 'as']
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

    protected getContentEl(): Element | null {
        return this.querySelector('.tc-text-content')
    }

    // For truncate variant: expose full text via title so screen readers and
    // hover tooltips can access content that is visually clipped.
    protected afterRender(): void {
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

    protected render(): void {
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

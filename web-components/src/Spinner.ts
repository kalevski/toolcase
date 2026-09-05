import { VARIANTS_FULL } from './internal/variants'
import { esc } from './internal/esc'
import { setHostClass } from './internal/host-class'
import { setAttr, syncOwnedNodes } from './internal/tc-element'
import { msg } from './messages'

const TAG_NAME = 'tc-spinner'

export type SpinnerType = 'border' | 'grow' | 'dots' | 'bars' | 'pulse' | 'orbit'
export type SpinnerVariant =
    'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'

/** `inline` is the glyph on its own; `block` is the centred wait — the shape
 *  polovni.mk, webgame.cloud and mindmap each wrote as their own `Loading`. */
export type SpinnerLayout = 'inline' | 'block'

const TYPES: SpinnerType[] = ['border', 'grow', 'dots', 'bars', 'pulse', 'orbit']
const VARIANTS: SpinnerVariant[] = [...VARIANTS_FULL]

/**
 * tc-spinner — the wait indicator, in six shapes.
 *
 * `caption` is what absorbs the three consuming apps' own `Loading` component: a
 * centred spinner with a sentence under it. All three wrote the same nine lines
 * around a bare `<tc-spinner>`, so the caption belongs here — and once it is
 * here, the label is no longer only for screen readers, which is why it is
 * `caption` that decides visibility rather than a second attribute for the text.
 *
 * The structure is built once and patched in place: a spinner is by definition on
 * screen while something else is happening, and rebuilding its subtree on a
 * `variant` change interrupts a screen reader mid-announcement of `role="status"`.
 */
export class Spinner extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        return ['type', 'variant', 'size', 'label', 'caption', 'layout', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    get type(): SpinnerType {
        const t = this.getAttribute('type') as SpinnerType
        return TYPES.includes(t) ? t : 'border'
    }
    set type(v: SpinnerType) {
        setAttr(this, 'type', v)
    }

    get variant(): SpinnerVariant | null {
        const v = this.getAttribute('variant') as SpinnerVariant
        return VARIANTS.includes(v) ? v : null
    }
    set variant(v: SpinnerVariant | null) {
        if (v != null) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }

    get size(): boolean {
        return this.getAttribute('size') === 'sm'
    }
    set size(v: boolean) {
        if (v) this.setAttribute('size', 'sm')
        else this.removeAttribute('size')
    }

    /** The wait's accessible name, and the caption's text when `caption` is set. */
    get label(): string {
        return this.getAttribute('label') ?? msg('loading')
    }
    set label(v: string) {
        setAttr(this, 'label', v)
    }

    /** Show the label as text rather than only to a screen reader. */
    get caption(): boolean {
        return this.hasAttribute('caption')
    }
    set caption(v: boolean) {
        if (v) this.setAttribute('caption', '')
        else this.removeAttribute('caption')
    }

    /** `block` centres the spinner (and its caption) in the space it is given. */
    get layout(): SpinnerLayout {
        return this.getAttribute('layout') === 'block' ? 'block' : 'inline'
    }
    set layout(v: SpinnerLayout) {
        setAttr(this, 'layout', v)
    }

    private patch(): void {
        const type = this.type
        const variant = this.variant
        const label = this.label
        const caption = this.caption

        setHostClass(this, `tc-spinner tc-spinner--${this.layout}`)
        this.setAttribute('role', 'status')

        const variantClass = variant ? ` text-${variant}` : ''
        const sizeClass = this.size ? ` spinner-${type}-sm` : ''
        // The three segmented shapes own their own spans; the rest are one box.
        const segments =
            type === 'dots' || type === 'bars' ? '<span></span><span></span><span></span>' : ''

        syncOwnedNodes(this, [
            {
                cls: 'tc-spinner__glyph',
                tag: 'span',
                html: segments,
            },
            {
                cls: 'tc-spinner__caption',
                tag: 'span',
                html: esc(label),
            },
        ])

        const glyph = this.querySelector<HTMLElement>(':scope > .tc-spinner__glyph')
        if (glyph) {
            const cls = `tc-spinner__glyph spinner-${type}${variantClass}${sizeClass}`
            if (glyph.className !== cls) glyph.className = cls
            glyph.setAttribute('aria-hidden', 'true')
        }
        const text = this.querySelector<HTMLElement>(':scope > .tc-spinner__caption')
        if (text) {
            // Always rendered, so the wait always has a name; `visually-hidden` is
            // what `caption` removes.
            text.classList.toggle('visually-hidden', !caption)
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Spinner
    }
}

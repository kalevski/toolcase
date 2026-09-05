import { patchHtml } from './internal/patch-html'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-skeleton'

export type SkeletonVariant = 'text' | 'circle' | 'rect'

const VARIANTS: SkeletonVariant[] = ['text', 'circle', 'rect']

/**
 * Composed placeholders that reproduce another component's BOX rather than a bare
 * rectangle: `card` matches `tc-taxonomy-card` (card radius, hairline, the 3px accent
 * top rule, and the eyebrow / serif title / description ladder inside it) and `row`
 * matches `tc-check-row` (48px tall, dashed divider, tick box, label over hint).
 *
 * WHY A PRESET AND NOT `variant="rect" height="112"`. A list that loads into cards but
 * shimmers as flat bars reflows on arrival: every row changes height and the page
 * jumps under the reader's thumb. Matching the real geometry makes the loading state a
 * silhouette of the loaded one, so nothing moves when the data lands — which is the
 * whole advantage of a skeleton over a spinner. A wrong-shaped skeleton is worse than
 * a spinner, because it promises a layout and then breaks it.
 */
export type SkeletonPreset = 'card' | 'row'

const PRESETS: SkeletonPreset[] = ['card', 'row']

// Pure-number string → "Npx"; any other CSS string passes through unchanged.
function resolveLength(raw: string | null): string | null {
    if (raw === null) return null
    return /^\d+(\.\d+)?$/.test(raw.trim()) ? `${raw.trim()}px` : raw
}

export class Skeleton extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'width', 'height', 'count', 'preset']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-label', 'Loading...')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get variant(): SkeletonVariant {
        const v = this.getAttribute('variant') as SkeletonVariant
        return VARIANTS.includes(v) ? v : 'text'
    }
    set variant(v: SkeletonVariant) {
        setAttr(this, 'variant', v)
    }

    get width(): string | null {
        return this.getAttribute('width')
    }
    set width(v: string | null) {
        if (v != null) this.setAttribute('width', v)
        else this.removeAttribute('width')
    }

    get height(): string | null {
        return this.getAttribute('height')
    }
    set height(v: string | null) {
        if (v != null) this.setAttribute('height', v)
        else this.removeAttribute('height')
    }

    /** A composed placeholder shaped like a real component — see `SkeletonPreset`.
     *  Overrides `variant`; `count` still repeats it, `height` still overrides the
     *  preset's own. */
    get preset(): SkeletonPreset | null {
        const v = this.getAttribute('preset') as SkeletonPreset
        return PRESETS.includes(v) ? v : null
    }
    set preset(v: SkeletonPreset | null) {
        if (v != null) this.setAttribute('preset', v)
        else this.removeAttribute('preset')
    }

    get count(): number {
        return Math.max(1, parseInt(this.getAttribute('count') ?? '1', 10) || 1)
    }
    set count(v: number) {
        this.setAttribute('count', String(v))
    }

    /** One preset instance. Every inner bar is a `.tc-skeleton`, so the shimmer (and
     *  its reduced-motion freeze) comes from the one place that defines it. */
    private _renderPreset(preset: SkeletonPreset, height: string | null): string {
        const bar = (w: string, h: string): string =>
            `<span class="tc-skeleton tc-skeleton-text" style="width:${w};height:${h}"></span>`
        const styleAttr = height ? ` style="min-height:${height}"` : ''

        if (preset === 'row') {
            return (
                `<div class="tc-skeleton-preset tc-skeleton-preset--row"${styleAttr} aria-hidden="true">` +
                `<span class="tc-skeleton tc-skeleton-preset__box"></span>` +
                `<span class="tc-skeleton-preset__lines">${bar('62%', '13px')}${bar('34%', '10px')}</span>` +
                `</div>`
            )
        }
        return (
            `<div class="tc-skeleton-preset tc-skeleton-preset--card"${styleAttr} aria-hidden="true">` +
            // eyebrow, serif title, description — the three runs every taxonomy card has
            bar('34%', '9px') +
            bar('72%', '20px') +
            bar('100%', '12px') +
            `<span class="tc-skeleton-preset__chips">` +
            `<span class="tc-skeleton tc-skeleton-preset__chip"></span>` +
            `<span class="tc-skeleton tc-skeleton-preset__chip"></span>` +
            `</span>` +
            `</div>`
        )
    }

    private render(): void {
        const preset = this.preset
        if (preset !== null) {
            const height = resolveLength(this.getAttribute('height'))
            const count = this.count
            const one = this._renderPreset(preset, height)
            patchHtml(
                this,
                count > 1 ? `<div class="tc-skeleton__group">${one.repeat(count)}</div>` : one,
            )
            return
        }

        const variant = this.variant
        const count = this.count
        const rawWidth = this.getAttribute('width')
        const width = resolveLength(rawWidth)
        const height = resolveLength(this.getAttribute('height'))

        let resolvedWidth: string
        let resolvedHeight: string

        if (variant === 'circle') {
            resolvedWidth = width ?? height ?? '40px'
            resolvedHeight = height ?? width ?? '40px'
        } else if (variant === 'rect') {
            resolvedWidth = width ?? '100%'
            resolvedHeight = height ?? '80px'
        } else {
            // text
            resolvedWidth = width ?? '100%'
            resolvedHeight = height ?? '1em'
        }

        const makeSpan = (w: string, h: string): string =>
            `<span class="tc-skeleton tc-skeleton-${variant}" style="width:${w};height:${h}" aria-hidden="true"></span>`

        if (count > 1) {
            const spans = Array.from({ length: count }, (_, i) => {
                // Last text line is narrower when no explicit width was given, mirroring paragraph-end behaviour.
                const isLastText = variant === 'text' && rawWidth === null && i === count - 1
                return makeSpan(isLastText ? '80%' : resolvedWidth, resolvedHeight)
            }).join('')
            patchHtml(this, `<div class="tc-skeleton__group">${spans}</div>`)
        } else {
            patchHtml(this, makeSpan(resolvedWidth, resolvedHeight))
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Skeleton
    }
}

const TAG_NAME = 'tc-skeleton'

export type SkeletonVariant = 'text' | 'circle' | 'rect'

const VARIANTS: SkeletonVariant[] = ['text', 'circle', 'rect']

// Pure-number string → "Npx"; any other CSS string passes through unchanged.
function resolveLength(raw: string | null): string | null {
    if (raw === null) return null
    return /^\d+(\.\d+)?$/.test(raw.trim()) ? `${raw.trim()}px` : raw
}

export class Skeleton extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'width', 'height', 'count']
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
        this.setAttribute('variant', v)
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

    get count(): number {
        return Math.max(1, parseInt(this.getAttribute('count') ?? '1', 10) || 1)
    }
    set count(v: number) {
        this.setAttribute('count', String(v))
    }

    private render(): void {
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
            this.innerHTML = `<div class="tc-skeleton__group">${spans}</div>`
        } else {
            this.innerHTML = makeSpan(resolvedWidth, resolvedHeight)
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Skeleton
    }
}

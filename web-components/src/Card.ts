import { patchHtml } from './internal/patch-html'
import { VARIANTS_FULL } from './internal/variants'
import { setHostClass } from './internal/host-class'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-card'

export type CardVariant =
    'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'
export type CardImgPosition = 'top' | 'bottom'

const VARIANTS: CardVariant[] = [...VARIANTS_FULL]

function escAttr(v: string): string {
    return v
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

export class Card extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['title', 'subtitle', 'img', 'img-position', 'variant']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get variant(): CardVariant | null {
        const v = this.getAttribute('variant') as CardVariant
        return VARIANTS.includes(v) ? v : null
    }
    set variant(v: CardVariant | null) {
        if (v != null) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }

    get img(): string | null {
        return this.getAttribute('img')
    }
    set img(v: string | null) {
        if (v != null) this.setAttribute('img', v)
        else this.removeAttribute('img')
    }

    get imgPosition(): CardImgPosition {
        return this.getAttribute('img-position') === 'bottom' ? 'bottom' : 'top'
    }
    set imgPosition(v: CardImgPosition) {
        setAttr(this, 'img-position', v)
    }

    private render(): void {
        const title = this.getAttribute('title')
        const subtitle = this.getAttribute('subtitle')
        const img = this.img
        const imgPosition = this.imgPosition
        const variant = this.variant

        setHostClass(this, `card${variant ? ` text-bg-${variant}` : ''}`)

        const imgHtml = img
            ? `<img src="${escAttr(img)}" class="card-img-${imgPosition}" alt="">`
            : ''
        const titleHtml = title ? `<h5 class="card-title">${escAttr(title)}</h5>` : ''
        const subtitleHtml = subtitle
            ? `<h6 class="card-subtitle mb-2 text-body-secondary">${escAttr(subtitle)}</h6>`
            : ''

        // The image, title and subtitle are the element's own; `slot="header"`,
        // `slot="footer"` and the default children stay exactly where the consumer
        // wrote them and are placed by CSS `order` (rule 1).
        const ownHtml = `${imgHtml}${titleHtml}${subtitleHtml}`
        setHostClass(
            this,
            `card${variant ? ` text-bg-${variant}` : ''} tc-card--img-${imgPosition}`,
        )
        patchHtml(this, ownHtml)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Card
    }
}

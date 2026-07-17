import { VARIANTS_FULL } from './internal/variants'
import { setHostClass } from './internal/host-class'
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
    private _headerNodes: Node[] = []
    private _footerNodes: Node[] = []
    private _bodyNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['title', 'subtitle', 'img', 'img-position', 'variant']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const children = Array.from(this.childNodes)
            this._headerNodes = children.filter(
                (n) => (n as Element).getAttribute?.('slot') === 'header',
            )
            this._footerNodes = children.filter(
                (n) => (n as Element).getAttribute?.('slot') === 'footer',
            )
            this._bodyNodes = children.filter((n) => {
                const slot = (n as Element).getAttribute?.('slot')
                return slot !== 'header' && slot !== 'footer'
            })
            this._initialised = true
        }
        this.render()
        this._reattach()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
        this._reattach()
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
        this.setAttribute('img-position', v)
    }

    private render(): void {
        const title = this.getAttribute('title')
        const subtitle = this.getAttribute('subtitle')
        const img = this.img
        const imgPosition = this.imgPosition
        const variant = this.variant

        setHostClass(this, `card${variant ? ` text-bg-${variant}` : ''}`)

        const headerHtml =
            this._headerNodes.length > 0 ? `<div class="card-header tc-card-header"></div>` : ''
        const footerHtml =
            this._footerNodes.length > 0 ? `<div class="card-footer tc-card-footer"></div>` : ''
        const imgHtml = img
            ? `<img src="${escAttr(img)}" class="card-img-${imgPosition}" alt="">`
            : ''
        const titleHtml = title ? `<h5 class="card-title">${escAttr(title)}</h5>` : ''
        const subtitleHtml = subtitle
            ? `<h6 class="card-subtitle mb-2 text-body-secondary">${escAttr(subtitle)}</h6>`
            : ''

        const bodyHtml = `<div class="card-body tc-card-body">${titleHtml}${subtitleHtml}</div>`

        if (imgPosition === 'bottom') {
            this.innerHTML = `${headerHtml}${bodyHtml}${imgHtml}${footerHtml}`
        } else {
            this.innerHTML = `${headerHtml}${imgHtml}${bodyHtml}${footerHtml}`
        }
    }

    private _reattach(): void {
        const headerEl = this.querySelector('.tc-card-header')
        const bodyEl = this.querySelector('.tc-card-body')
        const footerEl = this.querySelector('.tc-card-footer')
        this._headerNodes.forEach((n) => headerEl?.appendChild(n))
        this._bodyNodes.forEach((n) => bodyEl?.appendChild(n))
        this._footerNodes.forEach((n) => footerEl?.appendChild(n))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Card
    }
}

import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'
import { icon } from './icons'
import { Heart } from 'lucide-static'

const TAG_NAME = 'tc-car-listing-card'

export interface CarListingSpec {
    icon: string
    label: string
}

const heartOutlineIconHtml = icon(Heart, 'tc-car-listing-card-wishlist-icon')
const heartFilledIconHtml = icon(Heart, 'tc-car-listing-card-wishlist-icon tc-car-listing-card-wishlist-icon--filled')

// tc-car-listing-card — a vehicle listing card (image, category chip, wishlist
// toggle, title, optional rating, an icon spec row for mileage/fuel/
// transmission, current + strikethrough-old price, and an optional seller
// mini-row). Ports the "product card" pattern from automotive marketplace
// templates, where a generic tc-card can't carry the domain-specific spec
// row + dual pricing + wishlist affordance in one shot.
//
// `layout="list"` switches to a horizontal image-left / details-right
// arrangement for list-view browsing pages; the default is `grid`. The
// `specs` array is a JS property (not an attribute, like the React
// TestimonialCarousel `items` prop) — each entry is a lucide icon name
// (kebab or PascalCase) + label, e.g. `{ icon: 'gauge', label: '12,400 mi' }`.
// Clicking the wishlist button toggles the `wishlisted` attribute and emits a
// `tc-wishlist-toggle` CustomEvent with `detail: { wishlisted }`; it never
// navigates the card's own link.
export class CarListingCard extends HTMLElement {
    private _initialised = false
    private _specs: CarListingSpec[] = []

    onWishlistToggle: ((wishlisted: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'layout',
            'image-src',
            'image-alt',
            'category',
            'title-text',
            'href',
            'price-text',
            'price-old-text',
            'rating',
            'rating-count-text',
            'seller-name',
            'seller-avatar-src',
            'wishlisted',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this.addEventListener('click', this._onClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'wishlisted') {
            this._patchWishlist()
            return
        }
        this.render()
    }

    // ── Props ────────────────────────────────────────────────────────────────

    get specs(): CarListingSpec[] {
        return this._specs
    }
    set specs(v: CarListingSpec[]) {
        this._specs = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get layout(): 'grid' | 'list' {
        return this.getAttribute('layout') === 'list' ? 'list' : 'grid'
    }
    set layout(v: 'grid' | 'list') {
        this.setAttribute('layout', v)
    }

    get wishlisted(): boolean {
        return this.hasAttribute('wishlisted')
    }
    set wishlisted(v: boolean) {
        if (v) this.setAttribute('wishlisted', '')
        else this.removeAttribute('wishlisted')
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element | null
        if (!target) return
        if (target.closest('.tc-car-listing-card-wishlist')) {
            e.preventDefault()
            e.stopPropagation()
            const next = !this.wishlisted
            this.wishlisted = next
            this.dispatchEvent(
                new CustomEvent('tc-wishlist-toggle', {
                    bubbles: true,
                    composed: true,
                    detail: { wishlisted: next },
                }),
            )
            this.onWishlistToggle?.(next)
        }
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    // Surgically swap the toggle's pressed state + icon without a full
    // re-render, so hover/focus state on the button isn't lost.
    private _patchWishlist(): void {
        const btn = this.querySelector<HTMLElement>('.tc-car-listing-card-wishlist')
        if (!btn) return
        const on = this.wishlisted
        btn.setAttribute('aria-pressed', String(on))
        btn.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Add to wishlist')
        btn.innerHTML = on ? heartFilledIconHtml : heartOutlineIconHtml
    }

    private _ratingHtml(): string {
        const raw = this.getAttribute('rating')
        if (raw == null) return ''
        const value = Math.max(0, Math.min(5, parseFloat(raw)))
        if (isNaN(value)) return ''
        const countText = this.getAttribute('rating-count-text')
        const starIconHtml = lucideByName('star', 'tc-car-listing-card-rating-star-icon')
        const stars = Array.from({ length: 5 }, (_, i) => {
            const filled = i < Math.round(value)
            const cls = filled
                ? 'tc-car-listing-card-rating-star tc-car-listing-card-rating-star--filled'
                : 'tc-car-listing-card-rating-star'
            return `<span class="${cls}" aria-hidden="true">${starIconHtml}</span>`
        }).join('')
        const countHtml = countText
            ? `<span class="tc-car-listing-card-rating-count">${esc(countText)}</span>`
            : ''
        return (
            `<div class="tc-car-listing-card-rating" role="img" aria-label="${value} out of 5 stars">` +
            stars +
            countHtml +
            `</div>`
        )
    }

    private _specsHtml(): string {
        if (this._specs.length === 0) return ''
        const items = this._specs
            .map((spec) => {
                const iconHtml = lucideByName(spec.icon, 'tc-car-listing-card-spec-icon-svg')
                return (
                    `<li class="tc-car-listing-card-spec">` +
                    `<span class="tc-car-listing-card-spec-icon">${iconHtml}</span>` +
                    `<span class="tc-car-listing-card-spec-label">${esc(spec.label)}</span>` +
                    `</li>`
                )
            })
            .join('')
        return `<ul class="tc-car-listing-card-specs">${items}</ul>`
    }

    private _sellerHtml(): string {
        const name = this.getAttribute('seller-name')
        if (!name) return ''
        const avatarSrc = this.getAttribute('seller-avatar-src')
        const avatarHtml = avatarSrc
            ? `<img class="tc-car-listing-card-seller-avatar" src="${esc(avatarSrc)}" alt="" loading="lazy" />`
            : `<span class="tc-car-listing-card-seller-avatar tc-car-listing-card-seller-avatar--placeholder"></span>`
        return (
            `<div class="tc-car-listing-card-seller">` +
            avatarHtml +
            `<span class="tc-car-listing-card-seller-name">${esc(name)}</span>` +
            `</div>`
        )
    }

    private render(): void {
        const layout = this.layout
        const imageSrc = this.getAttribute('image-src') ?? ''
        const imageAlt = this.getAttribute('image-alt') ?? ''
        const category = this.getAttribute('category')
        const titleText = this.getAttribute('title-text') ?? ''
        const href = this.getAttribute('href')
        const priceText = this.getAttribute('price-text')
        const priceOldText = this.getAttribute('price-old-text')
        const wishlisted = this.wishlisted

        const mediaHtml =
            `<div class="tc-car-listing-card-media">` +
            (imageSrc
                ? `<img class="tc-car-listing-card-img" src="${esc(imageSrc)}" alt="${esc(imageAlt)}" loading="lazy" />`
                : `<div class="tc-car-listing-card-img tc-car-listing-card-img--placeholder"></div>`) +
            (category
                ? `<span class="tc-car-listing-card-badge badge text-bg-secondary">${esc(category)}</span>`
                : '') +
            `<button type="button" class="tc-car-listing-card-wishlist" aria-pressed="${wishlisted}" ` +
            `aria-label="${wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}">` +
            (wishlisted ? heartFilledIconHtml : heartOutlineIconHtml) +
            `</button>` +
            `</div>`

        const titleHtml = href
            ? `<a class="tc-car-listing-card-title" href="${esc(href)}">${esc(titleText)}</a>`
            : `<span class="tc-car-listing-card-title">${esc(titleText)}</span>`

        const priceHtml =
            priceText || priceOldText
                ? `<div class="tc-car-listing-card-price-block">` +
                  (priceText ? `<span class="tc-car-listing-card-price">${esc(priceText)}</span>` : '') +
                  (priceOldText
                      ? `<span class="tc-car-listing-card-price-old">${esc(priceOldText)}</span>`
                      : '') +
                  `</div>`
                : ''

        this.innerHTML =
            `<article class="tc-car-listing-card tc-car-listing-card--${layout}">` +
            mediaHtml +
            `<div class="tc-car-listing-card-body">` +
            titleHtml +
            this._ratingHtml() +
            this._specsHtml() +
            `<div class="tc-car-listing-card-footer">` +
            priceHtml +
            this._sellerHtml() +
            `</div>` +
            `</div>` +
            `</article>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CarListingCard
    }
}

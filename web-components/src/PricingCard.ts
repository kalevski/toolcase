import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-pricing-card'

export interface PricingCardFeature {
    label: string
    included?: boolean
}

export interface PricingCardAction {
    label: string
    href?: string
    onClick?: () => void
    variant?: string
    disabled?: boolean
}

const checkIconHtml = lucideByName('check')
const xIconHtml = lucideByName('x')
const minusIconHtml = lucideByName('minus')

const KNOWN_VARIANTS = [
    'primary',
    'secondary',
    'success',
    'danger',
    'warning',
    'info',
    'outline-primary',
    'outline-secondary',
]

export class PricingCard extends HTMLElement {
    private _initialised = false
    private _features: Array<string | PricingCardFeature> = []
    private _action: PricingCardAction = { label: '' }

    static get observedAttributes(): string[] {
        return ['name', 'price', 'period', 'description', 'badge-text', 'highlight']
    }

    connectedCallback(): void {
        this.addEventListener('click', this._handleClick)
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._handleClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        this.setAttribute('name', v)
    }

    get price(): string {
        return this.getAttribute('price') ?? ''
    }
    set price(v: string) {
        this.setAttribute('price', v)
    }

    get period(): string | null {
        return this.getAttribute('period')
    }
    set period(v: string | null) {
        if (v != null) this.setAttribute('period', v)
        else this.removeAttribute('period')
    }

    get description(): string | null {
        return this.getAttribute('description')
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    get badgeText(): string | null {
        return this.getAttribute('badge-text')
    }
    set badgeText(v: string | null) {
        if (v != null) this.setAttribute('badge-text', v)
        else this.removeAttribute('badge-text')
    }

    get highlight(): boolean {
        return this.hasAttribute('highlight')
    }
    set highlight(v: boolean) {
        if (v) this.setAttribute('highlight', '')
        else this.removeAttribute('highlight')
    }

    get features(): Array<string | PricingCardFeature> {
        return this._features
    }
    set features(v: Array<string | PricingCardFeature>) {
        this._features = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get action(): PricingCardAction {
        return this._action
    }
    set action(v: PricingCardAction) {
        this._action = v && typeof v === 'object' ? v : { label: '' }
        if (this._initialised) this.render()
    }

    private _handleClick = (e: Event): void => {
        const target = e.target
        if (!(target instanceof Element)) return
        if (!target.closest('.tc-pricing-card-action')) return
        if (this._action.disabled) return
        this.dispatchEvent(
            new CustomEvent('tc-action', {
                bubbles: true,
                composed: true,
                detail: {},
            }),
        )
        if (typeof this._action.onClick === 'function') this._action.onClick()
    }

    private render(): void {
        const name = this.getAttribute('name') ?? ''
        const price = this.getAttribute('price') ?? ''
        const period = this.getAttribute('period')
        const description = this.getAttribute('description')
        const badgeText = this.getAttribute('badge-text')
        const highlight = this.hasAttribute('highlight')
        const action = this._action

        const articleClass = highlight
            ? 'tc-pricing-card tc-pricing-card--highlight'
            : 'tc-pricing-card'

        const badgeHtml = badgeText
            ? `<span class="tc-pricing-card-badge">${esc(badgeText)}</span>`
            : ''

        const periodHtml = period
            ? `<span class="tc-pricing-card-period">${esc(period)}</span>`
            : ''

        const descHtml = description
            ? `<p class="tc-pricing-card-desc">${esc(description)}</p>`
            : ''

        const featuresHtml =
            this._features.length > 0
                ? `<ul class="tc-pricing-card-features" role="list">` +
                  this._features
                      .map((f) => {
                          const label = typeof f === 'string' ? f : f.label
                          const included = typeof f === 'string' ? true : f.included !== false
                          const featureIcon = included ? checkIconHtml : xIconHtml || minusIconHtml
                          const iconClass = included
                              ? 'tc-pricing-card-feature-icon tc-pricing-card-feature-icon--included'
                              : 'tc-pricing-card-feature-icon tc-pricing-card-feature-icon--excluded'
                          const srText = included ? 'included' : 'not included'
                          const liClass = included
                              ? 'tc-pricing-card-feature'
                              : 'tc-pricing-card-feature tc-pricing-card-feature--excluded'
                          return (
                              `<li class="${liClass}">` +
                              `<span class="${iconClass}" aria-hidden="true">${featureIcon}</span>` +
                              `<span class="visually-hidden">${srText}</span>` +
                              `<span class="tc-pricing-card-feature-label">${esc(label)}</span>` +
                              `</li>`
                          )
                      })
                      .join('') +
                  `</ul>`
                : ''

        const rawVariant = action.variant ?? 'primary'
        const btnVariant = KNOWN_VARIANTS.includes(rawVariant) ? rawVariant : 'primary'
        const btnClass = `btn btn-${esc(btnVariant)} tc-pricing-card-action`
        const disabledClass = action.disabled ? ' tc-pricing-card-action--disabled' : ''
        const disabledAttr = action.disabled ? ' aria-disabled="true"' : ''
        const actionLabel = esc(action.label || 'Get started')

        const actionHtml =
            action.href && !action.disabled
                ? `<a class="${btnClass}${disabledClass}" href="${esc(action.href)}"${disabledAttr}>${actionLabel}</a>`
                : `<button class="${btnClass}${disabledClass}" type="button"${disabledAttr}>${actionLabel}</button>`

        this.innerHTML =
            `<article class="${articleClass}">` +
            badgeHtml +
            `<div class="tc-pricing-card-header">` +
            `<h3 class="tc-pricing-card-name">${esc(name)}</h3>` +
            `<div class="tc-pricing-card-price-line">` +
            `<span class="tc-pricing-card-price">${esc(price)}</span>` +
            periodHtml +
            `</div>` +
            descHtml +
            `</div>` +
            featuresHtml +
            `<div class="tc-pricing-card-footer">` +
            actionHtml +
            `</div>` +
            `</article>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PricingCard
    }
}

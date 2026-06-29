import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-page-footer'

export interface PageFooterMenu {
    title: string
    links: { label: string; href: string }[]
}

export interface PageFooterSocialLink {
    icon: string
    href: string
    label?: string
}

export interface PageFooterLink {
    label: string
    href: string
}

export interface PageFooterCta {
    label: string
    href: string
    heading?: string
    description?: string
}

export class PageFooter extends HTMLElement {
    private _initialised = false
    private _menus: PageFooterMenu[] = []
    private _socialLinks: PageFooterSocialLink[] = []
    private _legalLinks: PageFooterLink[] = []
    private _cta: PageFooterCta | null = null
    private _brandSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['brand', 'tagline', 'description', 'legal-text']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._brandSlotNodes = Array.from(this.querySelectorAll('[slot="brand"]'))
            this.render()
            this._distributeBrandSlot()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._recaptureBrandSlot()
        this.render()
        this._distributeBrandSlot()
    }

    private _recaptureBrandSlot(): void {
        if (!this.hasAttribute('brand')) {
            const inContainer = Array.from(
                this.querySelectorAll('.tc-page-footer-brand-word [slot="brand"]'),
            )
            if (inContainer.length > 0) {
                this._brandSlotNodes = inContainer
            }
        }
    }

    private _distributeBrandSlot(): void {
        if (!this.hasAttribute('brand') && this._brandSlotNodes.length > 0) {
            const container = this.querySelector('.tc-page-footer-brand-word')
            if (container) this._brandSlotNodes.forEach((n) => container.appendChild(n))
        }
    }

    private _rerender(): void {
        if (!this._initialised) return
        this._recaptureBrandSlot()
        this.render()
        this._distributeBrandSlot()
    }

    get brand(): string | null {
        return this.getAttribute('brand')
    }
    set brand(v: string | null) {
        if (v != null) this.setAttribute('brand', v)
        else this.removeAttribute('brand')
    }

    get tagline(): string | null {
        return this.getAttribute('tagline')
    }
    set tagline(v: string | null) {
        if (v != null) this.setAttribute('tagline', v)
        else this.removeAttribute('tagline')
    }

    get description(): string | null {
        return this.getAttribute('description')
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    get legalText(): string | null {
        return this.getAttribute('legal-text')
    }
    set legalText(v: string | null) {
        if (v != null) this.setAttribute('legal-text', v)
        else this.removeAttribute('legal-text')
    }

    get menus(): PageFooterMenu[] {
        return this._menus
    }
    set menus(v: PageFooterMenu[]) {
        this._menus = Array.isArray(v) ? v : []
        this._rerender()
    }

    get socialLinks(): PageFooterSocialLink[] {
        return this._socialLinks
    }
    set socialLinks(v: PageFooterSocialLink[]) {
        this._socialLinks = Array.isArray(v) ? v : []
        this._rerender()
    }

    get legalLinks(): PageFooterLink[] {
        return this._legalLinks
    }
    set legalLinks(v: PageFooterLink[]) {
        this._legalLinks = Array.isArray(v) ? v : []
        this._rerender()
    }

    get cta(): PageFooterCta | null {
        return this._cta
    }
    set cta(v: PageFooterCta | null) {
        this._cta = v && typeof v === 'object' ? v : null
        this._rerender()
    }

    private render(): void {
        const brand = this.getAttribute('brand')
        const tagline = this.getAttribute('tagline')
        const description = this.getAttribute('description')
        const legalText = this.getAttribute('legal-text')

        // CTA block
        const ctaHtml = this._cta
            ? `<div class="tc-page-footer-cta">` +
              (this._cta.heading
                  ? `<h2 class="tc-page-footer-cta-heading">${esc(this._cta.heading)}</h2>`
                  : '') +
              (this._cta.description
                  ? `<p class="tc-page-footer-cta-desc">${esc(this._cta.description)}</p>`
                  : '') +
              `<a class="tc-page-footer-cta-btn" href="${esc(this._cta.href)}">${esc(this._cta.label)}</a>` +
              `</div>`
            : ''

        // Brand wordmark — attribute takes precedence; slot fills in when absent
        const brandWordContent = brand
            ? `<span class="tc-page-footer-brand-dot" aria-hidden="true"></span>` +
              `<span class="tc-page-footer-brand-name">${esc(brand)}</span>`
            : ''

        // Social icon links
        const socialHtml =
            this._socialLinks.length > 0
                ? `<div class="tc-page-footer-social" role="list" aria-label="Social links">` +
                  this._socialLinks
                      .map((link) => {
                          const iconHtml = lucideByName(link.icon)
                          const label = esc(link.label ?? link.icon)
                          const href = esc(link.href)
                          return (
                              `<a class="tc-page-footer-social-link" href="${href}"` +
                              ` role="listitem" target="_blank" rel="noopener noreferrer"` +
                              ` aria-label="${label}">${iconHtml}</a>`
                          )
                      })
                      .join('') +
                  `</div>`
                : ''

        // Brand column
        const brandCol =
            `<div class="tc-page-footer-brand">` +
            `<div class="tc-page-footer-brand-word">${brandWordContent}</div>` +
            (tagline ? `<p class="tc-page-footer-tagline">${esc(tagline)}</p>` : '') +
            (description ? `<p class="tc-page-footer-description">${esc(description)}</p>` : '') +
            socialHtml +
            `</div>`

        // Menu columns — each wrapped in a nav landmark
        const menusHtml = this._menus
            .map((menu) => {
                const linksHtml = menu.links
                    .map(
                        (link) =>
                            `<li><a class="tc-page-footer-menu-link" href="${esc(link.href)}">${esc(link.label)}</a></li>`,
                    )
                    .join('')
                return (
                    `<nav class="tc-page-footer-menu" aria-label="${esc(menu.title)}">` +
                    `<p class="tc-page-footer-menu-title">${esc(menu.title)}</p>` +
                    `<ul class="tc-page-footer-menu-list">${linksHtml}</ul>` +
                    `</nav>`
                )
            })
            .join('')

        // Legal bar
        const legalLinksHtml =
            this._legalLinks.length > 0
                ? `<nav class="tc-page-footer-legal-nav" aria-label="Legal links">` +
                  this._legalLinks
                      .map(
                          (link) =>
                              `<a class="tc-page-footer-legal-link" href="${esc(link.href)}">${esc(link.label)}</a>`,
                      )
                      .join('') +
                  `</nav>`
                : ''

        const hasLegal = legalText || this._legalLinks.length > 0
        const legalHtml = hasLegal
            ? `<div class="tc-page-footer-legal">` +
              (legalText
                  ? `<span class="tc-page-footer-legal-text">${esc(legalText)}</span>`
                  : '') +
              legalLinksHtml +
              `</div>`
            : ''

        this.innerHTML =
            `<footer class="tc-page-footer" role="contentinfo">` +
            ctaHtml +
            `<div class="tc-page-footer-main">` +
            brandCol +
            menusHtml +
            `</div>` +
            legalHtml +
            `</footer>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PageFooter
    }
}

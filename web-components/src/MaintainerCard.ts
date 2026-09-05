import { patchHtml, bindOnce } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-maintainer-card'

export interface MaintainerLink {
    key: string
    href: string
    label: string
    icon?: string
}

const mapPinIconHtml = lucideByName('map-pin')
const heartIconHtml = lucideByName('heart')

export class MaintainerCard extends HTMLElement {
    private _initialised = false
    private _links: MaintainerLink[] = []

    static get observedAttributes(): string[] {
        return ['name', 'avatar-url', 'role', 'bio', 'sponsor-href', 'sponsor-label', 'location']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        setAttr(this, 'name', v)
    }

    get avatarUrl(): string {
        return this.getAttribute('avatar-url') ?? ''
    }
    set avatarUrl(v: string) {
        setAttr(this, 'avatar-url', v)
    }

    // 'role' conflicts with ARIAMixin.role; no JS getter/setter defined.
    // Use getAttribute('role') / setAttribute('role', ...) to access it.

    get bio(): string | null {
        return this.getAttribute('bio')
    }
    set bio(v: string | null) {
        if (v != null) this.setAttribute('bio', v)
        else this.removeAttribute('bio')
    }

    get links(): MaintainerLink[] {
        return this._links
    }
    set links(v: MaintainerLink[]) {
        this._links = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get sponsorHref(): string | null {
        return this.getAttribute('sponsor-href')
    }
    set sponsorHref(v: string | null) {
        if (v != null) this.setAttribute('sponsor-href', v)
        else this.removeAttribute('sponsor-href')
    }

    get sponsorLabel(): string {
        return this.getAttribute('sponsor-label') ?? 'Sponsor'
    }
    set sponsorLabel(v: string) {
        setAttr(this, 'sponsor-label', v)
    }

    get location(): string | null {
        return this.getAttribute('location')
    }
    set location(v: string | null) {
        if (v != null) this.setAttribute('location', v)
        else this.removeAttribute('location')
    }

    private render(): void {
        const name = this.name
        const avatarUrl = this.avatarUrl
        const roleVal = this.getAttribute('role')
        const bio = this.bio
        const sponsorHref = this.sponsorHref
        const sponsorLabel = this.sponsorLabel
        const location = this.location

        const avatarHtml =
            `<div class="tc-maintainer-card__avatar-wrap">` +
            `<img class="tc-maintainer-card__avatar" src="${esc(avatarUrl)}" alt="${esc(name)}">` +
            `</div>`

        const nameHtml = `<h3 class="tc-maintainer-card__name">${esc(name)}</h3>`

        const roleHtml = roleVal ? `<p class="tc-maintainer-card__role">${esc(roleVal)}</p>` : ''

        const locationHtml = location
            ? `<p class="tc-maintainer-card__location">` +
              mapPinIconHtml +
              `<span>${esc(location)}</span></p>`
            : ''

        const bioHtml = bio ? `<p class="tc-maintainer-card__bio">${esc(bio)}</p>` : ''

        const linksHtml =
            this._links.length > 0
                ? `<div class="tc-maintainer-card__links" role="list" aria-label="Social links">` +
                  this._links
                      .map((link) => {
                          const svgHtml = link.icon ? lucideByName(link.icon) : ''
                          return (
                              `<a class="tc-maintainer-card__link" href="${esc(link.href)}" ` +
                              `role="listitem" target="_blank" rel="noopener noreferrer" ` +
                              `aria-label="${esc(link.label)}">${svgHtml}</a>`
                          )
                      })
                      .join('') +
                  `</div>`
                : ''

        const sponsorInner =
            heartIconHtml +
            `<span class="tc-maintainer-card__sponsor-label">${esc(sponsorLabel)}</span>`

        const sponsorHtml = sponsorHref
            ? `<a class="tc-maintainer-card__sponsor" href="${esc(sponsorHref)}" ` +
              `target="_blank" rel="noopener noreferrer">${sponsorInner}</a>`
            : `<button class="tc-maintainer-card__sponsor" type="button">${sponsorInner}</button>`

        patchHtml(
            this,
            `<div class="card tc-maintainer-card">` +
                `<div class="card-body tc-maintainer-card__body">` +
                avatarHtml +
                nameHtml +
                roleHtml +
                locationHtml +
                bioHtml +
                linksHtml +
                sponsorHtml +
                `</div>` +
                `</div>`,
        )

        // Sponsor CTA: a real `<a>` when sponsor-href is set (browser handles the
        // navigation itself), but a plain `<button>` otherwise — the button has
        // no href to act on, so without this it was a dead element that did
        // nothing on click. Fire an event either way (bindOnce so re-renders
        // don't stack listeners) so the host can react to the click — e.g. open
        // its own sponsor flow when no href was given, or just track the click.
        bindOnce(this.querySelector('.tc-maintainer-card__sponsor'), 'click', () => {
            this.dispatchEvent(
                new CustomEvent('tc-sponsor-click', {
                    bubbles: true,
                    composed: true,
                    detail: { href: sponsorHref },
                }),
            )
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MaintainerCard
    }
}

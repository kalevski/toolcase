import { esc } from './internal/esc'
const TAG_NAME = 'tc-sponsor-wall'

export type SponsorTierSize = 'xl' | 'lg' | 'md' | 'sm'

const SIZES: SponsorTierSize[] = ['xl', 'lg', 'md', 'sm']

export interface SponsorLogo {
    src: string
    alt: string
    href?: string
}

export interface SponsorTier {
    name: string
    label?: string
    logos: SponsorLogo[]
    size?: SponsorTierSize
}

export class SponsorWall extends HTMLElement {
    private _initialised = false
    private _tiers: SponsorTier[] = []

    static get observedAttributes(): string[] {
        return ['title']
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

    get tiers(): SponsorTier[] {
        return this._tiers
    }
    set tiers(v: SponsorTier[]) {
        this._tiers = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    private _logoHtml(logo: SponsorLogo): string {
        const img = `<img class="tc-sponsor-logo" src="${esc(logo.src)}" alt="${esc(logo.alt)}" loading="lazy">`
        if (logo.href) {
            return (
                `<a class="tc-sponsor-logo-wrap tc-sponsor-logo-wrap--linked" ` +
                `href="${esc(logo.href)}" target="_blank" rel="noopener noreferrer">` +
                `${img}` +
                `</a>`
            )
        }
        return `<span class="tc-sponsor-logo-wrap">${img}</span>`
    }

    private _tierHtml(tier: SponsorTier): string {
        const size: string = tier.size && SIZES.includes(tier.size) ? tier.size : 'md'
        const label = tier.label ?? tier.name
        const labelHtml = label
            ? `<div class="tc-sponsor-tier-label" aria-hidden="true">${esc(label)}</div>`
            : ''
        const logosHtml = tier.logos.map((l) => this._logoHtml(l)).join('')

        return (
            `<div class="tc-sponsor-tier tc-sponsor-tier--${size}" ` +
            `role="group" aria-label="${esc(label)}">` +
            `${labelHtml}` +
            `<div class="tc-sponsor-tier-logos">${logosHtml}</div>` +
            `</div>`
        )
    }

    private render(): void {
        this.classList.add('tc-sponsor-wall')

        const titleAttr = this.getAttribute('title')
        const titleHtml = titleAttr
            ? `<div class="tc-sponsor-wall-title">${esc(titleAttr)}</div>`
            : ''

        const tiersHtml = this._tiers.map((t) => this._tierHtml(t)).join('')

        this.innerHTML = `${titleHtml}${tiersHtml}`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SponsorWall
    }
}

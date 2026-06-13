import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-social-links'

export type SocialKind =
    | 'github'
    | 'x'
    | 'linkedin'
    | 'mastodon'
    | 'youtube'
    | 'rss'
    | 'discord'
    | 'instagram'
    | 'tiktok'

export type SocialLinksSize = 'sm' | 'md' | 'lg'
export type SocialLinksVariant = 'ghost' | 'filled'

export interface SocialLink {
    kind: SocialKind
    href: string
    label?: string
}

const SIZES: SocialLinksSize[] = ['sm', 'md', 'lg']
const VARIANTS: SocialLinksVariant[] = ['ghost', 'filled']

// PascalCase lucide-static export names for each SocialKind.
const ICONS: Record<SocialKind, string> = {
    github: 'Github',
    x: 'TwitterX',
    linkedin: 'Linkedin',
    mastodon: 'Mastodon',
    youtube: 'Youtube',
    rss: 'Rss',
    discord: 'Discord',
    instagram: 'Instagram',
    tiktok: 'Tiktok',
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class SocialLinks extends HTMLElement {
    private _initialised = false
    private _links: SocialLink[] = []

    static get observedAttributes(): string[] {
        return ['size', 'variant']
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

    get links(): SocialLink[] {
        return this._links
    }
    set links(v: SocialLink[]) {
        this._links = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get size(): SocialLinksSize {
        const v = this.getAttribute('size') as SocialLinksSize
        return SIZES.includes(v) ? v : 'md'
    }
    set size(v: SocialLinksSize) {
        this.setAttribute('size', v)
    }

    get variant(): SocialLinksVariant {
        const v = this.getAttribute('variant') as SocialLinksVariant
        return VARIANTS.includes(v) ? v : 'ghost'
    }
    set variant(v: SocialLinksVariant) {
        this.setAttribute('variant', v)
    }

    private _resolveIcon(kind: SocialKind): string {
        const name = ICONS[kind]
        if (!name) return ''
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (!svgStr) return ''
        return icon(svgStr)
    }

    private render(): void {
        const size = this.size
        const variant = this.variant

        this.classList.add('tc-social-links')
        SIZES.forEach(s => this.classList.remove(`tc-social-links-${s}`))
        this.classList.add(`tc-social-links-${size}`)
        VARIANTS.forEach(v => this.classList.remove(`tc-social-links-${v}`))
        this.classList.add(`tc-social-links-${variant}`)
        this.setAttribute('role', 'list')

        this.innerHTML = this._links.map(link => {
            const label = esc(link.label ?? link.kind)
            const href = esc(link.href)
            const svgHtml = this._resolveIcon(link.kind)
            return `<a class="tc-social-link" href="${href}" role="listitem" target="_blank" rel="noopener noreferrer" aria-label="${label}">${svgHtml}</a>`
        }).join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SocialLinks
    }
}

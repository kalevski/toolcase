import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-community-links'

export interface CommunityLink {
    label: string
    href: string
    icon?: string
    count?: number | string
    description?: string
}

// Map of common platform keys to PascalCase lucide-static export names.
const PLATFORM_ICONS: Record<string, string> = {
    github: 'Github',
    discord: 'Discord',
    twitter: 'TwitterX',
    x: 'TwitterX',
    linkedin: 'Linkedin',
    youtube: 'Youtube',
    mastodon: 'Mastodon',
    instagram: 'Instagram',
    tiktok: 'Tiktok',
    rss: 'Rss',
    slack: 'Slack',
    twitch: 'Twitch',
    facebook: 'Facebook',
    reddit: 'MessageSquare',
    forum: 'MessageCircle',
    chat: 'MessageCircle',
    community: 'Users',
    docs: 'BookOpen',
    blog: 'Rss',
    npm: 'Package',
    crates: 'Package',
    pypi: 'Package',
    website: 'Globe',
    link: 'Link',
}

const FALLBACK_ICON = 'Link'

function resolvePlatformIcon(name: string): string {
    if (!name) return ''
    const key = name.toLowerCase().trim()
    const lucideName = PLATFORM_ICONS[key] ?? name
    const svgStr =
        (LucideIcons as Record<string, string>)[lucideName] ??
        (LucideIcons as Record<string, string>)[FALLBACK_ICON] ??
        ''
    return svgStr ? icon(svgStr, 'tc-community-links-item__icon-svg') : ''
}

export class CommunityLinks extends HTMLElement {
    private _initialised = false
    private _links: CommunityLink[] = []

    static get observedAttributes(): string[] {
        return ['title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const hasTitleAttr = this.hasAttribute('title')
            const slotNodes = hasTitleAttr
                ? []
                : Array.from(this.querySelectorAll('[slot="title"]'))
            this.render()
            if (!hasTitleAttr) {
                const slot = this.querySelector('.tc-community-links-title-slot')
                if (slot) slotNodes.forEach((n) => slot.appendChild(n))
                this._updateHeaderVisibility()
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const hasTitleAttr = this.hasAttribute('title')
        const slot = this.querySelector('.tc-community-links-title-slot')
        const slotNodes =
            !hasTitleAttr && slot ? Array.from(slot.querySelectorAll('[slot="title"]')) : []
        this.render()
        if (!hasTitleAttr) {
            const newSlot = this.querySelector('.tc-community-links-title-slot')
            if (newSlot) slotNodes.forEach((n) => newSlot.appendChild(n))
            this._updateHeaderVisibility()
        }
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get links(): CommunityLink[] {
        return this._links
    }
    set links(v: CommunityLink[]) {
        this._links = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        const hasTitleAttr = this.hasAttribute('title')
        const slot = this.querySelector('.tc-community-links-title-slot')
        const slotNodes =
            !hasTitleAttr && slot ? Array.from(slot.querySelectorAll('[slot="title"]')) : []
        this.render()
        if (!hasTitleAttr) {
            const newSlot = this.querySelector('.tc-community-links-title-slot')
            if (newSlot) slotNodes.forEach((n) => newSlot.appendChild(n))
            this._updateHeaderVisibility()
        }
    }

    // Hide the slot-header container when no slotted content is present.
    private _updateHeaderVisibility(): void {
        const header = this.querySelector('.tc-community-links__header--slot') as HTMLElement | null
        if (!header) return
        const slot = header.querySelector('.tc-community-links-title-slot')
        if (slot && slot.hasChildNodes()) {
            header.style.removeProperty('display')
        } else {
            header.style.display = 'none'
        }
    }

    private render(): void {
        this.classList.add('tc-community-links')

        const titleAttr = this.getAttribute('title')
        const hasTitleAttr = titleAttr != null

        let headerHtml = ''
        if (hasTitleAttr) {
            // Title attribute takes precedence — render inline text.
            if (titleAttr) {
                headerHtml = `<div class="tc-community-links__header"><h3 class="tc-community-links__title">${esc(titleAttr)}</h3></div>`
            }
        } else {
            // No title attribute — render a slot container (may be populated by connectedCallback).
            headerHtml = `<div class="tc-community-links__header tc-community-links__header--slot" style="display:none"><span class="tc-community-links-title-slot"></span></div>`
        }

        const gridHtml = this._links
            .map((link) => {
                const label = esc(link.label)
                const href = esc(link.href)
                const iconHtml = link.icon ? resolvePlatformIcon(link.icon) : ''
                const descHtml = link.description
                    ? `<span class="tc-community-links-item__desc">${esc(link.description)}</span>`
                    : ''
                const countHtml =
                    link.count != null
                        ? `<span class="tc-community-links-item__count" aria-hidden="true">${esc(String(link.count))}</span>`
                        : ''
                const ariaLabel = link.count != null ? `${link.label} — ${link.count}` : link.label

                return (
                    `<a class="tc-community-links-item" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${esc(ariaLabel)}" role="listitem">` +
                    `<span class="tc-community-links-item__icon">${iconHtml}</span>` +
                    `<span class="tc-community-links-item__body">` +
                    `<span class="tc-community-links-item__label">${label}</span>${descHtml}` +
                    `</span>${countHtml}</a>`
                )
            })
            .join('')

        this.innerHTML = `${headerHtml}<div class="tc-community-links-grid" role="list">${gridHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CommunityLinks
    }
}

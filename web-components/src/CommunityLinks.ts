import { patchHtml } from './internal/patch-html'
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
// lucide-static carries NO brand/logo icons (removed for trademark reasons —
// see BRAND_ICONS below and the same note in SocialLinks.ts), so only
// genuinely generic glyphs belong in this map.
const PLATFORM_ICONS: Record<string, string> = {
    rss: 'Rss',
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

// Inline brand SVGs (Bootstrap Icons, viewBox 0 0 16 16, fill-based) for
// platforms lucide-static can't provide. `class=""` is a deliberate no-op
// placeholder — icon() injects the sizing class into it.
const BRAND_ICONS: Record<string, string> = {
    github:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
    discord:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.018-.011 8.875 8.875 0 0 1-1.248-.595.05.05 0 0 1-.02-.066.051.051 0 0 1 .015-.019c.084-.063.168-.129.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.052.052 0 0 1 .053.007c.08.066.164.132.248.195a.051.051 0 0 1-.004.085 8.254 8.254 0 0 1-1.249.594.05.05 0 0 0-.03.03.052.052 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.034.034 0 0 0-.02-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z"/></svg>',
    twitter:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/></svg>',
    x: '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865z"/></svg>',
    linkedin:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225z"/></svg>',
    youtube:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.397a2.01 2.01 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.01 2.01 0 0 1-1.415-1.419c-.111-.258-.185-.825-.235-1.397l-.008-.105-.008-.104A31.4 31.4 0 0 1 0 8.123v-.255c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.01 2.01 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A99.788 99.788 0 0 1 7.858 2zM6.4 5.209v4.818l4.157-2.408z"/></svg>',
    mastodon:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M11.19 12.195c2.016-.24 3.77-1.475 3.99-2.603.348-1.778.32-4.339.32-4.339 0-3.47-2.286-4.488-2.286-4.488C12.062.238 10.083.017 8.027 0h-.05C5.92.017 3.942.238 2.79.765c0 0-2.285 1.017-2.285 4.488l-.002.662c-.004.64-.007 1.35.011 2.091.083 3.394.626 6.74 3.78 7.57 1.454.383 2.703.463 3.709.408 1.823-.1 2.847-.647 2.847-.647l-.06-1.317s-1.303.41-2.767.36c-1.45-.05-2.98-.156-3.215-1.928a3.614 3.614 0 0 1-.033-.496s1.424.347 3.228.43c1.103.05 2.137-.064 3.188-.189zm1.613-2.47H11.13v-4.08c0-.859-.364-1.295-1.091-1.295-.804 0-1.207.517-1.207 1.541v2.233H7.168V5.89c0-1.024-.403-1.541-1.207-1.541-.727 0-1.091.436-1.091 1.296v4.079H3.197V5.522c0-.859.22-1.541.66-2.046.456-.505 1.052-.764 1.793-.764.856 0 1.504.328 1.933.983L8 4.39l.417-.695c.429-.655 1.077-.983 1.934-.983.74 0 1.336.259 1.791.764.442.505.661 1.187.661 2.046z"/></svg>',
    instagram:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.599-.92c-.11-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334"/></svg>',
    tiktok:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M9 0h1.98c.144.715.54 1.617 1.235 2.512C12.895 3.389 13.797 4 15 4v2c-1.753 0-3.07-.814-4-1.829V11a5 5 0 1 1-5-5v2a3 3 0 1 0 3 3z"/></svg>',
    slack:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M3.362 10.11c0 .926-.756 1.681-1.681 1.681S0 11.036 0 10.111.756 8.43 1.68 8.43h1.682zm.846 0c0-.924.756-1.68 1.681-1.68s1.681.756 1.681 1.68v4.21c0 .924-.756 1.68-1.68 1.68a1.685 1.685 0 0 1-1.682-1.68zM5.89 3.362c-.926 0-1.682-.756-1.682-1.681S4.964 0 5.89 0s1.68.756 1.68 1.68v1.682zm0 .846c.924 0 1.68.756 1.68 1.681S6.814 7.57 5.89 7.57H1.68C.757 7.57 0 6.814 0 5.89c0-.926.756-1.682 1.68-1.682zm6.749 1.682c0-.926.755-1.682 1.68-1.682S16 4.964 16 5.889s-.756 1.681-1.68 1.681h-1.681zm-.848 0c0 .924-.755 1.68-1.68 1.68A1.685 1.685 0 0 1 8.43 5.89V1.68C8.43.757 9.186 0 10.11 0c.926 0 1.681.756 1.681 1.68zm-1.681 6.748c.926 0 1.682.756 1.682 1.681S11.036 16 10.11 16s-1.681-.756-1.681-1.68v-1.682h1.68zm0-.847c-.924 0-1.68-.755-1.68-1.68s.756-1.681 1.68-1.681h4.21c.924 0 1.68.756 1.68 1.68 0 .926-.756 1.681-1.68 1.681z"/></svg>',
    twitch:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M3.857 0 1 2.857v10.286h3.429V16l2.857-2.857H9.57L14.714 8V0zm9.714 7.429-2.285 2.285H9l-2 2v-2H4.429V1.143h9.142z"/><path d="M11.857 3.143h-1.143V6.57h1.143zm-3.143 0H7.571V6.57h1.143z"/></svg>',
    facebook:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951"/></svg>',
    reddit:
        '<svg viewBox="0 0 16 16" fill="currentColor" class=""><path d="M6.167 8a.83.83 0 0 0-.83.83c0 .459.372.84.83.831a.831.831 0 0 0 0-1.661m1.843 3.647c.315 0 1.403-.038 1.976-.611a.23.23 0 0 0 0-.306.213.213 0 0 0-.306 0c-.353.363-1.126.487-1.67.487-.545 0-1.308-.124-1.671-.487a.213.213 0 0 0-.306 0 .213.213 0 0 0 0 .306c.564.563 1.652.61 1.977.61zm.992-2.807c0 .458.373.83.831.83s.83-.381.83-.83a.831.831 0 0 0-1.66 0z"/><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.828-1.165c-.315 0-.602.124-.812.325-.801-.573-1.9-.945-3.121-.993l.534-2.501 1.738.372a.83.83 0 1 0 .83-.869.83.83 0 0 0-.744.468l-1.938-.41a.2.2 0 0 0-.153.028.2.2 0 0 0-.086.134l-.592 2.788c-1.24.038-2.358.41-3.17.992-.21-.2-.496-.324-.81-.324a1.163 1.163 0 0 0-.478 2.224q-.03.17-.029.353c0 1.795 2.091 3.256 4.669 3.256s4.668-1.451 4.668-3.256c0-.114-.01-.238-.029-.353.401-.181.688-.592.688-1.069 0-.65-.525-1.165-1.165-1.165"/></svg>',
}

const ICON_SVG_CLASS = 'tc-community-links-item__icon-svg'
const FALLBACK_ICON = 'Link'

function resolvePlatformIcon(name: string): string {
    if (!name) return ''
    const key = name.toLowerCase().trim()
    const brandSvg = BRAND_ICONS[key]
    if (brandSvg) return icon(brandSvg, `${ICON_SVG_CLASS} ${ICON_SVG_CLASS}--brand`)
    const lucideName = PLATFORM_ICONS[key] ?? name
    const svgStr =
        (LucideIcons as Record<string, string>)[lucideName] ??
        (LucideIcons as Record<string, string>)[FALLBACK_ICON] ??
        ''
    return svgStr ? icon(svgStr, ICON_SVG_CLASS) : ''
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

        patchHtml(
            this,
            `${headerHtml}<div class="tc-community-links-grid" role="list">${gridHtml}</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CommunityLinks
    }
}

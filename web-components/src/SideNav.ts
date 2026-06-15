import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-side-nav'

export interface SideNavItem {
    key?: string
    label: string
    icon?: string
    href?: string
    active?: boolean
    badge?: string
    target?: string
    rel?: string
    disabled?: boolean
}

export interface SideNavSection {
    key?: string
    title?: string
    items: SideNavItem[]
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// kebab-case lucide name → PascalCase lookup in lucide-static, wrapped in icon().
function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr, 'tc-side-nav-icon')
}

export class SideNav extends HTMLElement {
    private _initialised = false
    private _sections: SideNavSection[] = []

    // Optional callback fired alongside the tc-item-click CustomEvent.
    onItemClick: ((event: Event, item: SideNavItem) => void) | null = null

    static get observedAttributes(): string[] {
        return ['loading', 'loading-count']
    }

    connectedCallback(): void {
        // Adding the same listener reference twice is a no-op, so this is safe
        // to run unconditionally and survives a disconnect/reconnect cycle.
        this.addEventListener('click', this._onClick)
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get sections(): SideNavSection[] {
        return this._sections
    }
    set sections(v: SideNavSection[]) {
        this._sections = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get loadingCount(): number {
        return Math.max(1, parseInt(this.getAttribute('loading-count') ?? '5', 10) || 5)
    }
    set loadingCount(v: number) {
        this.setAttribute('loading-count', String(v))
    }

    private _onClick = (event: Event): void => {
        const target = event.target as Element | null
        const el = target?.closest<HTMLElement>('.tc-side-nav-item')
        if (!el || !this.contains(el)) return

        const sIndex = parseInt(el.dataset.sectionIndex ?? '', 10)
        const iIndex = parseInt(el.dataset.itemIndex ?? '', 10)
        const item = this._sections[sIndex]?.items?.[iIndex]
        if (!item) return

        if (item.disabled) {
            event.preventDefault()
            return
        }

        const key = item.key ?? `${sIndex}-${iIndex}`
        this.dispatchEvent(new CustomEvent('tc-item-click', {
            bubbles: true,
            composed: true,
            detail: { item, key },
        }))
        if (typeof this.onItemClick === 'function') this.onItemClick(event, item)
    }

    private render(): void {
        if (this.loading) {
            this.setAttribute('aria-busy', 'true')
            const rows = Array.from({ length: this.loadingCount }, () =>
                '<li class="tc-side-nav-item tc-side-nav-item--skeleton" aria-hidden="true">' +
                '<span class="tc-side-nav-skeleton"></span>' +
                '</li>'
            ).join('')
            this.innerHTML = [
                '<nav class="tc-side-nav" aria-label="Loading navigation">',
                '<div class="tc-side-nav-section">',
                '<span class="visually-hidden" role="status">Loading navigation…</span>',
                `<ul class="tc-side-nav-list" aria-hidden="true">${rows}</ul>`,
                '</div>',
                '</nav>',
            ].join('')
            return
        }

        this.removeAttribute('aria-busy')

        const sectionsHtml = this._sections.map((section, sIndex) => {
            const titleHtml = section.title
                ? `<div class="tc-side-nav-section-title">${esc(section.title)}</div>`
                : ''

            const itemsHtml = (Array.isArray(section.items) ? section.items : []).map((item, iIndex) => {
                const classes = ['tc-side-nav-item']
                if (item.active) classes.push('active')
                if (item.disabled) classes.push('disabled')
                const cls = classes.join(' ')

                const iconHtml = item.icon ? lucideByName(item.icon) : ''
                const labelHtml = `<span class="tc-side-nav-label">${esc(item.label ?? '')}</span>`
                const badgeHtml = item.badge != null && item.badge !== ''
                    ? `<span class="tc-side-nav-badge">${esc(String(item.badge))}</span>`
                    : ''

                const dataAttrs = `data-section-index="${sIndex}" data-item-index="${iIndex}"`
                const ariaCurrent = item.active ? ' aria-current="page"' : ''
                const inner = `${iconHtml}${labelHtml}${badgeHtml}`

                let control: string
                if (item.href && !item.disabled) {
                    const target = item.target ? ` target="${esc(item.target)}"` : ''
                    const rel = item.rel ? ` rel="${esc(item.rel)}"` : ''
                    control = `<a class="${cls}" href="${esc(item.href)}"${target}${rel}${ariaCurrent} ${dataAttrs}>${inner}</a>`
                } else if (item.disabled) {
                    control = `<button type="button" class="${cls}" disabled aria-disabled="true"${ariaCurrent} ${dataAttrs}>${inner}</button>`
                } else {
                    control = `<button type="button" class="${cls}"${ariaCurrent} ${dataAttrs}>${inner}</button>`
                }

                return `<li>${control}</li>`
            }).join('')

            return [
                '<div class="tc-side-nav-section">',
                titleHtml,
                `<ul class="tc-side-nav-list">${itemsHtml}</ul>`,
                '</div>',
            ].join('')
        }).join('')

        this.innerHTML = `<nav class="tc-side-nav">${sectionsHtml}</nav>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SideNav
    }
}

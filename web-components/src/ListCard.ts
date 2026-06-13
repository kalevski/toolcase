import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-list-card'

export interface ListItem {
    id?: string
    icon?: string
    label: string
    value?: string | number
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function resolveIcon(name: string): string {
    const svg = (LucideIcons as Record<string, string>)[name]
    return svg ? icon(svg, 'tc-list-card-icon-svg') : ''
}

export class ListCard extends HTMLElement {
    private _initialised = false
    private _items: ListItem[] = []

    static get observedAttributes(): string[] {
        return ['title', 'ordered', 'loading', 'loading-count']
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

    get title(): string | null {
        return this.getAttribute('title')
    }
    set title(v: string | null) {
        if (v != null) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get items(): ListItem[] {
        return this._items
    }
    set items(v: ListItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get ordered(): boolean {
        return this.hasAttribute('ordered')
    }
    set ordered(v: boolean) {
        if (v) this.setAttribute('ordered', '')
        else this.removeAttribute('ordered')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get loadingCount(): number {
        return Math.max(1, parseInt(this.getAttribute('loading-count') ?? '4', 10) || 4)
    }
    set loadingCount(v: number) {
        this.setAttribute('loading-count', String(v))
    }

    private render(): void {
        const titleVal = this.title
        const ordered = this.ordered
        const loading = this.loading
        const loadingCount = this.loadingCount

        const headerHtml = titleVal
            ? `<div class="tc-list-card-header"><h3 class="tc-list-card-title">${esc(titleVal)}</h3></div>`
            : ''

        let listHtml: string
        if (loading) {
            const skeletonRows = Array.from({ length: loadingCount }, () =>
                '<li class="tc-list-card-item tc-list-card-item--skeleton">' +
                '<div class="tc-list-card-lead" aria-hidden="true">' +
                '<div class="tc-list-card-skeleton tc-list-card-skeleton--lead"></div>' +
                '</div>' +
                '<div class="tc-list-card-skeleton tc-list-card-skeleton--label"></div>' +
                '<div class="tc-list-card-skeleton tc-list-card-skeleton--value"></div>' +
                '</li>'
            ).join('')
            const tag = ordered ? 'ol' : 'ul'
            listHtml = [
                `<${tag} class="tc-list-card-list" aria-busy="true">`,
                '<li class="visually-hidden" role="status">Loading…</li>',
                skeletonRows,
                `</${tag}>`,
            ].join('')
        } else {
            const tag = ordered ? 'ol' : 'ul'
            const rows = this._items.map((item, i) => {
                let leadHtml: string
                if (ordered) {
                    leadHtml = `<span class="tc-list-card-lead" aria-hidden="true"><span class="tc-list-card-rank">${i + 1}</span></span>`
                } else if (item.icon) {
                    const iconSvg = resolveIcon(item.icon)
                    leadHtml = iconSvg
                        ? `<span class="tc-list-card-lead" aria-hidden="true">${iconSvg}</span>`
                        : `<span class="tc-list-card-lead" aria-hidden="true"></span>`
                } else {
                    leadHtml = ''
                }
                const valueHtml = item.value != null
                    ? `<span class="tc-list-card-value">${esc(String(item.value))}</span>`
                    : ''
                return [
                    '<li class="tc-list-card-item">',
                    leadHtml,
                    `<span class="tc-list-card-label">${esc(item.label)}</span>`,
                    valueHtml,
                    '</li>',
                ].join('')
            }).join('')
            listHtml = `<${tag} class="tc-list-card-list">${rows}</${tag}>`
        }

        this.innerHTML = [
            '<div class="tc-list-card-inner">',
            headerHtml,
            '<div class="tc-list-card-body">',
            listHtml,
            '</div>',
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ListCard
    }
}

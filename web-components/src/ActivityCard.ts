import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-activity-card'

export interface ActivityItem {
    id?: string
    icon?: string
    title: string
    description?: string
    timestamp?: string
}

const FALLBACK_ICON = 'Circle'

export class ActivityCard extends HTMLElement {
    private _initialised = false
    private _activities: ActivityItem[] = []

    static get observedAttributes(): string[] {
        return ['title', 'loading', 'loading-count']
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

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string | null) {
        if (v != null) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get loadingCount(): number {
        return Math.max(1, parseInt(this.getAttribute('loading-count') ?? '3', 10) || 3)
    }
    set loadingCount(v: number) {
        this.setAttribute('loading-count', String(v))
    }

    get activities(): ActivityItem[] {
        return this._activities
    }
    set activities(v: ActivityItem[]) {
        this._activities = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private _resolveIcon(name: string): string {
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (svgStr) return icon(svgStr, 'tc-activity-icon-svg')
        const fallback = (LucideIcons as Record<string, string>)[FALLBACK_ICON]
        return fallback ? icon(fallback, 'tc-activity-icon-svg') : ''
    }

    private render(): void {
        const titleVal = this.getAttribute('title')
        const loading = this.loading
        const loadingCount = this.loadingCount

        const headerHtml = titleVal
            ? `<div class="tc-activity-card-header"><h3 class="tc-activity-card-title">${esc(titleVal)}</h3></div>`
            : ''

        let listHtml: string
        if (loading) {
            const rows = Array.from(
                { length: loadingCount },
                () =>
                    '<li class="tc-activity-item tc-activity-item--skeleton" role="listitem">' +
                    '<div class="tc-activity-icon" aria-hidden="true">' +
                    '<div class="tc-activity-icon-chip tc-activity-icon-chip--skeleton"></div>' +
                    '</div>' +
                    '<div class="tc-activity-body">' +
                    '<div class="tc-activity-skeleton tc-activity-skeleton--title"></div>' +
                    '<div class="tc-activity-skeleton tc-activity-skeleton--desc"></div>' +
                    '</div>' +
                    '</li>',
            ).join('')
            listHtml = [
                '<ul class="tc-activity-list" role="list" aria-busy="true">',
                '<li class="visually-hidden" role="status">Loading activity…</li>',
                rows,
                '</ul>',
            ].join('')
        } else {
            const items = this._activities
                .map((item, i) => {
                    const iconHtml = this._resolveIcon(item.icon ?? FALLBACK_ICON)
                    const isLast = i === this._activities.length - 1
                    const railClass = isLast ? '' : ' tc-activity-icon--has-rail'
                    const timeHtml = item.timestamp
                        ? `<time class="tc-activity-time">${esc(item.timestamp)}</time>`
                        : ''
                    const descHtml = item.description
                        ? `<span class="tc-activity-desc">${esc(item.description)}</span>`
                        : ''
                    return [
                        `<li class="tc-activity-item" role="listitem">`,
                        `<div class="tc-activity-icon${railClass}" aria-hidden="true">`,
                        `<div class="tc-activity-icon-chip">${iconHtml}</div>`,
                        `</div>`,
                        `<div class="tc-activity-body">`,
                        `<div class="tc-activity-row">`,
                        `<span class="tc-activity-title">${esc(item.title)}</span>`,
                        timeHtml,
                        `</div>`,
                        descHtml,
                        `</div>`,
                        `</li>`,
                    ].join('')
                })
                .join('')
            listHtml = `<ul class="tc-activity-list" role="list">${items}</ul>`
        }

        patchHtml(
            this,
            [
                '<div class="tc-activity-card-inner">',
                headerHtml,
                '<div class="tc-activity-card-body">',
                listHtml,
                '</div>',
                '</div>',
            ].join(''),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ActivityCard
    }
}

import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-timeline'

export type TimelineVariant = 'default' | 'glass' | 'outlined' | 'elevated' | 'minimal'
export type TimelineConnector = 'gradient' | 'solid' | 'dashed'
export type TimelineStatus = 'completed' | 'active' | 'upcoming'

export interface TimelineItem {
    title: string
    date: string
    description?: string
    side?: 'left' | 'right'
    subtitle?: string
    badge?: string
    meta?: string
    icon?: string
    status?: TimelineStatus
    overlap?: number
    tags?: string[]
    progress?: number
    accentColor?: string
}

const VARIANTS: TimelineVariant[] = ['default', 'glass', 'outlined', 'elevated', 'minimal']
const CONNECTORS: TimelineConnector[] = ['gradient', 'solid', 'dashed']

export class Timeline extends HTMLElement {
    private _initialised = false
    private _items: TimelineItem[] = []

    static get observedAttributes(): string[] {
        return ['variant', 'connector', 'overlap', 'loading', 'loading-count']
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

    get items(): TimelineItem[] {
        return this._items
    }
    set items(v: TimelineItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get variant(): TimelineVariant {
        const v = this.getAttribute('variant') as TimelineVariant
        return VARIANTS.includes(v) ? v : 'default'
    }
    set variant(v: TimelineVariant) {
        this.setAttribute('variant', v)
    }

    get connector(): TimelineConnector {
        const v = this.getAttribute('connector') as TimelineConnector
        return CONNECTORS.includes(v) ? v : 'gradient'
    }
    set connector(v: TimelineConnector) {
        this.setAttribute('connector', v)
    }

    get overlap(): number {
        return parseInt(this.getAttribute('overlap') ?? '0', 10) || 0
    }
    set overlap(v: number) {
        this.setAttribute('overlap', String(v))
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

    private _renderNode(item: TimelineItem, status: TimelineStatus): string {
        if (item.icon) {
            return (
                `<div class="tc-timeline-node tc-timeline-node--icon" aria-hidden="true">` +
                lucideByName(item.icon) +
                `</div>`
            )
        }
        return (
            `<div class="tc-timeline-node tc-timeline-node--dot tc-timeline-node--${status}" aria-hidden="true">` +
            `<span class="tc-timeline-node-dot"></span>` +
            `</div>`
        )
    }

    private _renderItem(item: TimelineItem, index: number): string {
        const side = item.side ?? (index % 2 === 0 ? 'left' : 'right')
        const status = item.status ?? (index === 0 ? 'active' : 'upcoming')
        const globalOverlap = this.overlap
        const overlapValue = index === 0 ? 0 : (item.overlap ?? globalOverlap)

        const classes = `tc-timeline-item tc-timeline-item--${status} tc-timeline-item--${side}`

        const styleParts: string[] = [`--tl-index: ${index}`]
        if (overlapValue > 0) {
            styleParts.push(`--timeline-item-overlap: ${overlapValue}px`)
        }
        if (item.accentColor) {
            styleParts.push(`--tl-item-accent: ${esc(item.accentColor)}`)
        }
        const styleAttr = ` style="${styleParts.join('; ')}"`

        const ariaCurrent = status === 'active' ? ' aria-current="step"' : ''
        const nodeHtml = this._renderNode(item, status)

        const badgeHtml = item.badge
            ? `<span class="tc-timeline-badge">${esc(item.badge)}</span>`
            : ''

        const metaHtml = item.meta ? `<span class="tc-timeline-meta">${esc(item.meta)}</span>` : ''

        const subtitleHtml = item.subtitle
            ? `<p class="tc-timeline-subtitle">${esc(item.subtitle)}</p>`
            : ''

        const descHtml = item.description
            ? `<p class="tc-timeline-description">${esc(item.description)}</p>`
            : ''

        const tagsHtml =
            item.tags && item.tags.length > 0
                ? `<div class="tc-timeline-tags">${item.tags.map((t) => `<span class="tc-timeline-tag">${esc(t)}</span>`).join('')}</div>`
                : ''

        const progressNum =
            typeof item.progress === 'number' ? Math.max(0, Math.min(100, item.progress)) : null
        const progressHtml =
            progressNum !== null
                ? `<div class="tc-timeline-progress" role="progressbar" aria-valuenow="${progressNum}" aria-valuemin="0" aria-valuemax="100">` +
                  `<div class="tc-timeline-progress-bar" style="width: ${progressNum}%"></div>` +
                  `</div>`
                : ''

        return (
            `<li class="${classes}"${styleAttr}${ariaCurrent}>` +
            nodeHtml +
            `<article class="tc-timeline-card">` +
            `<header class="tc-timeline-header">` +
            `<div class="tc-timeline-meta-row">` +
            `<time class="tc-timeline-date">${esc(item.date)}</time>` +
            metaHtml +
            `</div>` +
            badgeHtml +
            `</header>` +
            `<h4 class="tc-timeline-title">${esc(item.title)}</h4>` +
            subtitleHtml +
            descHtml +
            tagsHtml +
            progressHtml +
            `</article>` +
            `</li>`
        )
    }

    private render(): void {
        const variant = this.variant
        const connector = this.connector
        const loading = this.loading

        const lineHtml = `<div class="tc-timeline-line tc-timeline-line--${connector}" aria-hidden="true"></div>`

        let itemsHtml: string
        if (loading) {
            const count = this.loadingCount
            const rows = Array.from({ length: count }, (_, i) => {
                const side = i % 2 === 0 ? 'left' : 'right'
                return (
                    `<li class="tc-timeline-item tc-timeline-item--skeleton tc-timeline-item--${side}" aria-hidden="true">` +
                    `<div class="tc-timeline-node tc-timeline-node--dot tc-timeline-node--skeleton" aria-hidden="true">` +
                    `<span class="tc-timeline-node-dot"></span>` +
                    `</div>` +
                    `<article class="tc-timeline-card tc-timeline-card--skeleton">` +
                    `<div class="tc-timeline-skeleton tc-timeline-skeleton--date"></div>` +
                    `<div class="tc-timeline-skeleton tc-timeline-skeleton--title"></div>` +
                    `<div class="tc-timeline-skeleton tc-timeline-skeleton--desc"></div>` +
                    `</article>` +
                    `</li>`
                )
            }).join('')
            itemsHtml =
                `<ol class="tc-timeline-items" aria-busy="true">` +
                `<li class="visually-hidden" role="status">Loading timeline…</li>` +
                rows +
                `</ol>`
        } else {
            const items = this._items.map((item, i) => this._renderItem(item, i)).join('')
            itemsHtml = `<ol class="tc-timeline-items">${items}</ol>`
        }

        this.innerHTML =
            `<div class="tc-timeline tc-timeline--${variant}">` + lineHtml + itemsHtml + `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Timeline
    }
}

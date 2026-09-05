import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-roadmap'

export type RoadmapLayout = 'kanban' | 'stacked'
const LAYOUTS: RoadmapLayout[] = ['kanban', 'stacked']

export type RoadmapStatus = 'shipped' | 'in-progress' | 'planned' | 'considering'
const STATUSES: RoadmapStatus[] = ['shipped', 'in-progress', 'planned', 'considering']

export interface RoadmapItem {
    title: string
    description?: string
    tags?: string[]
}

export interface RoadmapColumn {
    status: RoadmapStatus
    title?: string
    items: RoadmapItem[]
}

const STATUS_LABELS: Record<RoadmapStatus, string> = {
    shipped: 'Shipped',
    'in-progress': 'In Progress',
    planned: 'Planned',
    considering: 'Considering',
}

// Per-status glyphs. The status is also conveyed by the text label, so the icon
// is purely supplementary (aria-hidden via icon()).
const STATUS_ICON_CANDIDATES: Record<RoadmapStatus, string[]> = {
    shipped: ['CheckCircle', 'CheckCircle2', 'Check'],
    'in-progress': ['Clock', 'Loader', 'RefreshCw'],
    planned: ['Circle', 'CircleDashed', 'Dot'],
    considering: ['Lightbulb', 'HelpCircle', 'CircleHelp'],
}

function resolveStatusIconHtml(status: RoadmapStatus): string {
    const candidates = STATUS_ICON_CANDIDATES[status]
    for (const name of candidates) {
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (svgStr) {
            return icon(svgStr, 'tc-roadmap-status-icon')
        }
    }
    return ''
}

const STATUS_ICON_HTML: Record<RoadmapStatus, string> = {
    shipped: resolveStatusIconHtml('shipped'),
    'in-progress': resolveStatusIconHtml('in-progress'),
    planned: resolveStatusIconHtml('planned'),
    considering: resolveStatusIconHtml('considering'),
}

export class Roadmap extends HTMLElement {
    private _initialised = false
    private _columns: RoadmapColumn[] = []

    // Optional callback mirroring the tc-select CustomEvent.
    onSelect: ((detail: { columnStatus: RoadmapStatus; item: RoadmapItem }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['layout', 'title-text']
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

    get columns(): RoadmapColumn[] {
        return this._columns
    }
    set columns(v: RoadmapColumn[]) {
        this._columns = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get layout(): RoadmapLayout {
        const v = this.getAttribute('layout') as RoadmapLayout
        return LAYOUTS.includes(v) ? v : 'kanban'
    }
    set layout(v: RoadmapLayout) {
        setAttr(this, 'layout', v)
    }

    // `title-text` (not the native `title` attribute, which HTMLElement reflects
    // as a tooltip property) carries the optional board heading.
    get titleText(): string | null {
        return this.getAttribute('title-text')
    }
    set titleText(v: string | null) {
        if (v != null) this.setAttribute('title-text', v)
        else this.removeAttribute('title-text')
    }

    private _fireSelect(status: RoadmapStatus, item: RoadmapItem): void {
        const detail = { columnStatus: status, item }
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail,
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(detail)
    }

    private _renderItem(item: RoadmapItem, colIdx: number, itemIdx: number): string {
        const titleHtml = `<span class="tc-roadmap-item-title">${esc(item.title)}</span>`

        const descHtml = item.description
            ? `<span class="tc-roadmap-item-description">${esc(item.description)}</span>`
            : ''

        const tagsHtml =
            item.tags && item.tags.length > 0
                ? `<span class="tc-roadmap-item-tags">` +
                  item.tags
                      .map((t) => `<span class="tc-roadmap-item-tag">${esc(t)}</span>`)
                      .join('') +
                  `</span>`
                : ''

        // Each card is a real <button> so it is keyboard-focusable with visible
        // focus, and Enter/Space activate it natively.
        return (
            `<button type="button" class="tc-roadmap-item" data-col="${colIdx}" data-idx="${itemIdx}">` +
            titleHtml +
            descHtml +
            tagsHtml +
            `</button>`
        )
    }

    private _renderColumn(column: RoadmapColumn, colIdx: number): string {
        const status: RoadmapStatus = STATUSES.includes(column.status) ? column.status : 'planned'
        const statusLabel = STATUS_LABELS[status]
        const items = Array.isArray(column.items) ? column.items : []
        // Escaped once here; reused as-is below (in the span content and the
        // aria-label attribute) — do not esc() it again, that would double-escape
        // any title containing `&`, `<`, `>`, `"` or `'`.
        const heading = column.title ? esc(column.title) : statusLabel

        // The visible heading carries the (optional) custom title; the status word
        // is always present in text — as the heading itself when no custom title is
        // given, or as a mono status tag beside it when one is.
        const statusTagHtml = column.title
            ? `<span class="tc-roadmap-status-tag">${esc(statusLabel)}</span>`
            : ''

        const headerHtml =
            `<h3 class="tc-roadmap-column-header">` +
            `<span class="tc-roadmap-status">` +
            `<span class="tc-roadmap-status-dot" aria-hidden="true"></span>` +
            STATUS_ICON_HTML[status] +
            `<span class="tc-roadmap-status-name">${heading}</span>` +
            statusTagHtml +
            `</span>` +
            `<span class="tc-roadmap-count">${items.length}</span>` +
            `</h3>`

        const bodyHtml =
            `<div class="tc-roadmap-column-body">` +
            items.map((item, itemIdx) => this._renderItem(item, colIdx, itemIdx)).join('') +
            `</div>`

        return (
            `<section class="tc-roadmap-column tc-roadmap-column--${status}" aria-label="${heading}">` +
            headerHtml +
            bodyHtml +
            `</section>`
        )
    }

    private render(): void {
        const layout = this.layout
        const title = this.getAttribute('title-text')

        const titleHtml = title ? `<h2 class="tc-roadmap-title">${esc(title)}</h2>` : ''

        const columnsHtml = this._columns.map((col, idx) => this._renderColumn(col, idx)).join('')

        patchHtml(
            this,
            titleHtml + `<div class="tc-roadmap tc-roadmap--${layout}">${columnsHtml}</div>`,
        )

        const board = this.querySelector<HTMLElement>('.tc-roadmap')
        if (board) {
            bindOnce(board, 'click', (e: Event) => {
                const btn = (e.target as HTMLElement).closest<HTMLElement>('.tc-roadmap-item')
                if (!btn) return
                const colIdx = parseInt(btn.dataset.col ?? '-1', 10)
                const itemIdx = parseInt(btn.dataset.idx ?? '-1', 10)
                const column = this._columns[colIdx]
                const item = column?.items?.[itemIdx]
                if (column && item) this._fireSelect(column.status, item)
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Roadmap
    }
}

import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-status-card'

export type StatusCardStatus = 'ok' | 'warning' | 'error' | 'inactive'
const STATUSES: StatusCardStatus[] = ['ok', 'warning', 'error', 'inactive']

export interface StatusItem {
    id?: string
    label: string
    status: StatusCardStatus
    detail?: string
}

// Priority-list of lucide icon names per status — first found in lucide-static wins.
const STATUS_ICON_KEYS: Record<StatusCardStatus, string[]> = {
    ok: ['Check', 'CheckCircle'],
    warning: ['AlertTriangle', 'AlertCircle'],
    error: ['X', 'XCircle'],
    inactive: ['Minus', 'Circle'],
}

const STATUS_ARIA_LABELS: Record<StatusCardStatus, string> = {
    ok: 'ok',
    warning: 'warning',
    error: 'error',
    inactive: 'inactive',
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function resolveStatusIcon(status: StatusCardStatus): string {
    for (const k of STATUS_ICON_KEYS[status]) {
        const svg = (LucideIcons as Record<string, string>)[k]
        if (svg) return icon(svg, 'tc-status-card-indicator-icon')
    }
    return ''
}

export class StatusCard extends HTMLElement {
    private _initialised = false
    private _items: StatusItem[] = []

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
        return Math.max(1, parseInt(this.getAttribute('loading-count') ?? '4', 10) || 4)
    }
    set loadingCount(v: number) {
        this.setAttribute('loading-count', String(v))
    }

    get items(): StatusItem[] {
        return this._items
    }
    set items(v: StatusItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const titleVal = this.getAttribute('title')
        const loading = this.loading
        const loadingCount = this.loadingCount

        const headerHtml = titleVal
            ? `<div class="tc-status-card-header"><h3 class="tc-status-card-title">${esc(titleVal)}</h3></div>`
            : ''

        let bodyHtml: string
        if (loading) {
            const rows = Array.from({ length: loadingCount }, () =>
                '<li class="tc-status-card-item tc-status-card-item--skeleton" role="listitem" aria-hidden="true">' +
                '<span class="tc-status-card-indicator tc-status-card-indicator--skeleton" aria-hidden="true"></span>' +
                '<span class="tc-status-card-skeleton tc-status-card-skeleton--label"></span>' +
                '<span class="tc-status-card-skeleton tc-status-card-skeleton--detail"></span>' +
                '</li>'
            ).join('')
            bodyHtml = [
                '<ul class="tc-status-card-list" role="list" aria-busy="true">',
                '<li class="visually-hidden" role="status">Loading status…</li>',
                rows,
                '</ul>',
            ].join('')
        } else {
            const rows = this._items.map(item => {
                const status: StatusCardStatus = STATUSES.includes(item.status) ? item.status : 'inactive'
                const iconHtml = resolveStatusIcon(status)
                const statusLabel = STATUS_ARIA_LABELS[status]
                const detailHtml = item.detail != null
                    ? `<span class="tc-status-card-detail">${esc(item.detail)}</span>`
                    : ''
                return [
                    '<li class="tc-status-card-item" role="listitem">',
                    `<span class="tc-status-card-indicator tc-status-card-indicator--${esc(status)}" role="img" aria-label="${esc(statusLabel)}">`,
                    iconHtml,
                    '</span>',
                    `<span class="tc-status-card-label">${esc(item.label)}</span>`,
                    detailHtml,
                    '</li>',
                ].join('')
            }).join('')
            bodyHtml = `<ul class="tc-status-card-list" role="list">${rows}</ul>`
        }

        this.innerHTML = [
            '<div class="tc-status-card-inner">',
            headerHtml,
            '<div class="tc-status-card-body">',
            bodyHtml,
            '</div>',
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StatusCard
    }
}

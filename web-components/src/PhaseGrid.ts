import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-phase-grid'

export type PhaseStatus = 'complete' | 'active' | 'upcoming' | 'blocked'
const STATUSES: PhaseStatus[] = ['complete', 'active', 'upcoming', 'blocked']

export interface PhaseItem {
    title: string
    description?: string
    status: PhaseStatus
    tags?: string[]
    command?: string
}

const STATUS_ICON_CANDIDATES: Record<PhaseStatus, string[]> = {
    complete: ['CheckCircle', 'CheckCircle2', 'Check'],
    active: ['LoaderCircle', 'Loader', 'RefreshCw'],
    upcoming: ['Circle', 'Dot'],
    blocked: ['AlertCircle', 'AlertOctagon', 'OctagonAlert'],
}

const STATUS_LABELS: Record<PhaseStatus, string> = {
    complete: 'Complete',
    active: 'Active',
    upcoming: 'Upcoming',
    blocked: 'Blocked',
}

function resolveStatusIconHtml(status: PhaseStatus): string {
    const candidates = STATUS_ICON_CANDIDATES[status]
    for (const name of candidates) {
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (svgStr) {
            return icon(
                svgStr,
                `tc-phase-grid-item-status-icon tc-phase-grid-item-status-icon--${status}`,
            )
        }
    }
    return ''
}

const STATUS_ICON_HTML: Record<PhaseStatus, string> = {
    complete: resolveStatusIconHtml('complete'),
    active: resolveStatusIconHtml('active'),
    upcoming: resolveStatusIconHtml('upcoming'),
    blocked: resolveStatusIconHtml('blocked'),
}

export class PhaseGrid extends HTMLElement {
    private _initialised = false
    private _phases: PhaseItem[] = []

    static get observedAttributes(): string[] {
        return ['columns']
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

    get phases(): PhaseItem[] {
        return this._phases
    }
    set phases(v: PhaseItem[]) {
        this._phases = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get columns(): number {
        const v = parseInt(this.getAttribute('columns') ?? '3', 10)
        return Number.isFinite(v) && v > 0 ? v : 3
    }
    set columns(v: number) {
        this.setAttribute('columns', String(v))
    }

    private _renderItem(item: PhaseItem): string {
        const status: PhaseStatus = STATUSES.includes(item.status as PhaseStatus)
            ? (item.status as PhaseStatus)
            : 'upcoming'
        const statusIconHtml = STATUS_ICON_HTML[status]
        const statusLabel = STATUS_LABELS[status]

        const statusHtml =
            `<div class="tc-phase-grid-item-status tc-phase-grid-item-status--${status}">` +
            `${statusIconHtml}` +
            `<span class="tc-phase-grid-item-status-label">${esc(statusLabel)}</span>` +
            `</div>`

        const titleHtml = `<div class="tc-phase-grid-item-title">${esc(item.title)}</div>`

        const descHtml = item.description
            ? `<div class="tc-phase-grid-item-description">${esc(item.description)}</div>`
            : ''

        const tagsHtml =
            item.tags && item.tags.length > 0
                ? `<div class="tc-phase-grid-item-tags">` +
                  item.tags
                      .map((t) => `<span class="tc-phase-grid-item-tag">${esc(t)}</span>`)
                      .join('') +
                  `</div>`
                : ''

        const commandHtml = item.command
            ? `<div class="tc-phase-grid-item-command">` +
              `<code class="tc-phase-grid-item-command-code">${esc(item.command)}</code>` +
              `</div>`
            : ''

        return (
            `<div class="tc-phase-grid-item tc-phase-grid-item--${status}">` +
            statusHtml +
            titleHtml +
            descHtml +
            tagsHtml +
            commandHtml +
            `</div>`
        )
    }

    private render(): void {
        const cols = this.columns
        const itemsHtml = this._phases.map((item) => this._renderItem(item)).join('')
        patchHtml(
            this,
            `<div class="tc-phase-grid" style="--tc-pg-cols:${cols}">${itemsHtml}</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PhaseGrid
    }
}

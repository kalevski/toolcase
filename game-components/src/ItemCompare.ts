import type { TooltipItem } from './ItemTooltip'

const TAG_NAME = 'gc-item-compare'

export class ItemCompare extends HTMLElement {

    static get observedAttributes(): string[] {
        return []
    }

    private _current: TooltipItem | null = null
    private _candidate: TooltipItem | null = null

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    get current(): TooltipItem | null {
        return this._current
    }
    set current(value: TooltipItem | null) {
        this._current = value && typeof value === 'object' ? value : null
        if (this.isConnected) this.render()
    }

    get candidate(): TooltipItem | null {
        return this._candidate
    }
    set candidate(value: TooltipItem | null) {
        this._candidate = value && typeof value === 'object' ? value : null
        if (this.isConnected) this.render()
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private renderColumn(item: TooltipItem | null, label: string, which: 'current' | 'candidate', deltas: Record<string, number> | null): string {
        if (!item) {
            return `<div class="gc-item-compare-col is-empty">
                <gc-eyebrow class="gc-item-compare-col-label">${this.escape(label)}</gc-eyebrow>
                <div class="gc-item-compare-empty">—</div>
            </div>`
        }
        const tooltipHTML = `<gc-item-tooltip data-which="${which}"></gc-item-tooltip>`

        let deltaMarkup = ''
        if (deltas) {
            const rows = Object.entries(deltas).map(([key, diff]) => {
                if (diff === 0) return ''
                const dir = diff > 0 ? 'up' : 'down'
                const arrow = diff > 0 ? '▲' : '▼'
                const sign = diff > 0 ? '+' : ''
                return `<div class="gc-item-compare-delta-row" data-dir="${dir}">
                    <span class="gc-item-compare-delta-label">${this.escape(key)}</span>
                    <span class="gc-item-compare-delta-value">${arrow} ${sign}${diff.toLocaleString()}</span>
                </div>`
            }).filter(Boolean).join('')
            if (rows) {
                deltaMarkup = `<div class="gc-item-compare-deltas">
                    <gc-eyebrow class="gc-item-compare-deltas-label">Difference</gc-eyebrow>
                    ${rows}
                </div>`
            }
        }

        return `<div class="gc-item-compare-col">
            <gc-eyebrow class="gc-item-compare-col-label">${this.escape(label)}</gc-eyebrow>
            ${tooltipHTML}
            ${deltaMarkup}
        </div>`
    }

    private computeDeltas(): Record<string, number> | null {
        if (!this._current || !this._candidate) return null
        const map: Record<string, number> = {}
        const currentStats = (this._current.stats ?? []).filter(s => typeof s.value === 'number')
        const candidateStats = (this._candidate.stats ?? []).filter(s => typeof s.value === 'number')
        const allLabels = new Set<string>([
            ...currentStats.map(s => s.label),
            ...candidateStats.map(s => s.label)
        ])
        for (const label of allLabels) {
            const cur = currentStats.find(s => s.label === label)?.value as number | undefined
            const cand = candidateStats.find(s => s.label === label)?.value as number | undefined
            const diff = (cand ?? 0) - (cur ?? 0)
            if (diff !== 0) map[label] = diff
        }
        return map
    }

    private render(): void {
        const deltas = this.computeDeltas()
        this.innerHTML = `
            <div class="gc-item-compare-root">
                ${this.renderColumn(this._current, 'Equipped', 'current', null)}
                ${this.renderColumn(this._candidate, 'Candidate', 'candidate', deltas)}
            </div>
        `
        const currentEl = this.querySelector<HTMLElement>('gc-item-tooltip[data-which="current"]')
        if (currentEl) (currentEl as any).item = this._current
        const candidateEl = this.querySelector<HTMLElement>('gc-item-tooltip[data-which="candidate"]')
        if (candidateEl) (candidateEl as any).item = this._candidate
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ItemCompare
    }
}

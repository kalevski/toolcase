import { esc } from './internal/esc'
const TAG_NAME = 'tc-usage-summary-panel'

export interface UsageConfig {
    label: string
    used: number
    total: number
    measurementUnit: string
    warn?: boolean
}

const fmt = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })

function computePct(used: number, total: number): number {
    if (!total || !isFinite(used / total)) return 0
    return Math.min(100, Math.max(0, Math.round((used / total) * 100)))
}

export class UsageSummaryPanel extends HTMLElement {
    private _initialised = false
    private _usage: UsageConfig[] = []

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

    get usage(): UsageConfig[] {
        return this._usage
    }
    set usage(v: UsageConfig[]) {
        this._usage = Array.isArray(v) ? v : []
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
        const raw = this.getAttribute('loading-count')
        const n = parseInt(raw ?? '3', 10)
        return isNaN(n) || n < 1 ? 3 : n
    }
    set loadingCount(v: number) {
        this.setAttribute('loading-count', String(v))
    }

    private render(): void {
        const panelTitle = this.getAttribute('title')
        const loading = this.loading

        const titleHtml = panelTitle
            ? `<div class="tc-usage-summary-panel-title">${esc(panelTitle)}</div>`
            : ''

        if (loading) {
            const count = this.loadingCount
            const skeletonRows = Array.from(
                { length: count },
                () => `
                <div class="tc-usage-summary-panel-row tc-usage-summary-panel-row--skeleton" aria-hidden="true">
                    <div class="tc-usage-summary-panel-row-header">
                        <span class="tc-usage-summary-panel-skeleton tc-usage-summary-panel-skeleton--label"></span>
                        <span class="tc-usage-summary-panel-skeleton tc-usage-summary-panel-skeleton--value"></span>
                    </div>
                    <div class="tc-usage-summary-panel-skeleton tc-usage-summary-panel-skeleton--bar"></div>
                </div>`,
            ).join('')

            this.innerHTML = `
                <div class="tc-usage-summary-panel" role="status" aria-busy="true" aria-label="Loading usage data">
                    ${titleHtml}
                    <div class="tc-usage-summary-panel-body" aria-hidden="true">
                        ${skeletonRows}
                    </div>
                    <span class="tc-usage-summary-panel-sr-only">Loading…</span>
                </div>`
            return
        }

        const rowsHtml = this._usage
            .map((item) => {
                const pct = computePct(item.used, item.total)
                const isWarn = !!item.warn || item.used >= item.total
                const warnClass = isWarn ? ' tc-usage-summary-panel-row--warn' : ''
                const usedFmt = fmt.format(item.used)
                const totalFmt = fmt.format(item.total)
                const valueText = `${esc(usedFmt)} / ${esc(totalFmt)} ${esc(item.measurementUnit)}`
                const ariaLabel = `${esc(item.label)}: ${pct}%`

                return `
                <div class="tc-usage-summary-panel-row${warnClass}">
                    <div class="tc-usage-summary-panel-row-header">
                        <span class="tc-usage-summary-panel-label">${esc(item.label)}</span>
                        <span class="tc-usage-summary-panel-value">${valueText}</span>
                    </div>
                    <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${ariaLabel}">
                        <div class="progress-bar" style="width:${pct}%"></div>
                    </div>
                </div>`
            })
            .join('')

        this.innerHTML = `
            <div class="tc-usage-summary-panel">
                ${titleHtml}
                <div class="tc-usage-summary-panel-body">
                    ${rowsHtml}
                </div>
            </div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: UsageSummaryPanel
    }
}

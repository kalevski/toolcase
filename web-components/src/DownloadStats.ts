import { formatCompact } from './internal/format'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-download-stats'

export type DownloadStatsRegistry = 'npm' | 'pypi' | 'crates'
const REGISTRIES: DownloadStatsRegistry[] = ['npm', 'pypi', 'crates']

const REGISTRY_ICONS: Record<DownloadStatsRegistry, string> = {
    npm: 'Package',
    pypi: 'Package',
    crates: 'Package',
}

function parseNumAttr(raw: string | null): number | null {
    if (raw === null) return null
    const n = parseFloat(raw)
    return isNaN(n) ? null : n
}

export class DownloadStats extends HTMLElement {
    private _initialised = false
    private _sparkline: number[] | null = null

    static get observedAttributes(): string[] {
        return ['package-name', 'weekly', 'monthly', 'total', 'registry']
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

    get packageName(): string {
        return this.getAttribute('package-name') ?? ''
    }
    set packageName(v: string) {
        this.setAttribute('package-name', v)
    }

    get weekly(): number | null {
        return parseNumAttr(this.getAttribute('weekly'))
    }
    set weekly(v: number | null) {
        if (v != null) this.setAttribute('weekly', String(v))
        else this.removeAttribute('weekly')
    }

    get monthly(): number | null {
        return parseNumAttr(this.getAttribute('monthly'))
    }
    set monthly(v: number | null) {
        if (v != null) this.setAttribute('monthly', String(v))
        else this.removeAttribute('monthly')
    }

    get total(): number | null {
        return parseNumAttr(this.getAttribute('total'))
    }
    set total(v: number | null) {
        if (v != null) this.setAttribute('total', String(v))
        else this.removeAttribute('total')
    }

    get registry(): DownloadStatsRegistry {
        const v = this.getAttribute('registry') as DownloadStatsRegistry
        return REGISTRIES.includes(v) ? v : 'npm'
    }
    set registry(v: DownloadStatsRegistry) {
        this.setAttribute('registry', v)
    }

    get sparkline(): number[] {
        return this._sparkline ?? []
    }
    set sparkline(v: number[]) {
        this._sparkline = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const packageName = this.packageName
        const registry = this.registry
        const weekly = this.weekly
        const monthly = this.monthly
        const total = this.total
        const sparklineData = this.sparkline

        const iconName = REGISTRY_ICONS[registry] ?? 'Package'
        const svgStr = (LucideIcons as Record<string, string>)[iconName] ?? ''
        const iconHtml = svgStr ? icon(svgStr, 'tc-download-stats__icon-svg') : ''

        const headerHtml = [
            '<div class="tc-download-stats__header">',
            `<span class="tc-download-stats__icon" aria-hidden="true">${iconHtml}</span>`,
            `<code class="tc-download-stats__package">${esc(packageName)}</code>`,
            '</div>',
        ].join('')

        const cells: string[] = []
        if (weekly != null) cells.push(this._cell(formatCompact(weekly), 'Weekly'))
        if (monthly != null) cells.push(this._cell(formatCompact(monthly), 'Monthly'))
        if (total != null) cells.push(this._cell(formatCompact(total), 'Total'))

        const cellsHtml =
            cells.length > 0 ? `<div class="tc-download-stats__cells">${cells.join('')}</div>` : ''

        const sparklineHtml =
            sparklineData.length > 0 ? this._buildSparklineHtml(sparklineData) : ''

        this.innerHTML = `<div class="tc-download-stats">${headerHtml}${cellsHtml}${sparklineHtml}</div>`
    }

    private _cell(number: string, period: string): string {
        return [
            '<div class="tc-download-stats__cell">',
            `<span class="tc-download-stats__number">${esc(number)}</span>`,
            `<span class="tc-download-stats__period">${esc(period)}</span>`,
            '</div>',
        ].join('')
    }

    private _buildSparklineHtml(data: number[]): string {
        const label = this._sparklineAriaLabel(data)
        const inner = this._buildPolyline(data)
        return [
            '<div class="tc-download-stats__sparkline">',
            `<svg class="tc-download-stats__sparkline-svg" viewBox="0 0 160 36" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">`,
            inner,
            '</svg>',
            '</div>',
        ].join('')
    }

    private _sparklineAriaLabel(data: number[]): string {
        if (data.length === 0) return 'Download trend'
        if (data.length === 1) return `Download trend: ${data[0]}`
        const first = data[0]
        const last = data[data.length - 1]
        const dir = last > first ? 'upward' : last < first ? 'downward' : 'flat'
        return `Download trend from ${first} to ${last}, ${dir}`
    }

    private _buildPolyline(data: number[]): string {
        const width = 160
        const height = 36
        const n = data.length

        if (n === 1) {
            const cx = (width / 2).toFixed(1)
            const cy = (height / 2).toFixed(1)
            return `<circle class="tc-download-stats__sparkline-dot" cx="${cx}" cy="${cy}" r="2.5" />`
        }

        const min = Math.min(...data)
        const max = Math.max(...data)
        const range = max - min
        const pad = 3
        const norm = (v: number): number => (range === 0 ? 0.5 : (v - min) / range)

        const pts = data.map((v, i) => {
            const x = pad + (i / (n - 1)) * (width - pad * 2)
            const y = pad + (1 - norm(v)) * (height - pad * 2)
            return `${x.toFixed(1)},${y.toFixed(1)}`
        })

        const lastX = (width - pad).toFixed(1)
        const lastY = (pad + (1 - norm(data[n - 1])) * (height - pad * 2)).toFixed(1)

        return [
            `<polyline class="tc-download-stats__sparkline-line" points="${pts.join(' ')}" />`,
            `<circle class="tc-download-stats__sparkline-dot" cx="${lastX}" cy="${lastY}" r="2.5" />`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DownloadStats
    }
}

import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-metric-card'

function resolveIcon(name: string): string {
    const svg = lucideByName(name)
    return svg ? icon(svg, 'tc-metric-card-icon-svg') : ''
}

function buildSparklinePath(data: number[]): string {
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const stepX = 120 / (data.length - 1)
    return data
        .map((v, i) => {
            const x = i * stepX
            const y = 30 - ((v - min) / range) * 28 + 1
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')
}

export class MetricCard extends HTMLElement {
    private _initialised = false
    private _trend: number[] | null = null

    static get observedAttributes(): string[] {
        // Note: 'title' is reflected by HTMLElement natively; list it so render() re-runs on change.
        return ['title', 'value', 'subtitle', 'icon', 'trend-color', 'loading']
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

    // 'title' is already a native HTMLElement reflected property — no getter/setter needed.

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string | number) {
        this.setAttribute('value', String(v))
    }

    get subtitle(): string | null {
        return this.getAttribute('subtitle')
    }
    set subtitle(v: string | null) {
        if (v != null) this.setAttribute('subtitle', v)
        else this.removeAttribute('subtitle')
    }

    // Note: 'icon' is safe — HTMLElement does not expose a native 'icon' property.
    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get trend(): number[] {
        return this._trend ?? []
    }
    set trend(v: number[]) {
        this._trend = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get trendColor(): string | null {
        return this.getAttribute('trend-color')
    }
    set trendColor(v: string | null) {
        if (v != null) this.setAttribute('trend-color', v)
        else this.removeAttribute('trend-color')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    private render(): void {
        const loading = this.loading

        if (loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            this.innerHTML = [
                '<div class="card tc-metric-card" aria-hidden="true">',
                '<div class="card-body tc-metric-card-body">',
                '<div class="tc-metric-card-head">',
                '<div class="tc-metric-card-skeleton tc-metric-card-skeleton--title"></div>',
                '</div>',
                '<div class="tc-metric-card-skeleton tc-metric-card-skeleton--value"></div>',
                '<div class="tc-metric-card-skeleton tc-metric-card-skeleton--spark"></div>',
                '</div>',
                '</div>',
                '<span class="visually-hidden">Loading…</span>',
            ].join('')
            return
        }

        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const trendColor = this.getAttribute('trend-color')
        if (trendColor) {
            this.style.setProperty('--bs-metric-card-trend', trendColor)
        } else {
            this.style.removeProperty('--bs-metric-card-trend')
        }

        const iconName = this.getAttribute('icon')
        const titleText = this.getAttribute('title') ?? ''
        const valueText = this.getAttribute('value') ?? ''
        const subtitleText = this.getAttribute('subtitle')

        const iconHtml = iconName
            ? `<span class="tc-metric-card-icon-chip" aria-hidden="true">${resolveIcon(iconName)}</span>`
            : ''

        const headHtml = [
            '<div class="tc-metric-card-head">',
            iconHtml,
            `<span class="tc-metric-card-title">${esc(titleText)}</span>`,
            '</div>',
        ].join('')

        const valueHtml = `<div class="tc-metric-card-value">${esc(valueText)}</div>`

        const subtitleHtml =
            subtitleText != null
                ? `<div class="tc-metric-card-subtitle">${esc(subtitleText)}</div>`
                : ''

        const trend = this.trend
        let sparkHtml = ''
        if (trend.length > 1) {
            const d = buildSparklinePath(trend)
            sparkHtml = [
                '<div class="tc-metric-card-spark">',
                '<svg viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">',
                `<path class="tc-metric-card-spark-path" d="${d}" />`,
                '</svg>',
                '</div>',
            ].join('')
        }

        this.innerHTML = [
            '<div class="card tc-metric-card">',
            '<div class="card-body tc-metric-card-body">',
            headHtml,
            valueHtml,
            subtitleHtml,
            sparkHtml,
            '</div>',
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MetricCard
    }
}

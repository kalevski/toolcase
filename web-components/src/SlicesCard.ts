import { esc } from './internal/esc'
const TAG_NAME = 'tc-slices-card'

export interface SliceItem {
    label: string
    value: number
    color?: string
}

// Quiet slate ramp used when a slice omits its color.
const DEFAULT_COLORS = [
    '#334155', // slate-700
    '#475569', // slate-600
    '#64748b', // slate-500
    '#94a3b8', // slate-400
    '#cbd5e1', // slate-300
    '#e2e8f0', // slate-200
    '#1e293b', // slate-800
    '#0f172a', // slate-900
]

const DEFAULT_SIZE = 160
const DEFAULT_STROKE = 24

function parseNum(raw: string | null, fallback: number): number {
    if (raw === null) return fallback
    const n = parseFloat(raw)
    return isFinite(n) && n > 0 ? n : fallback
}

interface Segment {
    label: string
    value: number
    color: string
    dashArray: string
    dashOffset: number
    radius: number
    percent: number
}

function buildSegments(slices: SliceItem[], size: number, strokeWidth: number): Segment[] {
    const total = slices.reduce((s, item) => s + item.value, 0)
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    let accumulated = 0

    return slices.map((slice, i) => {
        const fraction = total > 0 ? slice.value / total : 0
        const dashLength = fraction * circumference
        const gap = circumference - dashLength
        const offset = -accumulated * circumference + circumference * 0.25
        accumulated += fraction

        return {
            label: slice.label,
            value: slice.value,
            color: slice.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
            dashArray: `${dashLength} ${gap}`,
            dashOffset: offset,
            radius,
            percent: total > 0 ? Math.round((slice.value / total) * 100) : 0,
        }
    })
}

export class SlicesCard extends HTMLElement {
    private _initialised = false
    private _slices: SliceItem[] = []

    static get observedAttributes(): string[] {
        // Note: 'title' is reflected by HTMLElement natively; list it so render() re-runs on change.
        return ['title', 'size', 'stroke-width', 'loading']
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

    // Note: 'title' is already a native HTMLElement reflected property — no getter/setter defined.

    get slices(): SliceItem[] {
        return this._slices
    }
    set slices(v: SliceItem[]) {
        this._slices = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get size(): number {
        return parseNum(this.getAttribute('size'), DEFAULT_SIZE)
    }
    set size(v: number) {
        this.setAttribute('size', String(v))
    }

    get strokeWidth(): number {
        return parseNum(this.getAttribute('stroke-width'), DEFAULT_STROKE)
    }
    set strokeWidth(v: number) {
        this.setAttribute('stroke-width', String(v))
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
            const size = this.size
            const half = size / 2
            const strokeWidth = this.strokeWidth
            const radius = (size - strokeWidth) / 2

            this.innerHTML = [
                '<div class="card tc-slices-card" aria-hidden="true">',
                '<div class="card-body tc-slices-card-body">',
                '<div class="tc-slices-card-skeleton tc-slices-card-skeleton--title"></div>',
                '<div class="tc-slices-card-chart">',
                `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`,
                `<circle cx="${half}" cy="${half}" r="${radius}" fill="none"`,
                ` stroke="currentColor" stroke-width="${strokeWidth}"`,
                ` class="tc-slices-card-skeleton-ring"`,
                `/>`,
                '</svg>',
                '</div>',
                '<ul class="tc-slices-card-legend" aria-hidden="true">',
                '<li class="tc-slices-card-legend-item"><div class="tc-slices-card-skeleton tc-slices-card-skeleton--legend"></div></li>',
                '<li class="tc-slices-card-legend-item"><div class="tc-slices-card-skeleton tc-slices-card-skeleton--legend"></div></li>',
                '<li class="tc-slices-card-legend-item"><div class="tc-slices-card-skeleton tc-slices-card-skeleton--legend"></div></li>',
                '</ul>',
                '</div>',
                '</div>',
                '<span class="visually-hidden">Loading…</span>',
            ].join('')
            return
        }

        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const titleText = this.getAttribute('title')
        const size = this.size
        const strokeWidth = this.strokeWidth
        const half = size / 2
        const slices = this._slices
        const total = slices.reduce((s, item) => s + item.value, 0)
        const segments = buildSegments(slices, size, strokeWidth)

        // Card header with optional title
        const headerHtml = titleText
            ? `<div class="card-header tc-slices-card-header"><span class="tc-slices-card-title">${esc(titleText)}</span></div>`
            : ''

        // SVG donut circles
        const circlesHtml =
            segments.length > 0
                ? segments
                      .map((seg) =>
                          [
                              `<circle`,
                              ` cx="${half}" cy="${half}" r="${seg.radius}"`,
                              ` fill="none"`,
                              ` stroke="${esc(seg.color)}"`,
                              ` stroke-width="${strokeWidth}"`,
                              ` stroke-dasharray="${esc(seg.dashArray)}"`,
                              ` stroke-dashoffset="${seg.dashOffset}"`,
                              ` stroke-linecap="round"`,
                              `/>`,
                          ].join(''),
                      )
                      .join('')
                : `<circle cx="${half}" cy="${half}" r="${(size - strokeWidth) / 2}" fill="none" class="tc-slices-card-empty-ring" stroke-width="${strokeWidth}" />`

        const totalStr = total.toLocaleString()
        const totalHtml = `<span class="tc-slices-card-total" aria-label="Total: ${esc(totalStr)}">${esc(totalStr)}</span>`

        const svgHtml = [
            `<div class="tc-slices-card-chart">`,
            `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`,
            circlesHtml,
            `</svg>`,
            totalHtml,
            `</div>`,
        ].join('')

        // Legend rows
        const legendItemsHtml = segments
            .map((seg) =>
                [
                    '<li class="tc-slices-card-legend-item">',
                    `<span class="tc-slices-card-swatch" style="background:${esc(seg.color)};" aria-hidden="true"></span>`,
                    `<span class="tc-slices-card-legend-label">${esc(seg.label)}</span>`,
                    `<span class="tc-slices-card-legend-value">${esc(seg.value.toLocaleString())}</span>`,
                    `<span class="tc-slices-card-legend-percent">${seg.percent}%</span>`,
                    '</li>',
                ].join(''),
            )
            .join('')

        const legendHtml = `<ul class="tc-slices-card-legend" role="list" aria-label="Slice breakdown">${legendItemsHtml}</ul>`

        this.innerHTML = [
            '<div class="card tc-slices-card">',
            headerHtml,
            '<div class="card-body tc-slices-card-body">',
            svgHtml,
            legendHtml,
            '</div>',
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SlicesCard
    }
}

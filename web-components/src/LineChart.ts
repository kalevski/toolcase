import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { msg } from './messages'
import { fixedOriginOffset } from './internal/containingBlock'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-line-chart'

// One series = a name, an ordered list of {x, y} points, and an optional explicit
// colour. The React source calls the name `label` and the points `data`; we accept
// both spellings (`name`/`label`, `data`/`points`) so existing data shapes drop in.
export interface LineChartPoint {
    x: number | string
    y: number
}

export interface LineChartSeries {
    name?: string
    label?: string
    data?: LineChartPoint[]
    points?: LineChartPoint[]
    color?: string
}

// detail of the optional tc-point-hover event
export interface LinePointHoverDetail {
    series: LineChartSeries
    point: LineChartPoint
}

const DEFAULT_HEIGHT = 320

// Default stroke ramp — slate-leaning neutrals first (the design voice: neutrals
// carry it, colour is data). An explicit per-series `color` is the sanctioned
// override. Exposed as --bs-line-chart-series-N so themes can re-skin.
const PALETTE_SIZE = 6

// round an axis max up to a "nice" round number so the top gridline reads cleanly
function niceMax(v: number): number {
    if (v <= 0) return 10
    const e = Math.pow(10, Math.floor(Math.log10(v)))
    return Math.ceil(v / e) * e
}

function defaultYFmt(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`
    return String(Math.round(v))
}

// normalise the two accepted spellings into a stable internal shape
function seriesName(s: LineChartSeries, i: number): string {
    return s.name ?? s.label ?? `Series ${i + 1}`
}
function seriesPoints(s: LineChartSeries): LineChartPoint[] {
    const pts = s.data ?? s.points
    return Array.isArray(pts) ? pts : []
}

// a hover anchor in SVG user space, plus the data needed to fill the tooltip
interface PointAnchor {
    cx: number
    cy: number
    si: number
    pi: number
    color: string
}

export class LineChart extends HTMLElement {
    private _initialised = false
    private _series: LineChartSeries[] = []
    private _xFormatter: ((v: number | string) => string) | null = null
    private _yFormatter: ((v: number) => string) | null = null
    // series indices the user has toggled off via the legend
    private _hidden = new Set<number>()
    // per-render hover anchors and the viewBox dims used to map them to pixels
    private _anchors: PointAnchor[] = []
    private _vw = 0
    private _vh = 0
    // resize tracking — keeps the viewBox width equal to the actual rendered
    // plot width so 1 user unit == 1 px (see _measurePlot)
    private _resizeObserver: ResizeObserver | null = null
    private _lastHostWidth = 0
    private _reconciling = false

    static get observedAttributes(): string[] {
        // `title` is a natively-reflected HTMLElement property — listed so
        // attributeChangedCallback fires, but read via getAttribute (no
        // getter/setter, per the porting recipe).
        return ['title', 'subtitle', 'height', 'show-grid', 'show-legend', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._attachResizeObserver()
    }

    disconnectedCallback(): void {
        this._detachResizeObserver()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // ---- JS properties ----

    get series(): LineChartSeries[] {
        return this._series
    }
    set series(v: LineChartSeries[]) {
        this._series = Array.isArray(v) ? v : []
        // resetting the dataset clears any stale legend toggles
        this._hidden.clear()
        if (this._initialised) this.render()
    }

    get xFormatter(): ((v: number | string) => string) | null {
        return this._xFormatter
    }
    set xFormatter(fn: ((v: number | string) => string) | null) {
        this._xFormatter = typeof fn === 'function' ? fn : null
        if (this._initialised) this.render()
    }

    get yFormatter(): ((v: number) => string) | null {
        return this._yFormatter
    }
    set yFormatter(fn: ((v: number) => string) | null) {
        this._yFormatter = typeof fn === 'function' ? fn : null
        if (this._initialised) this.render()
    }

    // ---- attribute-backed props ----

    get subtitle(): string {
        return this.getAttribute('subtitle') ?? ''
    }
    set subtitle(v: string) {
        setAttr(this, 'subtitle', v)
    }

    get height(): number {
        const v = parseInt(this.getAttribute('height') ?? '', 10)
        return v > 0 ? v : DEFAULT_HEIGHT
    }
    set height(v: number) {
        this.setAttribute('height', String(v))
    }

    // show-grid defaults to TRUE — grid renders unless explicitly "false".
    get showGrid(): boolean {
        return this.getAttribute('show-grid') !== 'false'
    }
    set showGrid(v: boolean) {
        if (v) this.removeAttribute('show-grid')
        else this.setAttribute('show-grid', 'false')
    }

    // show-legend defaults to TRUE.
    get showLegend(): boolean {
        return this.getAttribute('show-legend') !== 'false'
    }
    set showLegend(v: boolean) {
        if (v) this.removeAttribute('show-legend')
        else this.setAttribute('show-legend', 'false')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ---- helpers ----

    private _seriesColor(index: number, explicit?: string): string {
        return explicit ? explicit : `var(--bs-line-chart-series-${(index % PALETTE_SIZE) + 1})`
    }

    private _fmtY(v: number): string {
        return this._yFormatter ? this._yFormatter(v) : defaultYFmt(v)
    }

    private _fmtX(v: number | string): string {
        return this._xFormatter ? this._xFormatter(v) : String(v)
    }

    // ---- resize handling ----

    // Width the SVG should use for its viewBox: prefer the actual rendered SVG
    // box (so 1 user unit == 1 px and nothing is stretched/letterboxed), falling
    // back to the host width, then to 560 before the element has been laid out.
    private _measurePlot(): number {
        const svg = this.querySelector<SVGSVGElement>('.tc-line-chart-svg')
        if (svg) {
            const w = Math.round(svg.getBoundingClientRect().width)
            if (w > 0) return w
        }
        const hostW = Math.round(this.getBoundingClientRect().width)
        return hostW > 0 ? hostW : 560
    }

    private _attachResizeObserver(): void {
        if (this._resizeObserver) return
        this._resizeObserver = new ResizeObserver(() => {
            const w = Math.round(this.getBoundingClientRect().width)
            if (w > 0 && w !== this._lastHostWidth) {
                this._lastHostWidth = w
                if (this._initialised) this.render()
            }
        })
        this._resizeObserver.observe(this)
    }

    private _detachResizeObserver(): void {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect()
            this._resizeObserver = null
        }
    }

    // ---- render ----

    private render(): void {
        if (this.loading) {
            this._renderLoading()
            return
        }
        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const titleAttr = this.getAttribute('title')
        const subtitle = this.getAttribute('subtitle')
        const headerHtml =
            titleAttr || subtitle
                ? `<div class="tc-line-chart-header">` +
                  (titleAttr ? `<div class="tc-line-chart-title">${esc(titleAttr)}</div>` : '') +
                  (subtitle ? `<div class="tc-line-chart-subtitle">${esc(subtitle)}</div>` : '') +
                  `</div>`
                : ''

        const series = this._series
        if (!series.length) {
            patchHtml(
                this,
                `<div class="tc-line-chart-inner">${headerHtml}<div class="tc-line-chart-empty">${esc(msg('noData'))}</div></div>`,
            )
            this._anchors = []
            return
        }

        const VH = this.height
        const VW = this._measurePlot()
        const PL = 52,
            PR = 20,
            PT = 18,
            PB = 40
        const cW = VW - PL - PR
        const cH = VH - PT - PB
        this._vw = VW
        this._vh = VH

        // shared x domain = the union of every series' x values, in first-seen order
        const allX: string[] = []
        const seen = new Set<string>()
        series.forEach((s) =>
            seriesPoints(s).forEach((p) => {
                const key = String(p.x)
                if (!seen.has(key)) {
                    seen.add(key)
                    allX.push(key)
                }
            }),
        )

        // y domain across visible series only (toggled-off series don't scale it)
        const visibleY: number[] = []
        series.forEach((s, si) => {
            if (this._hidden.has(si)) return
            seriesPoints(s).forEach((p) => {
                if (typeof p.y === 'number' && !isNaN(p.y)) visibleY.push(p.y)
            })
        })
        const rawMax = visibleY.length ? Math.max(...visibleY) : 0
        const yMax = niceMax(rawMax * 1.05)

        const YTICKS = 5
        const yTicks = Array.from({ length: YTICKS + 1 }, (_, i) => (yMax / YTICKS) * i)

        const xPos = (xVal: number | string): number => {
            const idx = allX.indexOf(String(xVal))
            if (allX.length <= 1) return PL + cW / 2
            return PL + (idx / (allX.length - 1)) * cW
        }
        const yPos = (yVal: number): number => PT + cH - (yMax > 0 ? (yVal / yMax) * cH : 0)

        // --- grid + y tick labels ---
        let gridHtml = ''
        if (this.showGrid) {
            gridHtml += `<g class="tc-line-chart-grid">`
            yTicks.forEach((t) => {
                const y = yPos(t).toFixed(1)
                gridHtml += `<line class="tc-line-chart-gridline" x1="${PL}" y1="${y}" x2="${PL + cW}" y2="${y}" />`
            })
            // vertical hairlines at each x position
            allX.forEach((x) => {
                const xc = xPos(x).toFixed(1)
                gridHtml += `<line class="tc-line-chart-gridline tc-line-chart-gridline--v" x1="${xc}" y1="${PT}" x2="${xc}" y2="${(PT + cH).toFixed(1)}" />`
            })
            gridHtml += `</g>`
        }

        // y axis tick labels (always shown — they read the scale)
        let yLabelsHtml = ''
        yTicks.forEach((t) => {
            const y = (yPos(t) + 4).toFixed(1)
            yLabelsHtml += `<text class="tc-line-chart-axis-label tc-line-chart-axis-label--y" x="${PL - 8}" y="${y}" text-anchor="end">${esc(this._fmtY(t))}</text>`
        })

        // x axis tick labels (thinned so they never overlap)
        let xLabelsHtml = ''
        const skip = Math.max(1, Math.ceil(allX.length / 10))
        allX.forEach((x, i) => {
            if (i % skip !== 0 && i !== allX.length - 1) return
            const xc = xPos(x).toFixed(1)
            xLabelsHtml += `<text class="tc-line-chart-axis-label tc-line-chart-axis-label--x" x="${xc}" y="${(PT + cH + 18).toFixed(1)}" text-anchor="middle">${esc(this._fmtX(x))}</text>`
        })

        // axes
        const axesHtml =
            `<line class="tc-line-chart-axis" x1="${PL}" y1="${(PT + cH).toFixed(1)}" x2="${PL + cW}" y2="${(PT + cH).toFixed(1)}" />` +
            `<line class="tc-line-chart-axis tc-line-chart-axis--y" x1="${PL}" y1="${PT}" x2="${PL}" y2="${(PT + cH).toFixed(1)}" />`

        // --- series lines + point markers ---
        this._anchors = []
        let seriesHtml = ''
        const xSet = new Set(allX)
        series.forEach((s, si) => {
            if (this._hidden.has(si)) return
            const color = this._seriesColor(si, s.color)
            const pts = seriesPoints(s).filter(
                (p) => xSet.has(String(p.x)) && typeof p.y === 'number' && !isNaN(p.y),
            )
            if (!pts.length) return

            const d = pts
                .map(
                    (p, pi) =>
                        `${pi === 0 ? 'M' : 'L'} ${xPos(p.x).toFixed(1)} ${yPos(p.y).toFixed(1)}`,
                )
                .join(' ')

            let dotsHtml = ''
            pts.forEach((p) => {
                const cx = xPos(p.x)
                const cy = yPos(p.y)
                const ai = this._anchors.length
                this._anchors.push({ cx, cy, si, pi: seriesPoints(s).indexOf(p), color })
                dotsHtml += `<circle class="tc-line-chart-point" data-ai="${ai}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" style="--tc-line-color:${esc(color)}" />`
            })

            seriesHtml +=
                `<g class="tc-line-chart-series" style="--tc-line-color:${esc(color)}">` +
                `<path class="tc-line-chart-line" d="${d}" />` +
                dotsHtml +
                `</g>`
        })

        const summary = this._summary(series, allX.length)
        const svgHtml =
            `<svg class="tc-line-chart-svg" role="img" viewBox="0 0 ${VW} ${VH}" width="100%" height="${VH}" aria-label="${esc(summary)}">` +
            `<title>${esc(summary)}</title>` +
            gridHtml +
            axesHtml +
            yLabelsHtml +
            xLabelsHtml +
            seriesHtml +
            `</svg>`

        const tooltipHtml = `<div class="tc-line-chart-tooltip" role="status" aria-live="polite" hidden></div>`

        // --- legend (toggle buttons) ---
        let legendHtml = ''
        if (this.showLegend && series.length > 1) {
            legendHtml = `<div class="tc-line-chart-legend">`
            series.forEach((s, si) => {
                const color = this._seriesColor(si, s.color)
                const active = !this._hidden.has(si)
                legendHtml +=
                    `<button type="button" class="tc-line-chart-legend-item${active ? '' : ' tc-line-chart-legend-item--off'}" data-si="${si}" aria-pressed="${active}">` +
                    `<span class="tc-line-chart-legend-swatch" style="--tc-line-color:${esc(color)}" aria-hidden="true"></span>` +
                    `<span class="tc-line-chart-legend-label">${esc(seriesName(s, si))}</span>` +
                    `</button>`
            })
            legendHtml += `</div>`
        }

        patchHtml(
            this,
            `<div class="tc-line-chart-inner">` +
                headerHtml +
                `<div class="tc-line-chart-plot">${svgHtml}${tooltipHtml}</div>` +
                legendHtml +
                `</div>`,
        )

        const svg = this.querySelector<SVGSVGElement>('.tc-line-chart-svg')
        if (svg) {
            // If the freshly laid-out SVG is a different width than the value we
            // computed the viewBox from, re-render once so geometry maps 1:1 to
            // pixels (keeps axis fonts undistorted and tooltip mapping exact).
            const realW = Math.round(svg.getBoundingClientRect().width)
            if (!this._reconciling && realW > 0 && realW !== VW) {
                this._reconciling = true
                this.render()
                this._reconciling = false
                return
            }
            bindOnce(svg, 'pointermove', this._onPointerMove)
            bindOnce(svg, 'pointerleave', this._onPointerLeave)
        }
        const legend = this.querySelector<HTMLElement>('.tc-line-chart-legend')
        if (legend) bindOnce(legend, 'click', this._onLegendClick)
    }

    private _renderLoading(): void {
        this.setAttribute('role', 'status')
        this.setAttribute('aria-busy', 'true')
        const titleAttr = this.getAttribute('title')
        const headHtml = titleAttr
            ? `<div class="tc-line-chart-header"><div class="tc-line-chart-skeleton tc-line-chart-skeleton--title" aria-hidden="true"></div></div>`
            : ''
        patchHtml(
            this,
            `<div class="tc-line-chart-inner">` +
                headHtml +
                `<div class="tc-line-chart-skeleton tc-line-chart-skeleton--plot" aria-hidden="true" style="height:${this.height}px"></div>` +
                `<span class="visually-hidden">${esc(msg('loading'))}</span>` +
                `</div>`,
        )
    }

    private _summary(series: LineChartSeries[], xCount: number): string {
        const names = series
            .map((s, i) => seriesName(s, i))
            .slice(0, 8)
            .join(', ')
        const more = series.length > 8 ? ', …' : ''
        return `Line chart with ${series.length} series (${names}${more}) over ${xCount} point${xCount !== 1 ? 's' : ''}.`
    }

    // ---- hover ----

    // nearest anchor to the pointer, mapping client pixels back into user space
    private _nearestAnchor(e: PointerEvent): PointAnchor | null {
        if (!this._anchors.length) return null
        const svg = this.querySelector<SVGSVGElement>('.tc-line-chart-svg')
        if (!svg) return null
        const rect = svg.getBoundingClientRect()
        if (!rect.width || !rect.height) return null
        const ux = ((e.clientX - rect.left) / rect.width) * this._vw
        const uy = ((e.clientY - rect.top) / rect.height) * this._vh
        let best: PointAnchor | null = null
        let bestD = Infinity
        for (const a of this._anchors) {
            const dx = a.cx - ux
            const dy = a.cy - uy
            const d = dx * dx + dy * dy
            if (d < bestD) {
                bestD = d
                best = a
            }
        }
        // only surface when reasonably close (within ~40 user units)
        return bestD <= 40 * 40 ? best : null
    }

    private _onPointerMove = (e: PointerEvent): void => {
        const a = this._nearestAnchor(e)
        if (!a) {
            this._onPointerLeave()
            return
        }
        this._showTooltip(a)
    }

    private _onPointerLeave = (): void => {
        const tip = this.querySelector<HTMLElement>('.tc-line-chart-tooltip')
        if (tip) tip.hidden = true
        this.querySelectorAll('.tc-line-chart-point--active').forEach((el) =>
            el.classList.remove('tc-line-chart-point--active'),
        )
    }

    private _showTooltip(a: PointAnchor): void {
        const tip = this.querySelector<HTMLElement>('.tc-line-chart-tooltip')
        const s = this._series[a.si]
        if (!tip || !s) return
        const pts = seriesPoints(s)
        const point = pts[a.pi]
        if (!point) return

        // highlight the active marker
        this.querySelectorAll('.tc-line-chart-point--active').forEach((el) =>
            el.classList.remove('tc-line-chart-point--active'),
        )
        const idx = this._anchors.indexOf(a)
        const marker = this.querySelector(`.tc-line-chart-point[data-ai="${idx}"]`)
        if (marker) marker.classList.add('tc-line-chart-point--active')

        const xLabel = this._fmtX(point.x)
        const yLabel = this._fmtY(point.y)
        tip.setAttribute('aria-label', `${seriesName(s, a.si)}, ${xLabel}: ${yLabel}`)
        tip.style.setProperty('--tc-line-color', a.color)
        tip.innerHTML =
            `<span class="tc-line-chart-tooltip-x">${esc(xLabel)}</span>` +
            `<span class="tc-line-chart-tooltip-row">` +
            `<span class="tc-line-chart-tooltip-name">${esc(seriesName(s, a.si))}</span>` +
            `<span class="tc-line-chart-tooltip-value">${esc(yLabel)}</span>` +
            `</span>`

        const svg = this.querySelector<SVGSVGElement>('.tc-line-chart-svg')
        const rect = svg ? svg.getBoundingClientRect() : null
        const scaleX = rect && this._vw ? rect.width / this._vw : 1
        const scaleY = rect && this._vh ? rect.height / this._vh : 1
        // rebase to viewport coords (tooltip is position:fixed) by adding the
        // SVG's viewport origin, so it floats free of any clipping/stacking ancestor;
        // subtract the containing-block origin when a transformed/filtered ancestor
        // has hijacked `fixed` (see fixedOriginOffset).
        const o = fixedOriginOffset(this)
        tip.style.left = `${(rect ? rect.left : 0) + a.cx * scaleX - o.x}px`
        tip.style.top = `${(rect ? rect.top : 0) + a.cy * scaleY - o.y}px`
        tip.hidden = false

        this.dispatchEvent(
            new CustomEvent('tc-point-hover', {
                bubbles: true,
                composed: true,
                detail: { series: s, point } as LinePointHoverDetail,
            }),
        )
    }

    // ---- legend toggle ----

    private _onLegendClick = (e: Event): void => {
        const btn = (e.target as Element | null)?.closest<HTMLElement>('.tc-line-chart-legend-item')
        if (!btn) return
        const si = parseInt(btn.dataset.si ?? '', 10)
        if (isNaN(si) || si < 0 || si >= this._series.length) return
        // never let the user hide the last visible series
        if (!this._hidden.has(si) && this._hidden.size >= this._series.length - 1) return
        if (this._hidden.has(si)) this._hidden.delete(si)
        else this._hidden.add(si)
        this.render()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LineChart
    }
}

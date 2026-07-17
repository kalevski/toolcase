import { esc } from './internal/esc'
import { msg } from './messages'
import { fixedOriginOffset } from './internal/containingBlock'
const TAG_NAME = 'tc-area-chart'

// A single data point. `x` is categorical/ordinal (string or number); `y` is
// the numeric measure.
export interface AreaChartPoint {
    x: string | number
    y: number
}

// One series = a named array of points, optionally with an explicit color.
// `points` is the canonical field; `data` (the React `LineChartSeries` field)
// and `label` (its name field) are accepted as fallbacks so callers can pass
// react-components series objects unchanged.
export interface AreaChartSeries {
    name: string
    points: AreaChartPoint[]
    color?: string
    // react-components compatibility aliases
    label?: string
    data?: AreaChartPoint[]
}

export interface PointHoverDetail {
    series: AreaChartSeries
    point: AreaChartPoint
    index: number
}

// How many distinct slate/accent ramp slots the SCSS exposes as
// --bs-area-chart-series-N. Series cycle through these when no explicit color
// is given.
const PALETTE_SIZE = 6

// Stroke dash patterns keep series distinguishable beyond color alone (a11y).
// The first series is a solid line; the rest cycle through subtle dashes.
const DASHES = ['', '', '6 3', '2 3', '8 3 2 3', '1 4']

const DEFAULT_HEIGHT = 260

// Round a raw axis maximum up to a visually "nice" number (mirrors the React
// AreaChart niceMax).
function niceMax(v: number): number {
    if (v <= 0) return 10
    const e = Math.pow(10, Math.floor(Math.log10(v)))
    return Math.ceil(v / e) * e
}

interface PointGeom {
    sx: number
    sy: number
    seriesIndex: number
    pointIndex: number
}

export class AreaChart extends HTMLElement {
    private _initialised = false
    private _series: AreaChartSeries[] = []
    private _xFormatter: (v: string | number) => string = String
    private _yFormatter: (v: number) => string = (v) => String(v)
    private _resizeObserver: ResizeObserver | null = null
    // guards the single post-render width-reconciliation pass
    private _reconciling = false
    private _lastHostWidth = 0
    private _pointGeom: PointGeom[] = []
    // viewBox dimensions of the most recent render — used to map pointer
    // coordinates back into SVG user space on hover.
    private _vw = 0
    private _vh = 0
    // optional callback fired alongside the tc-point-hover event
    private _onPointHover: ((detail: PointHoverDetail) => void) | null = null

    static get observedAttributes(): string[] {
        // NB: `title` is a natively-reflected HTMLElement property — listed here
        // so attributeChangedCallback fires, but read via getAttribute (no
        // getter/setter, see the porting recipe).
        return ['title', 'subtitle', 'height', 'stacked', 'show-grid', 'show-legend', 'loading']
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

    get series(): AreaChartSeries[] {
        return this._series
    }
    set series(v: AreaChartSeries[]) {
        this._series = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get xFormatter(): (v: string | number) => string {
        return this._xFormatter
    }
    set xFormatter(fn: (v: string | number) => string) {
        this._xFormatter = typeof fn === 'function' ? fn : String
        if (this._initialised) this.render()
    }

    get yFormatter(): (v: number) => string {
        return this._yFormatter
    }
    set yFormatter(fn: (v: number) => string) {
        this._yFormatter = typeof fn === 'function' ? fn : (v) => String(v)
        if (this._initialised) this.render()
    }

    get onPointHover(): ((detail: PointHoverDetail) => void) | null {
        return this._onPointHover
    }
    set onPointHover(fn: ((detail: PointHoverDetail) => void) | null) {
        this._onPointHover = typeof fn === 'function' ? fn : null
    }

    // ---- attribute-backed props ----

    get subtitle(): string {
        return this.getAttribute('subtitle') ?? ''
    }
    set subtitle(v: string) {
        this.setAttribute('subtitle', v)
    }

    get height(): number {
        const v = parseInt(this.getAttribute('height') ?? '', 10)
        return v > 0 ? v : DEFAULT_HEIGHT
    }
    set height(v: number) {
        this.setAttribute('height', String(v))
    }

    get stacked(): boolean {
        return this.hasAttribute('stacked')
    }
    set stacked(v: boolean) {
        if (v) this.setAttribute('stacked', '')
        else this.removeAttribute('stacked')
    }

    // show-grid / show-legend default to TRUE — absence means on; only an
    // explicit show-grid="false" disables them.
    get showGrid(): boolean {
        return this.getAttribute('show-grid') !== 'false'
    }
    set showGrid(v: boolean) {
        this.setAttribute('show-grid', v ? 'true' : 'false')
    }

    get showLegend(): boolean {
        return this.getAttribute('show-legend') !== 'false'
    }
    set showLegend(v: boolean) {
        this.setAttribute('show-legend', v ? 'true' : 'false')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ---- resize handling ----

    // Width the SVG should use for its viewBox: prefer the actual rendered SVG
    // box (so 1 user unit == 1 px and nothing is stretched), falling back to the
    // host width, then to 560 before the element has been laid out.
    private _measurePlot(): number {
        const svg = this.querySelector<SVGSVGElement>('.tc-area-chart__svg')
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

    // ---- normalisation ----

    private _normSeries(): { name: string; color?: string; points: AreaChartPoint[] }[] {
        return this._series.map((s) => ({
            name: s.name ?? s.label ?? '',
            color: s.color,
            points: Array.isArray(s.points) ? s.points : Array.isArray(s.data) ? s.data : [],
        }))
    }

    private _seriesColorVar(index: number, explicit?: string): string {
        return explicit
            ? esc(explicit)
            : `var(--bs-area-chart-series-${(index % PALETTE_SIZE) + 1})`
    }

    // ---- render ----

    private render(): void {
        if (this.loading) {
            this._renderLoading()
            return
        }
        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const series = this._normSeries()
        const titleAttr = this.getAttribute('title')
        const subtitle = this.getAttribute('subtitle')
        const headerHtml =
            titleAttr || subtitle
                ? `<div class="tc-area-chart__header">` +
                  (titleAttr ? `<div class="tc-area-chart__title">${esc(titleAttr)}</div>` : '') +
                  (subtitle ? `<div class="tc-area-chart__subtitle">${esc(subtitle)}</div>` : '') +
                  `</div>`
                : ''

        if (!series.length || series.every((s) => !s.points.length)) {
            this.innerHTML = `<div class="tc-area-chart__inner">${headerHtml}<div class="tc-area-chart__empty">${esc(msg('noData'))}</div></div>`
            this._pointGeom = []
            return
        }

        const VH = this.height
        const VW = this._measurePlot()
        const PL = 52,
            PR = 20,
            PT = 18,
            PB = 40
        const cW = Math.max(VW - PL - PR, 10)
        const cH = Math.max(VH - PT - PB, 10)
        this._vw = VW
        this._vh = VH

        // Ordered union of x categories across every series.
        const allX: string[] = []
        const seen = new Set<string>()
        for (const s of series) {
            for (const p of s.points) {
                const xs = String(p.x)
                if (!seen.has(xs)) {
                    seen.add(xs)
                    allX.push(xs)
                }
            }
        }

        const stacked = this.stacked

        // Per-series value at each x (0 when missing) — needed for stacking and
        // for computing the axis maximum.
        const valueAt = series.map((s) => {
            const m = new Map<string, number>()
            for (const p of s.points) m.set(String(p.x), Number(p.y) || 0)
            return m
        })

        let yMaxRaw: number
        if (stacked) {
            yMaxRaw = 0
            for (const xs of allX) {
                let sum = 0
                for (const m of valueAt) sum += m.get(xs) ?? 0
                if (sum > yMaxRaw) yMaxRaw = sum
            }
        } else {
            yMaxRaw = 0
            for (const s of series)
                for (const p of s.points) {
                    const y = Number(p.y) || 0
                    if (y > yMaxRaw) yMaxRaw = y
                }
        }
        const yMax = niceMax(yMaxRaw * 1.1)

        const xPos = (xs: string): number => {
            const idx = allX.indexOf(xs)
            if (allX.length <= 1) return PL + cW / 2
            return PL + (idx / (allX.length - 1)) * cW
        }
        const yPos = (val: number): number => PT + cH - (val / yMax) * cH
        const baseline = PT + cH

        // --- grid + Y axis labels ---
        const YTICKS = 5
        let gridHtml = ''
        if (this.showGrid) {
            for (let i = 0; i <= YTICKS; i++) {
                const t = (yMax / YTICKS) * i
                const y = yPos(t)
                gridHtml += `<line class="tc-area-chart__grid" x1="${PL}" y1="${y.toFixed(1)}" x2="${(PL + cW).toFixed(1)}" y2="${y.toFixed(1)}" />`
                gridHtml += `<text class="tc-area-chart__y-label" x="${PL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${esc(this._yFormatter(t))}</text>`
            }
        }

        // --- X axis labels (thinned to ~10 max) ---
        let xLabelsHtml = ''
        const skip = Math.max(1, Math.ceil(allX.length / 10))
        allX.forEach((xs, i) => {
            if (i % skip !== 0 && i !== allX.length - 1) return
            const raw: string | number = xs
            xLabelsHtml += `<text class="tc-area-chart__x-label" x="${xPos(xs).toFixed(1)}" y="${(baseline + 18).toFixed(1)}" text-anchor="middle">${esc(this._xFormatter(raw))}</text>`
        })

        // --- axis lines ---
        const axesHtml =
            `<line class="tc-area-chart__axis" x1="${PL}" y1="${baseline.toFixed(1)}" x2="${(PL + cW).toFixed(1)}" y2="${baseline.toFixed(1)}" />` +
            `<line class="tc-area-chart__axis tc-area-chart__axis--faint" x1="${PL}" y1="${PT}" x2="${PL}" y2="${baseline.toFixed(1)}" />`

        // --- areas + lines + point geometry ---
        this._pointGeom = []
        const cumulative = new Map<string, number>()
        allX.forEach((xs) => cumulative.set(xs, 0))

        let areasHtml = ''
        let linesHtml = ''

        series.forEach((s, si) => {
            const colorVar = this._seriesColorVar(si, s.color)
            const dash = DASHES[si % DASHES.length]
            const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ''

            // The x's this series participates in. For stacked we walk every x
            // (missing → 0) so bands stack cleanly; for unstacked we follow only
            // the x's the series actually has, like the React AreaChart.
            const xsForSeries = stacked
                ? allX
                : s.points.map((p) => String(p.x)).filter((xs) => seen.has(xs))

            if (!xsForSeries.length) return

            const tops: { x: number; y: number; xs: string }[] = []
            const bottoms: { x: number; y: number }[] = []

            xsForSeries.forEach((xs) => {
                const val = valueAt[si].get(xs) ?? 0
                const bottomVal = stacked ? (cumulative.get(xs) ?? 0) : 0
                const topVal = bottomVal + val
                if (stacked) cumulative.set(xs, topVal)
                const px = xPos(xs)
                tops.push({ x: px, y: yPos(topVal), xs })
                bottoms.push({ x: px, y: yPos(bottomVal) })
            })

            // area path: along the tops, back along the bottoms (reversed)
            const topCmds = tops.map(
                (p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
            )
            const botCmds = [...bottoms]
                .reverse()
                .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            const areaD = [...topCmds, ...botCmds, 'Z'].join(' ')
            areasHtml += `<path class="tc-area-chart__area" style="--tc-series-color: ${colorVar}" d="${areaD}" />`

            // top stroke line
            const lineD = tops
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                .join(' ')
            linesHtml += `<path class="tc-area-chart__line" style="--tc-series-color: ${colorVar}" d="${lineD}"${dashAttr} fill="none" />`

            // record point geometry for hover nearest-point lookup, mapping back
            // to the original point objects of this series
            tops.forEach((p) => {
                const original = s.points.findIndex((pt) => String(pt.x) === p.xs)
                if (original >= 0) {
                    this._pointGeom.push({
                        sx: p.x,
                        sy: p.y,
                        seriesIndex: si,
                        pointIndex: original,
                    })
                }
            })
        })

        // dots on the top lines (visual anchors for the tooltip)
        let dotsHtml = ''
        this._pointGeom.forEach((g) => {
            const colorVar = this._seriesColorVar(g.seriesIndex, series[g.seriesIndex].color)
            dotsHtml += `<circle class="tc-area-chart__dot" style="--tc-series-color: ${colorVar}" cx="${g.sx.toFixed(1)}" cy="${g.sy.toFixed(1)}" r="3" />`
        })

        const summary = this._summary(series, allX, stacked)
        const svgHtml =
            `<svg class="tc-area-chart__svg" role="img" viewBox="0 0 ${VW} ${VH}" width="100%" height="${VH}" aria-label="${esc(summary)}">` +
            `<title>${esc(summary)}</title><desc>${esc(summary)}</desc>` +
            gridHtml +
            axesHtml +
            areasHtml +
            linesHtml +
            dotsHtml +
            xLabelsHtml +
            `</svg>`

        // legend
        let legendHtml = ''
        if (this.showLegend && series.length) {
            const chips = series
                .map((s, si) => {
                    const colorVar = this._seriesColorVar(si, s.color)
                    return `<span class="tc-area-chart__legend-chip"><span class="tc-area-chart__legend-dot" style="--tc-series-color: ${colorVar}"></span>${esc(s.name)}</span>`
                })
                .join('')
            legendHtml = `<div class="tc-area-chart__legend">${chips}</div>`
        }

        const tooltipHtml = `<div class="tc-area-chart__tooltip" role="status" aria-live="polite" hidden></div>`

        this.innerHTML = `<div class="tc-area-chart__inner">${headerHtml}<div class="tc-area-chart__plot">${svgHtml}${tooltipHtml}</div>${legendHtml}</div>`

        const svg = this.querySelector<SVGSVGElement>('.tc-area-chart__svg')
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
            svg.addEventListener('pointermove', this._onPointerMove)
            svg.addEventListener('pointerleave', this._onPointerLeave)
        }
    }

    private _renderLoading(): void {
        this.setAttribute('role', 'status')
        this.setAttribute('aria-busy', 'true')
        const titleAttr = this.getAttribute('title')
        const headHtml = titleAttr
            ? `<div class="tc-area-chart__header"><div class="tc-area-chart__skeleton tc-area-chart__skeleton--title" aria-hidden="true"></div></div>`
            : ''
        this.innerHTML =
            `<div class="tc-area-chart__inner">` +
            headHtml +
            `<div class="tc-area-chart__skeleton tc-area-chart__skeleton--plot" aria-hidden="true" style="height:${this.height}px"></div>` +
            `<span class="visually-hidden">${esc(msg('loading'))}</span>` +
            `</div>`
    }

    private _summary(
        series: { name: string; points: AreaChartPoint[] }[],
        allX: string[],
        stacked: boolean,
    ): string {
        const names = series
            .map((s) => s.name)
            .filter(Boolean)
            .join(', ')
        const kind = stacked ? 'Stacked area chart' : 'Area chart'
        const trend = series
            .map((s) => {
                if (s.points.length < 2) return ''
                const first = Number(s.points[0].y) || 0
                const last = Number(s.points[s.points.length - 1].y) || 0
                const dir = last > first ? 'rising' : last < first ? 'falling' : 'flat'
                return `${s.name} ${dir}`
            })
            .filter(Boolean)
            .join('; ')
        return `${kind} of ${series.length} series (${names}) across ${allX.length} points.${trend ? ` Trend: ${trend}.` : ''}`
    }

    // ---- hover ----

    private _onPointerMove = (e: PointerEvent): void => {
        if (!this._pointGeom.length) return
        const svg = e.currentTarget as SVGSVGElement
        const rect = svg.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return
        // map client coords → SVG user space (viewBox is 0 0 _vw _vh)
        const ux = ((e.clientX - rect.left) / rect.width) * this._vw
        const uy = ((e.clientY - rect.top) / rect.height) * this._vh

        let best: PointGeom | null = null
        let bestDist = Infinity
        for (const g of this._pointGeom) {
            const dx = g.sx - ux
            const dy = g.sy - uy
            const d = dx * dx + dy * dy
            if (d < bestDist) {
                bestDist = d
                best = g
            }
        }
        if (!best) return

        const series = this._series[best.seriesIndex]
        const points = Array.isArray(series.points) ? series.points : (series.data ?? [])
        const point = points[best.pointIndex]
        if (!point) return

        this._showTooltip(best, series, point)

        const detail: PointHoverDetail = { series, point, index: best.pointIndex }
        this.dispatchEvent(
            new CustomEvent('tc-point-hover', { bubbles: true, composed: true, detail }),
        )
        if (typeof this._onPointHover === 'function') this._onPointHover(detail)
    }

    private _onPointerLeave = (): void => {
        const tip = this.querySelector<HTMLElement>('.tc-area-chart__tooltip')
        if (tip) tip.hidden = true
    }

    private _showTooltip(
        g: PointGeom,
        series: { name: string; color?: string },
        point: AreaChartPoint,
    ): void {
        const tip = this.querySelector<HTMLElement>('.tc-area-chart__tooltip')
        if (!tip) return
        const colorVar = this._seriesColorVar(g.seriesIndex, series.color)
        const xText = esc(this._xFormatter(point.x))
        const yText = esc(this._yFormatter(Number(point.y) || 0))
        tip.style.setProperty('--tc-series-color', colorVar)
        tip.innerHTML =
            `<span class="tc-area-chart__tooltip-name">${esc(series.name)}</span>` +
            `<span class="tc-area-chart__tooltip-value">${xText} · ${yText}</span>`
        // position in plot pixels: the SVG fills the plot box, viewBox maps 1:1
        // to the rendered box, so scale user coords by the rendered/viewBox ratio
        const svg = this.querySelector<SVGSVGElement>('.tc-area-chart__svg')
        const rect = svg ? svg.getBoundingClientRect() : null
        const scaleX = rect && this._vw ? rect.width / this._vw : 1
        const scaleY = rect && this._vh ? rect.height / this._vh : 1
        // rebase to viewport coords (tooltip is position:fixed) by adding the
        // SVG's viewport origin, so it floats free of any clipping/stacking ancestor;
        // subtract the containing-block origin when a transformed/filtered ancestor
        // has hijacked `fixed` (see fixedOriginOffset).
        const o = fixedOriginOffset(this)
        tip.style.left = `${(rect ? rect.left : 0) + g.sx * scaleX - o.x}px`
        tip.style.top = `${(rect ? rect.top : 0) + g.sy * scaleY - o.y}px`
        tip.hidden = false
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AreaChart
    }
}

import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { msg } from './messages'
import { fixedOriginOffset } from './internal/containingBlock'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-bar-chart'

// One bar = a category label, a numeric value, and an optional explicit color.
export interface BarChartDataItem {
    label: string
    value: number
    color?: string
}

export type BarChartOrientation = 'vertical' | 'horizontal'
const ORIENTATIONS: BarChartOrientation[] = ['vertical', 'horizontal']

export interface BarClickDetail {
    item: BarChartDataItem
    index: number
}

// How many distinct slate/accent ramp slots the SCSS exposes as
// --bs-bar-chart-series-N. Bars cycle through these when no explicit color
// is given.
const PALETTE_SIZE = 6

const DEFAULT_HEIGHT = 260

// Round a raw axis maximum up to a visually "nice" number (mirrors the React
// BarChart niceMax).
function niceMax(v: number): number {
    if (v <= 0) return 10
    const e = Math.pow(10, Math.floor(Math.log10(v)))
    return Math.ceil(v / e) * e
}

// Tooltip anchor (in SVG user space) + the colour used for the left stripe.
interface BarAnchor {
    ax: number
    ay: number
    color: string
}

export class BarChart extends HTMLElement {
    private _initialised = false
    private _data: BarChartDataItem[] = []
    private _yFormatter: (v: number) => string = String
    private _resizeObserver: ResizeObserver | null = null
    // guards the single post-render width-reconciliation pass
    private _reconciling = false
    private _lastHostWidth = 0
    // viewBox dimensions of the most recent render — used to scale anchor
    // coordinates back into rendered pixels for tooltip positioning.
    private _vw = 0
    private _vh = 0
    // per-bar tooltip anchors, indexed by bar index
    private _anchors: BarAnchor[] = []
    // optional callback fired alongside the tc-bar-click event
    private _onClick: ((item: BarChartDataItem, index: number) => void) | null = null

    static get observedAttributes(): string[] {
        // NB: `title` is a natively-reflected HTMLElement property — listed here
        // so attributeChangedCallback fires, but read via getAttribute (no
        // getter/setter, see the porting recipe).
        return ['title', 'subtitle', 'orientation', 'height', 'show-values', 'loading']
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

    get data(): BarChartDataItem[] {
        return this._data
    }
    set data(v: BarChartDataItem[]) {
        this._data = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get yFormatter(): (v: number) => string {
        return this._yFormatter
    }
    set yFormatter(fn: (v: number) => string) {
        this._yFormatter = typeof fn === 'function' ? fn : String
        if (this._initialised) this.render()
    }

    get onClick(): ((item: BarChartDataItem, index: number) => void) | null {
        return this._onClick
    }
    set onClick(fn: ((item: BarChartDataItem, index: number) => void) | null) {
        this._onClick = typeof fn === 'function' ? fn : null
    }

    // ---- attribute-backed props ----

    get subtitle(): string {
        return this.getAttribute('subtitle') ?? ''
    }
    set subtitle(v: string) {
        setAttr(this, 'subtitle', v)
    }

    get orientation(): BarChartOrientation {
        const v = this.getAttribute('orientation') as BarChartOrientation
        return ORIENTATIONS.includes(v) ? v : 'vertical'
    }
    set orientation(v: BarChartOrientation) {
        setAttr(this, 'orientation', v)
    }

    get height(): number {
        const v = parseInt(this.getAttribute('height') ?? '', 10)
        return v > 0 ? v : DEFAULT_HEIGHT
    }
    set height(v: number) {
        this.setAttribute('height', String(v))
    }

    get showValues(): boolean {
        return this.hasAttribute('show-values')
    }
    set showValues(v: boolean) {
        if (v) this.setAttribute('show-values', '')
        else this.removeAttribute('show-values')
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
        const svg = this.querySelector<SVGSVGElement>('.tc-bar-chart__svg')
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

    private _barColor(index: number, explicit?: string): string {
        return explicit ? esc(explicit) : `var(--bs-bar-chart-series-${(index % PALETTE_SIZE) + 1})`
    }

    // ---- render ----

    private render(): void {
        if (this.loading) {
            this._renderLoading()
            return
        }
        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const data = this._data
        const titleAttr = this.getAttribute('title')
        const subtitle = this.getAttribute('subtitle')
        const headerHtml =
            titleAttr || subtitle
                ? `<div class="tc-bar-chart__header">` +
                  (titleAttr ? `<div class="tc-bar-chart__title">${esc(titleAttr)}</div>` : '') +
                  (subtitle ? `<div class="tc-bar-chart__subtitle">${esc(subtitle)}</div>` : '') +
                  `</div>`
                : ''

        if (!data.length) {
            patchHtml(
                this,
                `<div class="tc-bar-chart__inner">${headerHtml}<div class="tc-bar-chart__empty">${esc(msg('noData'))}</div></div>`,
            )
            this._anchors = []
            return
        }

        const VH = this.height
        const VW = this._measurePlot()
        const PL = 52,
            PR = 14,
            PT = 18,
            PB = 38
        const cW = Math.max(VW - PL - PR, 10)
        const cH = Math.max(VH - PT - PB, 10)
        this._vw = VW
        this._vh = VH

        const maxVal = niceMax(Math.max(...data.map((d) => Number(d.value) || 0)))
        const TICKS = 5
        const orientation = this.orientation
        const showValues = this.showValues
        const fmt = this._yFormatter

        this._anchors = []
        let gridHtml = ''
        let barsHtml = ''

        if (orientation === 'vertical') {
            const bGroup = cW / data.length
            const bW = bGroup * 0.65
            const bOff = bGroup * 0.175
            const baseline = PT + cH

            // gridlines + Y axis labels
            for (let i = 0; i <= TICKS; i++) {
                const t = (maxVal / TICKS) * i
                const y = baseline - (t / maxVal) * cH
                gridHtml += `<line class="tc-bar-chart__grid" x1="${PL}" y1="${y.toFixed(1)}" x2="${(PL + cW).toFixed(1)}" y2="${y.toFixed(1)}" />`
                gridHtml += `<text class="tc-bar-chart__axis-label" x="${PL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end">${esc(fmt(t))}</text>`
            }
            // baseline axis
            gridHtml += `<line class="tc-bar-chart__axis" x1="${PL}" y1="${baseline.toFixed(1)}" x2="${(PL + cW).toFixed(1)}" y2="${baseline.toFixed(1)}" />`

            data.forEach((d, i) => {
                const value = Number(d.value) || 0
                const bH = Math.max((value / maxVal) * cH, 0)
                const x = PL + i * bGroup + bOff
                const y = baseline - bH
                const cx = x + bW / 2
                const color = this._barColor(i, d.color)
                const valueText = esc(fmt(value))

                this._anchors[i] = { ax: cx, ay: y, color }

                barsHtml +=
                    `<g class="tc-bar-chart__bar" data-idx="${i}" role="button" tabindex="0" aria-label="${esc(`${d.label}: ${valueText}`)}" style="--tc-bar-color: ${color}">` +
                    // generous transparent hit/focus target spanning the whole column cell
                    `<rect class="tc-bar-chart__hit" x="${(PL + i * bGroup).toFixed(1)}" y="${PT}" width="${bGroup.toFixed(1)}" height="${cH.toFixed(1)}" />` +
                    `<rect class="tc-bar-chart__rect" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${bH.toFixed(1)}" />` +
                    (showValues
                        ? `<text class="tc-bar-chart__value" x="${cx.toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle">${valueText}</text>`
                        : '') +
                    `<text class="tc-bar-chart__cat-label" x="${cx.toFixed(1)}" y="${(baseline + 16).toFixed(1)}" text-anchor="middle">${esc(d.label)}</text>` +
                    `</g>`
            })
        } else {
            const bGroup = cH / data.length
            const bH = bGroup * 0.65
            const bOff = bGroup * 0.175

            // vertical gridlines + X axis labels
            for (let i = 0; i <= TICKS; i++) {
                const t = (maxVal / TICKS) * i
                const x = PL + (t / maxVal) * cW
                gridHtml += `<line class="tc-bar-chart__grid" x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${(PT + cH).toFixed(1)}" />`
                gridHtml += `<text class="tc-bar-chart__axis-label" x="${x.toFixed(1)}" y="${(PT + cH + 16).toFixed(1)}" text-anchor="middle">${esc(fmt(t))}</text>`
            }
            // value axis (left)
            gridHtml += `<line class="tc-bar-chart__axis" x1="${PL}" y1="${PT}" x2="${PL}" y2="${(PT + cH).toFixed(1)}" />`

            data.forEach((d, i) => {
                const value = Number(d.value) || 0
                const bW = Math.max((value / maxVal) * cW, 0)
                const y = PT + i * bGroup + bOff
                const cy = y + bH / 2
                const color = this._barColor(i, d.color)
                const valueText = esc(fmt(value))

                this._anchors[i] = { ax: PL + bW, ay: cy, color }

                barsHtml +=
                    `<g class="tc-bar-chart__bar" data-idx="${i}" role="button" tabindex="0" aria-label="${esc(`${d.label}: ${valueText}`)}" style="--tc-bar-color: ${color}">` +
                    // generous transparent hit/focus target spanning the whole row cell
                    `<rect class="tc-bar-chart__hit" x="${PL}" y="${(PT + i * bGroup).toFixed(1)}" width="${cW.toFixed(1)}" height="${bGroup.toFixed(1)}" />` +
                    `<rect class="tc-bar-chart__rect" x="${PL}" y="${y.toFixed(1)}" width="${bW.toFixed(1)}" height="${bH.toFixed(1)}" />` +
                    (showValues
                        ? `<text class="tc-bar-chart__value tc-bar-chart__value--h" x="${(PL + bW + 6).toFixed(1)}" y="${(cy + 4).toFixed(1)}">${valueText}</text>`
                        : '') +
                    `<text class="tc-bar-chart__cat-label" x="${(PL - 8).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="end">${esc(d.label)}</text>` +
                    `</g>`
            })
        }

        const summary = this._summary(data, orientation)
        const svgHtml =
            `<svg class="tc-bar-chart__svg" role="img" viewBox="0 0 ${VW} ${VH}" width="100%" height="${VH}" aria-label="${esc(summary)}">` +
            `<title>${esc(summary)}</title><desc>${esc(summary)}</desc>` +
            gridHtml +
            barsHtml +
            `</svg>`

        const tooltipHtml = `<div class="tc-bar-chart__tooltip" role="status" aria-live="polite" hidden></div>`

        patchHtml(
            this,
            `<div class="tc-bar-chart__inner">${headerHtml}<div class="tc-bar-chart__plot">${svgHtml}${tooltipHtml}</div></div>`,
        )

        const svg = this.querySelector<SVGSVGElement>('.tc-bar-chart__svg')
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
            bindOnce(svg, 'click', this._onBarActivate)
            bindOnce(svg, 'keydown', this._onBarKeydown)
        }
    }

    private _renderLoading(): void {
        this.setAttribute('role', 'status')
        this.setAttribute('aria-busy', 'true')
        const titleAttr = this.getAttribute('title')
        const headHtml = titleAttr
            ? `<div class="tc-bar-chart__header"><div class="tc-bar-chart__skeleton tc-bar-chart__skeleton--title" aria-hidden="true"></div></div>`
            : ''
        patchHtml(
            this,
            `<div class="tc-bar-chart__inner">` +
                headHtml +
                `<div class="tc-bar-chart__skeleton tc-bar-chart__skeleton--plot" aria-hidden="true" style="height:${this.height}px"></div>` +
                `<span class="visually-hidden">${esc(msg('loading'))}</span>` +
                `</div>`,
        )
    }

    private _summary(data: BarChartDataItem[], orientation: BarChartOrientation): string {
        const fmt = this._yFormatter
        const parts = data
            .slice(0, 12)
            .map((d) => `${d.label} ${fmt(Number(d.value) || 0)}`)
            .join(', ')
        const more = data.length > 12 ? `, …` : ''
        return `${orientation === 'horizontal' ? 'Horizontal bar' : 'Bar'} chart of ${data.length} items: ${parts}${more}.`
    }

    // ---- bar lookup helpers ----

    private _barIndexFromEvent(e: Event): number {
        const target = e.target as Element | null
        const g = target?.closest<SVGGElement>('.tc-bar-chart__bar')
        if (!g) return -1
        const idx = parseInt(g.getAttribute('data-idx') ?? '', 10)
        if (isNaN(idx) || idx < 0 || idx >= this._data.length) return -1
        return idx
    }

    // ---- hover ----

    private _onPointerMove = (e: PointerEvent): void => {
        const idx = this._barIndexFromEvent(e)
        if (idx < 0) {
            this._onPointerLeave()
            return
        }
        this._showTooltip(idx)
    }

    private _onPointerLeave = (): void => {
        const tip = this.querySelector<HTMLElement>('.tc-bar-chart__tooltip')
        if (tip) tip.hidden = true
    }

    private _showTooltip(idx: number): void {
        const tip = this.querySelector<HTMLElement>('.tc-bar-chart__tooltip')
        const anchor = this._anchors[idx]
        const item = this._data[idx]
        if (!tip || !anchor || !item) return
        const valueText = esc(this._yFormatter(Number(item.value) || 0))
        tip.style.setProperty('--tc-bar-color', anchor.color)
        tip.innerHTML =
            `<span class="tc-bar-chart__tooltip-name">${esc(item.label)}</span>` +
            `<span class="tc-bar-chart__tooltip-value">${valueText}</span>`
        // position in plot pixels: the SVG fills the plot box, viewBox maps 1:1
        // to the rendered box, so scale user coords by the rendered/viewBox ratio
        const svg = this.querySelector<SVGSVGElement>('.tc-bar-chart__svg')
        const rect = svg ? svg.getBoundingClientRect() : null
        const scaleX = rect && this._vw ? rect.width / this._vw : 1
        const scaleY = rect && this._vh ? rect.height / this._vh : 1
        // rebase to viewport coords (tooltip is position:fixed) by adding the
        // SVG's viewport origin, so it floats free of any clipping/stacking ancestor;
        // subtract the containing-block origin when a transformed/filtered ancestor
        // has hijacked `fixed` (see fixedOriginOffset).
        const o = fixedOriginOffset(this)
        tip.style.left = `${(rect ? rect.left : 0) + anchor.ax * scaleX - o.x}px`
        tip.style.top = `${(rect ? rect.top : 0) + anchor.ay * scaleY - o.y}px`
        tip.hidden = false
    }

    // ---- click / keyboard ----

    private _onBarActivate = (e: Event): void => {
        const idx = this._barIndexFromEvent(e)
        if (idx < 0) return
        const item = this._data[idx]
        this.dispatchEvent(
            new CustomEvent('tc-bar-click', {
                bubbles: true,
                composed: true,
                detail: { item, index: idx } as BarClickDetail,
            }),
        )
        if (typeof this._onClick === 'function') this._onClick(item, idx)
    }

    private _onBarKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
        const g = (e.target as Element | null)?.closest('.tc-bar-chart__bar')
        if (!g) return
        e.preventDefault()
        this._onBarActivate(e)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BarChart
    }
}

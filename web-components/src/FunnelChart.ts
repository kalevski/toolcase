import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { msg } from './messages'
import { fixedOriginOffset } from './internal/containingBlock'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-funnel-chart'

// One funnel step = a stage label, a numeric value, and an optional explicit colour.
export interface FunnelStep {
    label: string
    value: number
    color?: string
}

export interface FunnelSelectDetail {
    step: FunnelStep
    index: number
}

// How many distinct slate ramp slots the SCSS exposes as --bs-funnel-chart-series-N.
// Segments cycle through these when no explicit colour is given. All tones are kept
// in the darker half of the slate ramp so the white in-segment labels stay legible.
const PALETTE_SIZE = 6

const DEFAULT_HEIGHT = 320
// 1px gap between stacked trapezoids (design: hairline separation, not boxes).
const SEG_GAP = 1

// Tooltip anchor (in SVG user space) + the colour used for the left stripe.
interface FunnelAnchor {
    ax: number
    ay: number
    color: string
}

export class FunnelChart extends HTMLElement {
    private _initialised = false
    private _data: FunnelStep[] = []
    private _resizeObserver: ResizeObserver | null = null
    // guards the single post-render width-reconciliation pass
    private _reconciling = false
    private _lastHostWidth = 0
    // viewBox dimensions of the most recent render — used to scale anchor
    // coordinates back into rendered pixels for tooltip positioning.
    private _vw = 0
    private _vh = 0
    // per-segment tooltip anchors, indexed by step index
    private _anchors: FunnelAnchor[] = []
    // optional callback fired alongside the tc-select event
    private _onSelect: ((step: FunnelStep, index: number) => void) | null = null

    static get observedAttributes(): string[] {
        // NB: `title` is a natively-reflected HTMLElement property — listed here
        // so attributeChangedCallback fires, but read via getAttribute (no
        // getter/setter, see the porting recipe).
        return ['title', 'subtitle', 'height', 'show-labels', 'loading']
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

    get data(): FunnelStep[] {
        return this._data
    }
    set data(v: FunnelStep[]) {
        this._data = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get onSelect(): ((step: FunnelStep, index: number) => void) | null {
        return this._onSelect
    }
    set onSelect(fn: ((step: FunnelStep, index: number) => void) | null) {
        this._onSelect = typeof fn === 'function' ? fn : null
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

    // show-labels defaults to TRUE — labels render unless the attribute is
    // explicitly set to "false".
    get showLabels(): boolean {
        const raw = this.getAttribute('show-labels')
        return raw !== 'false'
    }
    set showLabels(v: boolean) {
        if (v) this.removeAttribute('show-labels')
        else this.setAttribute('show-labels', 'false')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ---- resize handling ----

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

    // Width the SVG should use for its viewBox: prefer the actual rendered SVG
    // box (so 1 user unit == 1 px and nothing is stretched), falling back to the
    // host width, then to 480 before the element has been laid out.
    private _measurePlot(): number {
        const svg = this.querySelector<SVGSVGElement>('.tc-funnel-chart__svg')
        if (svg) {
            const w = Math.round(svg.getBoundingClientRect().width)
            if (w > 0) return w
        }
        const hostW = Math.round(this.getBoundingClientRect().width)
        return hostW > 0 ? hostW : 480
    }

    // ---- normalisation ----

    private _segColor(index: number, explicit?: string): string {
        return explicit
            ? esc(explicit)
            : `var(--bs-funnel-chart-series-${(index % PALETTE_SIZE) + 1})`
    }

    private _percent(value: number): number {
        const ref = Number(this._data[0]?.value) || 0
        if (ref <= 0) return 0
        return Math.round((value / ref) * 100)
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
                ? `<div class="tc-funnel-chart__header">` +
                  (titleAttr ? `<div class="tc-funnel-chart__title">${esc(titleAttr)}</div>` : '') +
                  (subtitle
                      ? `<div class="tc-funnel-chart__subtitle">${esc(subtitle)}</div>`
                      : '') +
                  `</div>`
                : ''

        if (!data.length) {
            patchHtml(
                this,
                `<div class="tc-funnel-chart__inner">${headerHtml}<div class="tc-funnel-chart__empty">${esc(msg('noData'))}</div></div>`,
            )
            this._anchors = []
            return
        }

        const VH = this.height
        const VW = this._measurePlot()
        // padding keeps focus rings + tapered edges off the SVG border
        const PX = 8,
            PT = 6,
            PB = 6
        const maxW = Math.max(VW - PX * 2, 10)
        const cx = VW / 2
        const availH = Math.max(VH - PT - PB, 10)
        const n = data.length
        const segH = Math.max((availH - SEG_GAP * (n - 1)) / n, 1)
        this._vw = VW
        this._vh = VH

        const values = data.map((d) => Number(d.value) || 0)
        const maxVal = Math.max(...values, 0)
        const widthFor = (v: number): number => (maxVal > 0 ? (v / maxVal) * maxW : 0)

        const showLabels = this.showLabels
        this._anchors = []
        let segsHtml = ''

        data.forEach((step, i) => {
            const value = values[i]
            // top width follows this step; bottom width tapers to the next step
            // (the last segment keeps a straight bottom edge).
            const topW = widthFor(value)
            const botW = i < n - 1 ? widthFor(values[i + 1]) : topW
            const y = PT + i * (segH + SEG_GAP)
            const yBottom = y + segH
            const color = this._segColor(i, step.color)
            const pct = this._percent(value)

            const tlx = cx - topW / 2
            const trx = cx + topW / 2
            const blx = cx - botW / 2
            const brx = cx + botW / 2
            const points = [
                `${tlx.toFixed(1)},${y.toFixed(1)}`,
                `${trx.toFixed(1)},${y.toFixed(1)}`,
                `${brx.toFixed(1)},${yBottom.toFixed(1)}`,
                `${blx.toFixed(1)},${yBottom.toFixed(1)}`,
            ].join(' ')

            const midY = y + segH / 2
            this._anchors[i] = { ax: cx, ay: y, color }

            const labelsHtml = showLabels
                ? `<text class="tc-funnel-chart__label" x="${cx.toFixed(1)}" y="${(midY - 4).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(step.label)}</text>` +
                  `<text class="tc-funnel-chart__percent" x="${cx.toFixed(1)}" y="${(midY + 12).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${pct}%</text>`
                : ''

            const ariaName = esc(`${step.label}: ${value} (${pct}%)`)
            segsHtml +=
                `<g class="tc-funnel-chart__segment" data-idx="${i}" role="button" tabindex="0" aria-label="${ariaName}" style="--tc-funnel-color: ${color}">` +
                // generous transparent hit/focus target spanning the full row band
                `<rect class="tc-funnel-chart__hit" x="${PX}" y="${y.toFixed(1)}" width="${maxW.toFixed(1)}" height="${segH.toFixed(1)}" />` +
                `<polygon class="tc-funnel-chart__shape" points="${points}" />` +
                labelsHtml +
                `</g>`
        })

        const summary = this._summary(data)
        const svgHtml =
            `<svg class="tc-funnel-chart__svg" role="img" viewBox="0 0 ${VW} ${VH}" width="100%" height="${VH}" aria-label="${esc(summary)}">` +
            `<title>${esc(summary)}</title><desc>${esc(summary)}</desc>` +
            segsHtml +
            `</svg>`

        const tooltipHtml = `<div class="tc-funnel-chart__tooltip" role="status" aria-live="polite" hidden></div>`

        patchHtml(
            this,
            `<div class="tc-funnel-chart__inner">${headerHtml}<div class="tc-funnel-chart__plot">${svgHtml}${tooltipHtml}</div></div>`,
        )

        const svg = this.querySelector<SVGSVGElement>('.tc-funnel-chart__svg')
        if (svg) {
            // If the freshly laid-out SVG is a different width than the value we
            // computed the viewBox from, re-render once so geometry maps 1:1 to
            // pixels (keeps labels undistorted and tooltip mapping exact).
            const realW = Math.round(svg.getBoundingClientRect().width)
            if (!this._reconciling && realW > 0 && realW !== VW) {
                this._reconciling = true
                this.render()
                this._reconciling = false
                return
            }
            bindOnce(svg, 'pointermove', this._onPointerMove)
            bindOnce(svg, 'pointerleave', this._onPointerLeave)
            bindOnce(svg, 'click', this._onSegmentActivate)
            bindOnce(svg, 'keydown', this._onSegmentKeydown)
        }
    }

    private _renderLoading(): void {
        this.setAttribute('role', 'status')
        this.setAttribute('aria-busy', 'true')
        const titleAttr = this.getAttribute('title')
        const headHtml = titleAttr
            ? `<div class="tc-funnel-chart__header"><div class="tc-funnel-chart__skeleton tc-funnel-chart__skeleton--title" aria-hidden="true"></div></div>`
            : ''
        patchHtml(
            this,
            `<div class="tc-funnel-chart__inner">` +
                headHtml +
                `<div class="tc-funnel-chart__skeleton tc-funnel-chart__skeleton--plot" aria-hidden="true" style="height:${this.height}px"></div>` +
                `<span class="visually-hidden">${esc(msg('loading'))}</span>` +
                `</div>`,
        )
    }

    private _summary(data: FunnelStep[]): string {
        const parts = data
            .slice(0, 12)
            .map((d) => `${d.label} ${this._percent(Number(d.value) || 0)}%`)
            .join(', ')
        const more = data.length > 12 ? `, …` : ''
        return `Funnel chart of ${data.length} step${data.length !== 1 ? 's' : ''}: ${parts}${more}.`
    }

    // ---- segment lookup helpers ----

    private _segIndexFromEvent(e: Event): number {
        const target = e.target as Element | null
        const g = target?.closest<SVGGElement>('.tc-funnel-chart__segment')
        if (!g) return -1
        const idx = parseInt(g.getAttribute('data-idx') ?? '', 10)
        if (isNaN(idx) || idx < 0 || idx >= this._data.length) return -1
        return idx
    }

    // ---- hover ----

    private _onPointerMove = (e: PointerEvent): void => {
        const idx = this._segIndexFromEvent(e)
        if (idx < 0) {
            this._onPointerLeave()
            return
        }
        this._showTooltip(idx)
    }

    private _onPointerLeave = (): void => {
        const tip = this.querySelector<HTMLElement>('.tc-funnel-chart__tooltip')
        if (tip) tip.hidden = true
    }

    private _showTooltip(idx: number): void {
        const tip = this.querySelector<HTMLElement>('.tc-funnel-chart__tooltip')
        const anchor = this._anchors[idx]
        const step = this._data[idx]
        if (!tip || !anchor || !step) return
        const value = Number(step.value) || 0
        const pct = this._percent(value)
        // surface the same content via aria-label for assistive tech
        tip.setAttribute('aria-label', `${step.label}: ${value} (${pct}%)`)
        tip.style.setProperty('--tc-funnel-color', anchor.color)
        tip.innerHTML =
            `<span class="tc-funnel-chart__tooltip-name">${esc(step.label)}</span>` +
            `<span class="tc-funnel-chart__tooltip-value">${value.toLocaleString()} · ${pct}%</span>`
        // position in plot pixels: the SVG fills the plot box, viewBox maps 1:1
        // to the rendered box, so scale user coords by the rendered/viewBox ratio
        const svg = this.querySelector<SVGSVGElement>('.tc-funnel-chart__svg')
        const rect = svg ? svg.getBoundingClientRect() : null
        const scaleX = rect && this._vw ? rect.width / this._vw : 1
        const scaleY = rect && this._vh ? rect.height / this._vh : 1
        // tooltip is position:fixed — rebase svg-local pixels to the viewport so
        // it escapes overflow/stacking-context clipping (rect is viewport-relative);
        // subtract the containing-block origin when a transformed/filtered ancestor
        // has hijacked `fixed` (see fixedOriginOffset).
        const o = fixedOriginOffset(this)
        tip.style.left = `${(rect ? rect.left : 0) + anchor.ax * scaleX - o.x}px`
        tip.style.top = `${(rect ? rect.top : 0) + anchor.ay * scaleY - o.y}px`
        tip.hidden = false
    }

    // ---- click / keyboard ----

    private _onSegmentActivate = (e: Event): void => {
        const idx = this._segIndexFromEvent(e)
        if (idx < 0) return
        const step = this._data[idx]
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { step, index: idx } as FunnelSelectDetail,
            }),
        )
        if (typeof this._onSelect === 'function') this._onSelect(step, idx)
    }

    private _onSegmentKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
        const g = (e.target as Element | null)?.closest('.tc-funnel-chart__segment')
        if (!g) return
        e.preventDefault()
        this._onSegmentActivate(e)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FunnelChart
    }
}

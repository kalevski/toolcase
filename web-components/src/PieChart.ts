import { esc } from './internal/esc'
const TAG_NAME = 'tc-pie-chart'

// One slice = a label, a numeric value and an optional explicit colour. Mirrors
// the React PieChartSlice shape exactly so existing data drops in unchanged.
export interface PieChartSlice {
    label: string
    value: number
    color?: string
}

// detail of the optional tc-slice-select event
export interface PieSliceSelectDetail {
    slice: PieChartSlice
    index: number
}

const DEFAULT_HEIGHT = 320

// Default slice fills — a slate-leaning ramp (neutrals carry it, colour is data).
// Exposed as --bs-pie-chart-slice-N so themes can re-skin; an explicit per-slice
// `color` from the data is the one sanctioned override.
const PALETTE_SIZE = 8

// how far (in user units) an active slice is pulled out along its bisector
const PULL = 7

function polarToCart(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
}

function arcPath(
    cx: number,
    cy: number,
    r: number,
    ir: number,
    startAngle: number,
    endAngle: number,
    donut: boolean,
): string {
    const s = polarToCart(cx, cy, r, startAngle)
    const e = polarToCart(cx, cy, r, endAngle)
    const large = endAngle - startAngle > Math.PI ? 1 : 0

    if (donut) {
        const is = polarToCart(cx, cy, ir, startAngle)
        const ie = polarToCart(cx, cy, ir, endAngle)
        return [
            `M ${s.x.toFixed(2)} ${s.y.toFixed(2)}`,
            `A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`,
            `L ${ie.x.toFixed(2)} ${ie.y.toFixed(2)}`,
            `A ${ir} ${ir} 0 ${large} 0 ${is.x.toFixed(2)} ${is.y.toFixed(2)}`,
            'Z',
        ].join(' ')
    }
    return [
        `M ${cx} ${cy}`,
        `L ${s.x.toFixed(2)} ${s.y.toFixed(2)}`,
        `A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`,
        'Z',
    ].join(' ')
}

// A rendered slice, keyed by its ORIGINAL data index so toggling preserves colours.
interface SliceGeo {
    index: number
    label: string
    value: number
    color: string
    pct: number
    midAngle: number
}

export class PieChart extends HTMLElement {
    private _initialised = false
    private _data: PieChartSlice[] = []
    // slice indices the user has toggled off via the legend
    private _hidden = new Set<number>()
    // currently highlighted slice (hover), by ORIGINAL index
    private _active: number | null = null
    // per-render geometry of the visible slices + the square viewBox size
    private _geo: SliceGeo[] = []
    private _size = 0

    static get observedAttributes(): string[] {
        // `title` is a natively-reflected HTMLElement property — listed so
        // attributeChangedCallback fires, but read via getAttribute (no
        // getter/setter, per the porting recipe).
        return ['title', 'subtitle', 'donut', 'center-label', 'show-legend', 'height', 'loading']
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

    // ---- JS properties ----

    get data(): PieChartSlice[] {
        return this._data
    }
    set data(v: PieChartSlice[]) {
        this._data = Array.isArray(v) ? v : []
        // resetting the dataset clears any stale legend toggles + hover state
        this._hidden.clear()
        this._active = null
        if (this._initialised) this.render()
    }

    // ---- attribute-backed props ----

    get subtitle(): string {
        return this.getAttribute('subtitle') ?? ''
    }
    set subtitle(v: string) {
        this.setAttribute('subtitle', v)
    }

    get donut(): boolean {
        return this.hasAttribute('donut')
    }
    set donut(v: boolean) {
        if (v) this.setAttribute('donut', '')
        else this.removeAttribute('donut')
    }

    get centerLabel(): string {
        return this.getAttribute('center-label') ?? ''
    }
    set centerLabel(v: string) {
        this.setAttribute('center-label', v)
    }

    // show-legend defaults to TRUE — legend renders unless explicitly "false".
    get showLegend(): boolean {
        return this.getAttribute('show-legend') !== 'false'
    }
    set showLegend(v: boolean) {
        if (v) this.removeAttribute('show-legend')
        else this.setAttribute('show-legend', 'false')
    }

    get height(): number {
        const v = parseInt(this.getAttribute('height') ?? '', 10)
        return v > 0 ? v : DEFAULT_HEIGHT
    }
    set height(v: number) {
        this.setAttribute('height', String(v))
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ---- helpers ----

    private _sliceColor(index: number, explicit?: string): string {
        return explicit ? explicit : `var(--bs-pie-chart-slice-${(index % PALETTE_SIZE) + 1})`
    }

    private _prefersReducedMotion(): boolean {
        return (
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
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
                ? `<div class="tc-pie-chart-header">` +
                  (titleAttr ? `<div class="tc-pie-chart-title">${esc(titleAttr)}</div>` : '') +
                  (subtitle ? `<div class="tc-pie-chart-subtitle">${esc(subtitle)}</div>` : '') +
                  `</div>`
                : ''

        const data = this._data
        if (!data.length) {
            this.innerHTML = `<div class="tc-pie-chart-inner">${headerHtml}<div class="tc-pie-chart-empty">No data</div></div>`
            this._geo = []
            return
        }

        const donut = this.donut
        const size = Math.max(80, this.height)
        const cx = size / 2
        const cy = size / 2
        const r = size / 2 - PULL - 4
        const ir = donut ? r * 0.58 : 0
        this._size = size

        const fullTotal = data.reduce((s, d) => s + (d.value > 0 ? d.value : 0), 0)
        const visibleTotal = data.reduce(
            (s, d, i) => (!this._hidden.has(i) && d.value > 0 ? s + d.value : s),
            0,
        )

        // --- arc geometry for the visible slices (drawn from accumulated angles) ---
        this._geo = []
        let currentAngle = -Math.PI / 2
        let slicesHtml = ''
        data.forEach((d, i) => {
            if (this._hidden.has(i) || d.value <= 0) return
            const fraction = visibleTotal > 0 ? d.value / visibleTotal : 0
            const startAngle = currentAngle
            const endAngle = currentAngle + fraction * 2 * Math.PI
            currentAngle = endAngle
            const color = this._sliceColor(i, d.color)
            const pct = Math.round(fraction * 100)
            this._geo.push({
                index: i,
                label: d.label,
                value: d.value,
                color,
                pct,
                midAngle: (startAngle + endAngle) / 2,
            })

            const path = arcPath(cx, cy, r, ir, startAngle, endAngle, donut)
            slicesHtml +=
                `<path class="tc-pie-chart-slice" data-i="${i}" d="${path}"` +
                ` style="--tc-pie-color:${esc(color)}"` +
                ` aria-label="${esc(d.label)}: ${pct}%"></path>`
        })

        // donut hole + centred label
        let centerHtml = ''
        if (donut) {
            const centerLabel = this.getAttribute('center-label') ?? ''
            centerHtml =
                `<circle class="tc-pie-chart-hole" cx="${cx}" cy="${cy}" r="${(ir - 1).toFixed(2)}" />` +
                `<text class="tc-pie-chart-center-label" x="${cx}" y="${cy - 6}" text-anchor="middle">${esc(centerLabel)}</text>` +
                `<text class="tc-pie-chart-center-value" x="${cx}" y="${cy + 16}" text-anchor="middle">${esc(visibleTotal.toLocaleString())}</text>`
        }

        const summary = this._summary(data, fullTotal)
        const svgHtml =
            `<svg class="tc-pie-chart-svg" role="img" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-label="${esc(summary)}">` +
            `<title>${esc(summary)}</title>` +
            `<g class="tc-pie-chart-slices">${slicesHtml}</g>` +
            centerHtml +
            `</svg>`

        const tooltipHtml = `<div class="tc-pie-chart-tooltip" role="status" aria-live="polite" hidden></div>`

        // --- legend (toggle buttons — every slice, in original order) ---
        let legendHtml = ''
        if (this.showLegend) {
            legendHtml = `<ul class="tc-pie-chart-legend" role="list">`
            data.forEach((d, i) => {
                const color = this._sliceColor(i, d.color)
                const active = !this._hidden.has(i)
                // visible slices: share of the visible total; hidden: original share of the full dataset
                const pct = active
                    ? visibleTotal > 0
                        ? Math.round((d.value / visibleTotal) * 100)
                        : 0
                    : fullTotal > 0
                      ? Math.round((d.value / fullTotal) * 100)
                      : 0
                legendHtml +=
                    `<li class="tc-pie-chart-legend-row">` +
                    `<button type="button" class="tc-pie-chart-legend-item${active ? '' : ' tc-pie-chart-legend-item--off'}"` +
                    ` data-i="${i}" aria-pressed="${active}">` +
                    `<span class="tc-pie-chart-legend-swatch" style="--tc-pie-color:${esc(color)}" aria-hidden="true"></span>` +
                    `<span class="tc-pie-chart-legend-label">${esc(d.label)}</span>` +
                    `<span class="tc-pie-chart-legend-pct">${pct}%</span>` +
                    `</button>` +
                    `</li>`
            })
            legendHtml += `</ul>`
        }

        this.innerHTML =
            `<div class="tc-pie-chart-inner">` +
            headerHtml +
            `<div class="tc-pie-chart-body">` +
            `<div class="tc-pie-chart-plot">${svgHtml}${tooltipHtml}</div>` +
            legendHtml +
            `</div>` +
            `</div>`

        // post-render listeners (the fresh nodes get fresh handlers; old ones GC together)
        const slicesGroup = this.querySelector<SVGGElement>('.tc-pie-chart-slices')
        if (slicesGroup) {
            slicesGroup.addEventListener('pointermove', this._onSlicePointer)
            slicesGroup.addEventListener('pointerleave', this._onPointerLeave)
            slicesGroup.addEventListener('click', this._onSliceClick)
        }
        const legend = this.querySelector<HTMLElement>('.tc-pie-chart-legend')
        if (legend) {
            legend.addEventListener('pointerover', this._onLegendHover)
            legend.addEventListener('pointerleave', this._onPointerLeave)
            legend.addEventListener('click', this._onLegendClick)
        }

        // restore highlight if the active slice is still visible after a re-render
        if (this._active !== null && this._geo.some((g) => g.index === this._active)) {
            this._applyActive(this._active)
        } else {
            this._active = null
        }
    }

    private _renderLoading(): void {
        this.setAttribute('role', 'status')
        this.setAttribute('aria-busy', 'true')
        const titleAttr = this.getAttribute('title')
        const headHtml = titleAttr
            ? `<div class="tc-pie-chart-header"><div class="tc-pie-chart-skeleton tc-pie-chart-skeleton--title" aria-hidden="true"></div></div>`
            : ''
        const size = Math.max(80, this.height)
        this.innerHTML =
            `<div class="tc-pie-chart-inner">` +
            headHtml +
            `<div class="tc-pie-chart-body" aria-hidden="true">` +
            `<div class="tc-pie-chart-skeleton tc-pie-chart-skeleton--disc" style="width:${size}px;height:${size}px"></div>` +
            `<ul class="tc-pie-chart-legend">` +
            `<li class="tc-pie-chart-legend-row"><div class="tc-pie-chart-skeleton tc-pie-chart-skeleton--legend"></div></li>` +
            `<li class="tc-pie-chart-legend-row"><div class="tc-pie-chart-skeleton tc-pie-chart-skeleton--legend"></div></li>` +
            `<li class="tc-pie-chart-legend-row"><div class="tc-pie-chart-skeleton tc-pie-chart-skeleton--legend"></div></li>` +
            `</ul>` +
            `</div>` +
            `<span class="visually-hidden">Loading…</span>` +
            `</div>`
    }

    private _summary(data: PieChartSlice[], total: number): string {
        const kind = this.donut ? 'Donut' : 'Pie'
        const names = data
            .map((d) => d.label)
            .slice(0, 8)
            .join(', ')
        const more = data.length > 8 ? ', …' : ''
        return `${kind} chart with ${data.length} slice${data.length !== 1 ? 's' : ''} (${names}${more}), total ${total.toLocaleString()}.`
    }

    // ---- hover highlight + tooltip ----

    // Highlight a slice (and its legend row), pull it out, show the tooltip and —
    // for a donut — swap the centre label to the slice's label + percentage.
    private _applyActive(index: number): void {
        this._active = index
        const geo = this._geo.find((g) => g.index === index)

        const group = this.querySelector('.tc-pie-chart-slices')
        if (group) group.classList.add('tc-pie-chart-slices--has-active')

        const reduce = this._prefersReducedMotion()
        this.querySelectorAll<SVGPathElement>('.tc-pie-chart-slice').forEach((path) => {
            const pi = parseInt(path.dataset.i ?? '', 10)
            const isActive = pi === index
            path.classList.toggle('tc-pie-chart-slice--active', isActive)
            const g = this._geo.find((x) => x.index === pi)
            if (isActive && g && !reduce) {
                const dx = (Math.cos(g.midAngle) * PULL).toFixed(2)
                const dy = (Math.sin(g.midAngle) * PULL).toFixed(2)
                path.setAttribute('transform', `translate(${dx} ${dy})`)
            } else {
                path.removeAttribute('transform')
            }
        })

        this.querySelectorAll<HTMLElement>('.tc-pie-chart-legend-item').forEach((item) => {
            const pi = parseInt(item.dataset.i ?? '', 10)
            item.classList.toggle('tc-pie-chart-legend-item--active', pi === index)
        })

        if (!geo) return

        // donut centre label mirrors the active slice
        const centerLabel = this.querySelector<SVGTextElement>('.tc-pie-chart-center-label')
        const centerValue = this.querySelector<SVGTextElement>('.tc-pie-chart-center-value')
        if (centerLabel) centerLabel.textContent = geo.label
        if (centerValue) centerValue.textContent = `${geo.pct}%`

        this._showTooltip(geo)
    }

    private _clearActive(): void {
        this._active = null
        const group = this.querySelector('.tc-pie-chart-slices')
        if (group) group.classList.remove('tc-pie-chart-slices--has-active')
        this.querySelectorAll<SVGPathElement>('.tc-pie-chart-slice--active').forEach((p) => {
            p.classList.remove('tc-pie-chart-slice--active')
            p.removeAttribute('transform')
        })
        this.querySelectorAll('.tc-pie-chart-legend-item--active').forEach((el) =>
            el.classList.remove('tc-pie-chart-legend-item--active'),
        )

        // restore the donut centre to its resting label + total
        const centerLabel = this.querySelector<SVGTextElement>('.tc-pie-chart-center-label')
        const centerValue = this.querySelector<SVGTextElement>('.tc-pie-chart-center-value')
        if (centerLabel) centerLabel.textContent = this.getAttribute('center-label') ?? ''
        if (centerValue) {
            const visibleTotal = this._data.reduce(
                (s, d, i) => (!this._hidden.has(i) && d.value > 0 ? s + d.value : s),
                0,
            )
            centerValue.textContent = visibleTotal.toLocaleString()
        }

        const tip = this.querySelector<HTMLElement>('.tc-pie-chart-tooltip')
        if (tip) tip.hidden = true
    }

    private _showTooltip(geo: SliceGeo): void {
        const tip = this.querySelector<HTMLElement>('.tc-pie-chart-tooltip')
        const svg = this.querySelector<SVGSVGElement>('.tc-pie-chart-svg')
        if (!tip || !svg) return

        tip.style.setProperty('--tc-pie-color', geo.color)
        tip.setAttribute('aria-label', `${geo.label}: ${geo.value.toLocaleString()} (${geo.pct}%)`)
        tip.innerHTML =
            `<span class="tc-pie-chart-tooltip-label">${esc(geo.label)}</span>` +
            `<span class="tc-pie-chart-tooltip-row">` +
            `<span class="tc-pie-chart-tooltip-value">${esc(geo.value.toLocaleString())}</span>` +
            `<span class="tc-pie-chart-tooltip-pct">${geo.pct}%</span>` +
            `</span>`

        // position at the slice centroid, mapping user units → rendered pixels
        const rect = svg.getBoundingClientRect()
        const scale = rect.width && this._size ? rect.width / this._size : 1
        const cx = this._size / 2
        const cy = this._size / 2
        const tr = this._size / 2 - PULL - 4
        const cr = this.donut ? (tr + tr * 0.58) / 2 : tr * 0.6
        const px = (cx + Math.cos(geo.midAngle) * cr) * scale
        const py = (cy + Math.sin(geo.midAngle) * cr) * scale
        tip.style.left = `${px}px`
        tip.style.top = `${py}px`
        tip.hidden = false
    }

    private _sliceIndexFromEvent(e: Event): number | null {
        const path = (e.target as Element | null)?.closest<SVGPathElement>('.tc-pie-chart-slice')
        if (!path) return null
        const i = parseInt(path.dataset.i ?? '', 10)
        return isNaN(i) ? null : i
    }

    private _legendIndexFromEvent(e: Event): number | null {
        const btn = (e.target as Element | null)?.closest<HTMLElement>('.tc-pie-chart-legend-item')
        if (!btn) return null
        const i = parseInt(btn.dataset.i ?? '', 10)
        return isNaN(i) ? null : i
    }

    private _onSlicePointer = (e: Event): void => {
        const i = this._sliceIndexFromEvent(e)
        if (i === null) {
            this._clearActive()
            return
        }
        if (i !== this._active) this._applyActive(i)
    }

    private _onLegendHover = (e: Event): void => {
        const i = this._legendIndexFromEvent(e)
        // only highlight slices that are actually visible
        if (i === null || this._hidden.has(i)) return
        if (i !== this._active) this._applyActive(i)
    }

    private _onPointerLeave = (): void => {
        this._clearActive()
    }

    // ---- legend / slice toggle + select ----

    private _toggle(i: number): void {
        // never let the user hide the last visible slice
        if (!this._hidden.has(i) && this._hidden.size >= this._data.length - 1) return
        if (this._hidden.has(i)) this._hidden.delete(i)
        else this._hidden.add(i)
        this.render()
    }

    private _emitSelect(i: number): void {
        const slice = this._data[i]
        if (!slice) return
        this.dispatchEvent(
            new CustomEvent('tc-slice-select', {
                bubbles: true,
                composed: true,
                detail: { slice, index: i } as PieSliceSelectDetail,
            }),
        )
    }

    private _onLegendClick = (e: Event): void => {
        const i = this._legendIndexFromEvent(e)
        if (i === null) return
        this._emitSelect(i)
        this._toggle(i)
    }

    private _onSliceClick = (e: Event): void => {
        const i = this._sliceIndexFromEvent(e)
        if (i === null) return
        this._emitSelect(i)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PieChart
    }
}

import { esc } from './internal/esc'
import { msg } from './messages'
import { fixedOriginOffset } from './internal/containingBlock'
const TAG_NAME = 'tc-heatmap'

export interface HeatmapCell {
    row: string | number
    col: string | number
    value: number
    label?: string
}

// Default scale — slate→ink neutrals so the chart carries on the slate ramp by
// default (mirrors the --tc-slate-* token hex values). An explicit `colorScale`
// may bring colour; the neutrals are the sanctioned baseline.
const DEFAULT_SCALE = ['#f1f5f9', '#cbd5e1', '#94a3b8', '#475569', '#1e293b', '#0f172a']

const DEFAULT_CELL_SIZE = 32
const MIN_CELL_SIZE = 12

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return r ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) } : null
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

// Interpolate a colour across a multi-stop scale; t in [0,1].
function interpolateColor(scale: string[], t: number): string {
    if (scale.length === 0) return 'transparent'
    if (scale.length === 1) return scale[0]
    if (t <= 0) return scale[0]
    if (t >= 1) return scale[scale.length - 1]
    const seg = (scale.length - 1) * t
    const lo = Math.floor(seg)
    const hi = Math.ceil(seg)
    const f = seg - lo
    const c1 = hexToRgb(scale[lo])
    const c2 = hexToRgb(scale[hi])
    if (!c1 || !c2) return scale[lo]
    return `rgb(${Math.round(lerp(c1.r, c2.r, f))},${Math.round(lerp(c1.g, c2.g, f))},${Math.round(lerp(c1.b, c2.b, f))})`
}

export class Heatmap extends HTMLElement {
    private _initialised = false
    private _data: HeatmapCell[] = []
    private _rows: (string | number)[] = []
    private _cols: (string | number)[] = []
    private _colorScale: string[] | null = null
    // Lookup populated on every render so hover/event handlers can resolve cells.
    private _cellLookup = new Map<string, HeatmapCell>()

    static get observedAttributes(): string[] {
        return ['title', 'subtitle', 'cell-size', 'loading']
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

    // NOTE: `title` getter/setter intentionally omitted — HTMLElement already
    // reflects the `title` attribute natively; defining our own would collide.

    get subtitle(): string | null {
        return this.getAttribute('subtitle')
    }
    set subtitle(v: string | null) {
        if (v != null) this.setAttribute('subtitle', v)
        else this.removeAttribute('subtitle')
    }

    get cellSize(): number {
        const raw = parseInt(this.getAttribute('cell-size') ?? '', 10)
        return Number.isFinite(raw) ? Math.max(MIN_CELL_SIZE, raw) : DEFAULT_CELL_SIZE
    }
    set cellSize(v: number) {
        if (v != null) this.setAttribute('cell-size', String(v))
        else this.removeAttribute('cell-size')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get data(): HeatmapCell[] {
        return this._data
    }
    set data(v: HeatmapCell[]) {
        this._data = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get rows(): (string | number)[] {
        return this._rows
    }
    set rows(v: (string | number)[]) {
        this._rows = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get cols(): (string | number)[] {
        return this._cols
    }
    set cols(v: (string | number)[]) {
        this._cols = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get colorScale(): string[] | null {
        return this._colorScale
    }
    set colorScale(v: string[] | null) {
        this._colorScale = Array.isArray(v) && v.length > 0 ? v : null
        if (this._initialised) this.render()
    }

    private render(): void {
        const title = this.getAttribute('title')
        const subtitle = this.getAttribute('subtitle')
        const cellSize = this.cellSize
        const loading = this.loading

        // ── Loading skeleton ───────────────────────────────────────────────
        if (loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            const skelCols = this._cols.length || 8
            const skelRows = this._rows.length || 5
            const skelCells = Array.from({ length: skelCols * skelRows })
                .map(() => `<div class="tc-heatmap-skeleton-cell"></div>`)
                .join('')
            this.innerHTML =
                `<div class="tc-heatmap" aria-hidden="true">` +
                (title || subtitle
                    ? `<div class="tc-heatmap-header">` +
                      (title
                          ? `<div class="tc-heatmap-skeleton tc-heatmap-skeleton--title"></div>`
                          : '') +
                      `</div>`
                    : '') +
                `<div class="tc-heatmap-skeleton-grid" style="grid-template-columns: repeat(${skelCols}, ${cellSize}px); --bs-heatmap-cell-size: ${cellSize}px;">` +
                skelCells +
                `</div>` +
                `</div>` +
                `<span class="visually-hidden">${esc(msg('loading'))}</span>`
            return
        }

        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const rows = this._rows
        const cols = this._cols
        const scale = this._colorScale ?? DEFAULT_SCALE

        // Value domain across the dataset.
        const vals = this._data.map((d) => d.value).filter((v) => Number.isFinite(v))
        const minVal = vals.length ? Math.min(...vals) : 0
        const maxVal = vals.length ? Math.max(...vals) : 0
        const range = maxVal - minVal || 1

        // Cell lookup keyed by row::col, rebuilt every render.
        this._cellLookup = new Map(this._data.map((d) => [`${d.row}::${d.col}`, d]))

        // ── Header ─────────────────────────────────────────────────────────
        const headerHtml =
            title || subtitle
                ? `<div class="tc-heatmap-header">` +
                  (title ? `<div class="tc-heatmap-title">${esc(title)}</div>` : '') +
                  (subtitle ? `<div class="tc-heatmap-subtitle">${esc(subtitle)}</div>` : '') +
                  `</div>`
                : ''

        // ── Grid ───────────────────────────────────────────────────────────
        const summary = title || 'Heatmap'
        const colHeadCells = cols
            .map(
                (col) =>
                    `<div class="tc-heatmap-col-label" role="columnheader">${esc(String(col))}</div>`,
            )
            .join('')
        const headRow =
            `<div class="tc-heatmap-row tc-heatmap-row--head" role="row">` +
            `<div class="tc-heatmap-corner" role="columnheader" aria-hidden="true"></div>` +
            colHeadCells +
            `</div>`

        const bodyRows = rows
            .map((row) => {
                const cells = cols
                    .map((col) => {
                        const cell = this._cellLookup.get(`${row}::${col}`)
                        if (cell === undefined) {
                            return (
                                `<div class="tc-heatmap-cell tc-heatmap-cell--empty" role="cell"` +
                                ` aria-label="${esc(String(row))}, ${esc(String(col))}: no data"></div>`
                            )
                        }
                        const t = (cell.value - minVal) / range
                        const fill = interpolateColor(scale, t)
                        const labelPart = cell.label ? `, ${esc(cell.label)}` : ''
                        const aria = `${esc(String(row))}, ${esc(String(col))}: ${esc(String(cell.value))}${labelPart}`
                        return (
                            `<div class="tc-heatmap-cell" role="cell"` +
                            ` data-row="${esc(String(row))}" data-col="${esc(String(col))}"` +
                            ` style="background:${fill};"` +
                            ` aria-label="${aria}"></div>`
                        )
                    })
                    .join('')
                return (
                    `<div class="tc-heatmap-row" role="row">` +
                    `<div class="tc-heatmap-row-label" role="rowheader">${esc(String(row))}</div>` +
                    cells +
                    `</div>`
                )
            })
            .join('')

        const gridStyle =
            `grid-template-columns: minmax(0, auto) repeat(${cols.length}, ${cellSize}px);` +
            ` --bs-heatmap-cell-size: ${cellSize}px;`
        const gridHtml =
            `<div class="tc-heatmap-grid" role="table" aria-label="${esc(summary)}" style="${gridStyle}">` +
            headRow +
            bodyRows +
            `</div>`

        // ── Legend ─────────────────────────────────────────────────────────
        let legendHtml = ''
        if (vals.length) {
            const gradient = `linear-gradient(to right, ${scale.join(', ')})`
            legendHtml =
                `<div class="tc-heatmap-legend" aria-hidden="true">` +
                `<span class="tc-heatmap-legend-label">${esc(String(minVal))}</span>` +
                `<span class="tc-heatmap-legend-bar" style="background:${gradient};"></span>` +
                `<span class="tc-heatmap-legend-label">${esc(String(maxVal))}</span>` +
                `</div>`
        }

        this.innerHTML =
            `<div class="tc-heatmap">` +
            headerHtml +
            `<div class="tc-heatmap-scroll">` +
            gridHtml +
            `<div class="tc-heatmap-tooltip" role="tooltip" hidden></div>` +
            `</div>` +
            legendHtml +
            `</div>`

        this._attachGridListeners()
    }

    private _attachGridListeners(): void {
        const grid = this.querySelector<HTMLElement>('.tc-heatmap-grid')
        const scroll = this.querySelector<HTMLElement>('.tc-heatmap-scroll')
        const tooltip = this.querySelector<HTMLElement>('.tc-heatmap-tooltip')
        if (!grid || !scroll || !tooltip) return

        grid.addEventListener('mouseover', (e: MouseEvent) => {
            const cell = (e.target as HTMLElement).closest<HTMLElement>('.tc-heatmap-cell')
            if (!cell || cell.classList.contains('tc-heatmap-cell--empty')) return
            const row = cell.dataset.row ?? ''
            const col = cell.dataset.col ?? ''
            const data = this._cellLookup.get(`${row}::${col}`)
            if (!data) return

            const text = data.label
                ? `${data.label} · ${row} / ${col}: ${data.value}`
                : `${row} / ${col}: ${data.value}`
            tooltip.textContent = text
            tooltip.hidden = false

            // position: fixed tooltip lives in viewport space, so place it
            // centred above the cell using the cell's live viewport rect
            // directly. This escapes the scroll container's overflow-x clipping.
            // Subtract the containing-block origin when a transformed/filtered
            // ancestor has hijacked `fixed` (see fixedOriginOffset).
            const cellRect = cell.getBoundingClientRect()
            const o = fixedOriginOffset(this)
            tooltip.style.left = `${cellRect.left + cellRect.width / 2 - o.x}px`
            tooltip.style.top = `${cellRect.top - o.y}px`

            cell.classList.add('tc-heatmap-cell--active')

            this.dispatchEvent(
                new CustomEvent('tc-cell-hover', {
                    bubbles: true,
                    composed: true,
                    detail: { cell: data, row: data.row, col: data.col, value: data.value },
                }),
            )
        })

        grid.addEventListener('mouseout', (e: MouseEvent) => {
            const cell = (e.target as HTMLElement).closest<HTMLElement>('.tc-heatmap-cell')
            if (cell) cell.classList.remove('tc-heatmap-cell--active')
            const related = e.relatedTarget as Node | null
            if (!related || !grid.contains(related)) {
                tooltip.hidden = true
            }
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Heatmap
    }
}

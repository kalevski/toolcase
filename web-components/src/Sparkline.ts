import { esc } from './internal/esc'
const TAG_NAME = 'tc-sparkline'

export type SparklineType = 'line' | 'bar'

const TYPES: SparklineType[] = ['line', 'bar']

function parseIntAttr(raw: string | null, def: number): number {
    if (raw === null) return def
    const n = parseInt(raw, 10)
    return isNaN(n) ? def : n
}

export class Sparkline extends HTMLElement {
    private _initialised = false
    // null = fall back to the data attribute; set by the JS property setter
    private _data: number[] | null = null

    static get observedAttributes(): string[] {
        return ['data', 'type', 'color', 'height', 'width']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        // JS property takes precedence: ignore data-attribute changes once overridden
        if (name === 'data' && this._data !== null) return
        this.render()
    }

    get data(): number[] {
        if (this._data !== null) return this._data
        const raw = this.getAttribute('data')
        if (!raw) return []
        return raw
            .split(',')
            .map((s) => parseFloat(s.trim()))
            .filter((n) => !isNaN(n))
    }

    set data(v: number[] | string) {
        // React (and plain property assignment) may hand us the raw
        // comma-separated string once the element is upgraded — parse it the
        // same way the `data` attribute is parsed rather than discarding it.
        if (typeof v === 'string') {
            this._data = v
                .split(',')
                .map((s) => parseFloat(s.trim()))
                .filter((n) => !isNaN(n))
        } else {
            this._data = Array.isArray(v) ? v : []
        }
        if (this._initialised) this.render()
    }

    get type(): SparklineType {
        const v = this.getAttribute('type') as SparklineType
        return TYPES.includes(v) ? v : 'line'
    }
    set type(v: SparklineType) {
        this.setAttribute('type', v)
    }

    get color(): string | null {
        return this.getAttribute('color')
    }
    set color(v: string | null) {
        if (v != null) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get height(): number {
        return parseIntAttr(this.getAttribute('height'), 32)
    }
    set height(v: number) {
        this.setAttribute('height', String(v))
    }

    get width(): number {
        return parseIntAttr(this.getAttribute('width'), 120)
    }
    set width(v: number) {
        this.setAttribute('width', String(v))
    }

    private render(): void {
        const data = this.data
        const type = this.type
        const color = this.color
        const height = this.height
        const width = this.width

        if (color) {
            this.style.setProperty('--bs-sparkline-color', color)
        } else {
            this.style.removeProperty('--bs-sparkline-color')
        }

        const ariaLabel = this._ariaLabel(data)
        const inner =
            data.length === 0
                ? ''
                : type === 'bar'
                  ? this._buildBars(data, width, height)
                  : this._buildLine(data, width, height)

        this.innerHTML = `<svg class="tc-sparkline tc-sparkline--${type}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(ariaLabel)}">${inner}</svg>`
    }

    private _ariaLabel(data: number[]): string {
        if (data.length === 0) return 'Sparkline'
        if (data.length === 1) return `Sparkline: ${data[0]}`
        const first = data[0]
        const last = data[data.length - 1]
        const dir = last > first ? 'upward' : last < first ? 'downward' : 'flat'
        return `Trend from ${first} to ${last}, ${dir}`
    }

    private _buildLine(data: number[], width: number, height: number): string {
        const n = data.length
        const min = Math.min(...data)
        const max = Math.max(...data)
        const range = max - min
        // pad keeps the stroke/dot from being clipped at the SVG edge
        const pad = 3

        if (n === 1) {
            const cx = (width / 2).toFixed(1)
            const cy = (height / 2).toFixed(1)
            return `<circle class="tc-sparkline-dot" cx="${cx}" cy="${cy}" r="2.5" />`
        }

        const norm = (v: number): number => (range === 0 ? 0.5 : (v - min) / range)

        const pts = data.map((v, i) => {
            const x = pad + (i / (n - 1)) * (width - pad * 2)
            const y = pad + (1 - norm(v)) * (height - pad * 2)
            return `${x.toFixed(1)},${y.toFixed(1)}`
        })

        const lastX = (width - pad).toFixed(1)
        const lastY = (pad + (1 - norm(data[n - 1])) * (height - pad * 2)).toFixed(1)

        return `<polyline class="tc-sparkline-line" points="${pts.join(' ')}" /><circle class="tc-sparkline-dot" cx="${lastX}" cy="${lastY}" r="2.5" />`
    }

    private _buildBars(data: number[], width: number, height: number): string {
        const n = data.length
        const gap = Math.min(2, (width / n) * 0.15)
        const barW = Math.max(1, (width - gap * (n - 1)) / n)
        const maxVal = Math.max(...data, 0)
        const minVal = Math.min(...data, 0)
        const range = maxVal - minVal || 1

        return data
            .map((v, i) => {
                const x = i * (barW + gap)
                const norm = Math.max(0, (v - minVal) / range)
                const barH = Math.max(1, norm * height)
                const y = height - barH
                return `<rect class="tc-sparkline-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" />`
            })
            .join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Sparkline
    }
}

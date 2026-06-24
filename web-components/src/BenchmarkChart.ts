import { esc } from './internal/esc'
const TAG_NAME = 'tc-benchmark-chart'

export type BenchmarkScale = 'linear' | 'log'

const SCALES: BenchmarkScale[] = ['linear', 'log']

export interface BenchmarkBar {
    label: string
    value: number
    unit?: string
    color?: string
    hint?: string
    baseline?: boolean
}

// Unique id per instance so multiple charts don't collide on the SVG
// gradient referenced by url(#...).
let _idCounter = 0

// Mirrors the React BenchmarkChart formatValue: compact K/M, else grouped.
function formatValue(n: number): string {
    if (!isFinite(n)) return String(n)
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
}

export class BenchmarkChart extends HTMLElement {
    private _initialised = false
    private _bars: BenchmarkBar[] = []
    private _titleSlotNodes: Node[] = []
    private _gradientId = `tc-benchmark-chart-grad-${++_idCounter}`
    // optional callback fired (alongside the tc-bar-click event) when a row is clicked
    private _onBarClick: ((bar: BenchmarkBar, index: number) => void) | null = null

    static get observedAttributes(): string[] {
        // NB: `title` is a natively-reflected HTMLElement property — listed here so
        // attributeChangedCallback fires, but read via getAttribute (no getter/setter).
        return ['title', 'scale', 'lower-is-better', 'interactive']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // The chart owns its innerHTML, but rich `slot="title"` children must be
            // preserved across re-renders — capture them before the first render.
            this._titleSlotNodes = Array.from(this.querySelectorAll('[slot="title"]'))
            this.render()
            this._redistributeTitle()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._recaptureTitle()
        this.render()
        this._redistributeTitle()
    }

    get bars(): BenchmarkBar[] {
        return this._bars
    }
    set bars(v: BenchmarkBar[]) {
        this._bars = Array.isArray(v) ? v : []
        if (this._initialised) {
            this._recaptureTitle()
            this.render()
            this._redistributeTitle()
        }
    }

    get scale(): BenchmarkScale {
        const v = this.getAttribute('scale') as BenchmarkScale
        return SCALES.includes(v) ? v : 'linear'
    }
    set scale(v: BenchmarkScale) {
        this.setAttribute('scale', v)
    }

    get lowerIsBetter(): boolean {
        return this.hasAttribute('lower-is-better')
    }
    set lowerIsBetter(v: boolean) {
        if (v) this.setAttribute('lower-is-better', '')
        else this.removeAttribute('lower-is-better')
    }

    get interactive(): boolean {
        return this.hasAttribute('interactive')
    }
    set interactive(v: boolean) {
        if (v) this.setAttribute('interactive', '')
        else this.removeAttribute('interactive')
    }

    get onBarClick(): ((bar: BenchmarkBar, index: number) => void) | null {
        return this._onBarClick
    }
    set onBarClick(fn: ((bar: BenchmarkBar, index: number) => void) | null) {
        const wasInteractive = this._isInteractive
        this._onBarClick = typeof fn === 'function' ? fn : null
        // re-render only when the interactivity state actually flipped
        if (this._initialised && wasInteractive !== this._isInteractive) {
            this._recaptureTitle()
            this.render()
            this._redistributeTitle()
        }
    }

    // Rows become focusable buttons when explicitly interactive or when a click
    // callback is wired; otherwise the chart is purely presentational.
    private get _isInteractive(): boolean {
        return this.interactive || typeof this.onBarClick === 'function'
    }

    private _recaptureTitle(): void {
        const slotContainer = this.querySelector('.tc-benchmark-chart__title-slot')
        if (slotContainer) {
            this._titleSlotNodes = Array.from(slotContainer.querySelectorAll('[slot="title"]'))
        }
    }

    private _redistributeTitle(): void {
        if (this.hasAttribute('title')) return
        const slotContainer = this.querySelector('.tc-benchmark-chart__title-slot')
        if (slotContainer) this._titleSlotNodes.forEach((n) => slotContainer.appendChild(n))
    }

    // value/max → 0..1, log-guarded against non-positive values.
    private _ratio(value: number, max: number): number {
        if (this.scale === 'log') {
            const logVal = Math.log(Math.max(value, 1))
            const logMax = Math.log(Math.max(max, 1))
            return logMax > 0 ? logVal / logMax : 0
        }
        return max > 0 ? value / max : 0
    }

    private render(): void {
        const bars = this._bars
        const lowerIsBetter = this.lowerIsBetter
        const interactive = this._isInteractive

        const values = bars.map((b) => Number(b.value) || 0)
        const max = values.length ? Math.max(...values, 1) : 1
        let leaderIndex = -1
        if (values.length) {
            const target = lowerIsBetter ? Math.min(...values) : Math.max(...values)
            leaderIndex = values.findIndex((v) => v === target)
        }

        // ---- header (title attribute OR slot="title") ----
        const titleAttr = this.getAttribute('title')
        let headerHtml = ''
        if (titleAttr) {
            headerHtml = `<div class="tc-benchmark-chart__header"><h3 class="tc-benchmark-chart__title">${esc(titleAttr)}</h3></div>`
        } else if (this._titleSlotNodes.length > 0) {
            headerHtml = `<div class="tc-benchmark-chart__header"><div class="tc-benchmark-chart__title-slot"></div></div>`
        }

        // ---- chart body ----
        let bodyHtml: string
        if (bars.length === 0) {
            bodyHtml = `<div class="tc-benchmark-chart__empty">No benchmark data</div>`
        } else {
            const rowH = 40
            const barH = 12
            const trackX = 28 // %
            const trackW = 52 // %
            const totalH = rowH * bars.length

            const summary = this._summary(bars, leaderIndex, lowerIsBetter)
            // role=img summarises for AT when presentational; when interactive the rows
            // are individual buttons, so the SVG is a labelled group instead.
            const svgRole = interactive ? 'group' : 'img'

            const defs = `<defs><linearGradient id="${this._gradientId}" x1="0" y1="0" x2="1" y2="1"><stop class="tc-benchmark-chart__leader-stop tc-benchmark-chart__leader-stop--from" offset="0" /><stop class="tc-benchmark-chart__leader-stop tc-benchmark-chart__leader-stop--to" offset="1" /></linearGradient></defs>`

            const rows = bars
                .map((bar, i) => {
                    const value = Number(bar.value) || 0
                    const ratio = Math.max(0, Math.min(1, this._ratio(value, max)))
                    const fillW = (trackW * ratio).toFixed(2)
                    const isLeader = i === leaderIndex
                    const cy = i * rowH + rowH / 2
                    const barY = cy - barH / 2
                    const sepY = (i + 1) * rowH

                    const valueText = formatValue(value)
                    const unitText = bar.unit ? ` ${bar.unit}` : ''

                    const rowClasses = [
                        'tc-benchmark-chart__row',
                        isLeader ? 'tc-benchmark-chart__row--leader' : '',
                        bar.baseline ? 'tc-benchmark-chart__row--baseline' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')

                    const colorStyle = bar.color
                        ? ` style="--bs-benchmark-chart-bar-color: ${esc(bar.color)}"`
                        : ''

                    const interactiveAttrs = interactive
                        ? ` role="button" tabindex="0" aria-label="${esc(`${bar.label}: ${valueText}${unitText}${isLeader ? ', leader' : ''}`)}"`
                        : ''

                    const hintTitle = bar.hint ? `<title>${esc(bar.hint)}</title>` : ''

                    const fillClasses = [
                        'tc-benchmark-chart__fill',
                        isLeader ? 'tc-benchmark-chart__fill--leader' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')
                    // The leader fill is the gradient — set inline so it beats the base
                    // `.tc-benchmark-chart__fill { fill: var(...) }` rule. A colored leader
                    // keeps its own color (handled by the inherited bar-color var).
                    const fillAttr =
                        isLeader && !bar.color ? ` style="fill:url(#${this._gradientId})"` : ''

                    const sep =
                        i < bars.length - 1
                            ? `<line class="tc-benchmark-chart__sep" x1="0" y1="${sepY}" x2="100%" y2="${sepY}" />`
                            : ''

                    return (
                        `<g class="${rowClasses}" data-idx="${i}"${interactiveAttrs}${colorStyle}>` +
                        hintTitle +
                        `<rect class="tc-benchmark-chart__row-bg" x="0" y="${i * rowH}" width="100%" height="${rowH}" />` +
                        `<text class="tc-benchmark-chart__label" x="0" y="${cy}" dominant-baseline="central">${esc(bar.label)}</text>` +
                        `<rect class="tc-benchmark-chart__track" x="${trackX}%" y="${barY}" width="${trackW}%" height="${barH}" />` +
                        `<rect class="${fillClasses}" x="${trackX}%" y="${barY}" width="${fillW}%" height="${barH}"${fillAttr} />` +
                        `<text class="tc-benchmark-chart__value" x="100%" y="${cy}" text-anchor="end" dominant-baseline="central">${esc(valueText)}<tspan class="tc-benchmark-chart__unit">${esc(unitText)}</tspan></text>` +
                        sep +
                        `</g>`
                    )
                })
                .join('')

            // No viewBox: width="100%" makes the SVG viewport the container's pixel
            // width, so % coordinates resolve against real pixels and px font-sizes
            // stay undistorted. Heights/y are in px to match the totalH viewport.
            bodyHtml = `<svg class="tc-benchmark-chart__svg" role="${svgRole}" aria-label="${esc(summary)}" width="100%" height="${totalH}"><title>${esc(summary)}</title>${defs}${rows}</svg>`
        }

        const captionHtml = bars.length
            ? `<div class="tc-benchmark-chart__caption">${lowerIsBetter ? 'Lower is better' : 'Higher is better'}</div>`
            : ''

        this.innerHTML = `<div class="tc-benchmark-chart__inner">${headerHtml}${bodyHtml}${captionHtml}</div>`

        if (this._bars.length && this._isInteractive) {
            const svg = this.querySelector<SVGElement>('.tc-benchmark-chart__svg')
            if (svg) {
                svg.addEventListener('click', this._onRowActivate)
                svg.addEventListener('keydown', this._onRowKeydown)
            }
        }
    }

    private _summary(bars: BenchmarkBar[], leaderIndex: number, lowerIsBetter: boolean): string {
        const leader = leaderIndex >= 0 ? bars[leaderIndex] : null
        const dir = lowerIsBetter ? 'lower is better' : 'higher is better'
        if (!leader) return `Benchmark comparison of ${bars.length} items, ${dir}.`
        const v = formatValue(Number(leader.value) || 0)
        const unit = leader.unit ? ` ${leader.unit}` : ''
        return `Benchmark comparison of ${bars.length} items, ${dir}. Leader: ${leader.label} at ${v}${unit}.`
    }

    private _onRowActivate = (e: Event): void => {
        const target = e.target as Element | null
        const g = target?.closest<SVGGElement>('.tc-benchmark-chart__row')
        if (!g) return
        const idx = parseInt(g.getAttribute('data-idx') ?? '', 10)
        if (isNaN(idx) || idx < 0 || idx >= this._bars.length) return
        const bar = this._bars[idx]
        this.dispatchEvent(
            new CustomEvent('tc-bar-click', {
                bubbles: true,
                composed: true,
                detail: { bar, index: idx },
            }),
        )
        if (typeof this.onBarClick === 'function') this.onBarClick(bar, idx)
    }

    private _onRowKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
        const target = e.target as Element | null
        const g = target?.closest<SVGGElement>('.tc-benchmark-chart__row')
        if (!g) return
        e.preventDefault()
        this._onRowActivate(e)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BenchmarkChart
    }
}

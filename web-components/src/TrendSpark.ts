// tc-trend-spark — `1i`'s weight trend: an area sparkline with an end dot and two
// captions. A SHAPE, not a chart.
//
// TWO SPARK-ISH ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-sparkline     a 120x32 desktop micro-graphic: line or BAR, a 2.5px dot, a
//                    fixed pixel box, no fill, no captions. It sits inside a table
//                    cell or beside a KPI.
//   tc-trend-spark   this one. A 330x72 FLUID panel graphic: an area fill under the
//                    line, a 4px end dot, a caption row, and a domain you can clamp.
//
// AND IT IS NOT A CHART. No axes, no gridlines, no tooltips, no legend, no
// interaction, no library. The two captions carry the only two readings the design
// exposes („1 мај" / „денес · 68.0 кг"), because the point of the graphic is the
// SHAPE of the trend and the point of the text is the numbers. If a surface needs a
// readable value at every point, that is a chart — tc-line-chart / tc-area-chart
// exist, and a real charting layer is the honest answer beyond them.
//
// GEOMETRY IS VERBATIM FROM THE DESIGN, AND EVERY CONSTANT EARNS ITS PLACE
//   viewBox 0 0 330 72. The polyline runs x 4→326 and y 10→50; the area closes to
//   y=72. So: 4px of horizontal inset (the dot's radius — without it the last dot is
//   clipped by the viewBox edge), a 40px plot band starting 10px down, and 22px of
//   air below the lowest point so the fill reads as an AREA rather than as a thick
//   line. Those are the design's own numbers, not a derivation.
//
// preserveAspectRatio="none" AND non-scaling strokes
//   The design's box is fixed at 330x72 and the app's is not: inside a 14px gutter
//   and a card's 14px padding the available width is 334px at 390 and 264px at 320.
//   Left at the default (`xMidYMid meet`) the drawing would letterbox — scaled to
//   0.8 and floated in the middle of its 72px box with 7px of dead space top and
//   bottom. So the aspect ratio is released, and the two things that must not stretch
//   with it are pinned instead:
//     * the line carries `vector-effect="non-scaling-stroke"`, so 2.2px stays 2.2px
//       instead of becoming 1.76px horizontally and 2.2px vertically;
//     * the end dot is a ZERO-LENGTH PATH with a round cap and the same vector
//       effect, not a <circle>. A circle under a released aspect ratio is an ellipse
//       (r=4 → 3.2x4 at 320px). A zero-length subpath with `stroke-linecap: round`
//       renders a dot of exactly `stroke-width` diameter, in device pixels, at any
//       scale — so `stroke-width: 8` is the design's r=4.
//   The area fill needs neither: it has no stroke, and stretching a filled shape
//   horizontally is exactly what should happen to it.
//
// A FLAT SERIES DOES NOT RENDER AS A LINE PINNED TO THE TOP
//   Normalising a series whose min equals its max divides by zero; the naive fallback
//   („treat it as 1") puts a flat week at the very top of the band, which reads as „at
//   your ceiling" rather than „unchanged". A zero-range series is drawn through the
//   MIDDLE of the band. `min` / `max` exist for the other half of the same problem: a
//   68.0→67.9 kg week is a 0.1kg change that fills the band edge to edge and looks
//   like a cliff. Clamp the domain and it looks like what it is.

const TAG_NAME = 'tc-trend-spark'

/** The line, fill and dot colour. `accent` is the design's terracotta. */
export type TrendSparkTone = 'accent' | 'lead' | 'success' | 'info' | 'danger' | 'ink'
const TONES: TrendSparkTone[] = ['accent', 'lead', 'success', 'info', 'danger', 'ink']

// Verbatim from `1i` — see the header comment. Not tokens: they are one shape's
// internal proportions, and re-pointing any of them individually breaks the others.
const VB_W = 330
const VB_H = 72
const PAD_X = 4 // = the dot's radius, so the last point is not clipped
const PLOT_TOP = 10
const PLOT_BOTTOM = 50

function parseSeries(raw: string): number[] {
    return raw
        .split(/[\s,]+/)
        .filter((s) => s !== '')
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n))
}

export class TrendSpark extends HTMLElement {
    private _svg: SVGSVGElement | null = null
    private _built = false
    // null = fall back to the attribute; set by the JS property setter.
    private _points: number[] | null = null

    static get observedAttributes(): string[] {
        // `tone` is pure CSS state and is observed only so that
        // scripts/gen-react-types.mjs types it as a JSX prop — it reads this list.
        return ['max', 'min', 'no-dot', 'no-fill', 'points', 'spoken', 'tone']
    }

    connectedCallback(): void {
        this._render()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        if (name === 'tone') return
        // The JS property wins once written, the same contract tc-sparkline uses: a
        // React consumer that sets `.points` through a ref should not have it undone by
        // a stale attribute.
        if (name === 'points' && this._points !== null) return
        this._render()
    }

    /**
     * The series, oldest first. Accepts an array, or a comma/space-separated string so
     * the attribute form works in plain HTML and in JSX without a ref.
     */
    get points(): number[] {
        if (this._points !== null) return this._points
        const raw = this.getAttribute('points')
        return raw ? parseSeries(raw) : []
    }
    set points(v: number[] | string | null) {
        if (v == null) this._points = null
        else if (typeof v === 'string') this._points = parseSeries(v)
        else this._points = Array.isArray(v) ? v.filter((n) => Number.isFinite(n)) : []
        if (this.isConnected) this._render()
    }

    /** Domain floor. Absent ⇒ the series' own minimum. */
    get min(): number | null {
        const raw = this.getAttribute('min')
        if (raw === null) return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
    }
    set min(v: number | null) {
        if (v != null) this.setAttribute('min', String(v))
        else this.removeAttribute('min')
    }

    /** Domain ceiling. Absent ⇒ the series' own maximum. */
    get max(): number | null {
        const raw = this.getAttribute('max')
        if (raw === null) return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
    }
    set max(v: number | null) {
        if (v != null) this.setAttribute('max', String(v))
        else this.removeAttribute('max')
    }

    /**
     * Drop the end dot.
     *
     * NEGATED because a boolean attribute cannot default to true: `dot="false"` is
     * still a present attribute, and HTML has no way to say „absent means on". The
     * dot marks „you are here" and every instance in the design has one.
     */
    get noDot(): boolean {
        return this.hasAttribute('no-dot')
    }
    set noDot(v: boolean) {
        this.toggleAttribute('no-dot', v)
    }

    /**
     * Drop the area and leave the bare line. Negated for the same reason `no-dot` is:
     * the fill is on in every instance the design draws, because at 2.2px on cream a
     * line alone reads as a scratch rather than as a quantity.
     */
    get noFill(): boolean {
        return this.hasAttribute('no-fill')
    }
    set noFill(v: boolean) {
        this.toggleAttribute('no-fill', v)
    }

    get tone(): TrendSparkTone {
        const raw = this.getAttribute('tone') as TrendSparkTone
        return TONES.includes(raw) ? raw : 'accent'
    }
    set tone(v: TrendSparkTone) {
        this.setAttribute('tone', TONES.includes(v) ? v : 'accent')
    }

    /**
     * The graphic's accessible name, SPOKEN — „тежина: од 70.4 на 68.0 килограми".
     *
     * Absent ⇒ the SVG is `aria-hidden`, which is the RIGHT default here and not a
     * shortcut: the captions beside it are real text carrying the same two readings,
     * so an un-named graphic would make a screen reader announce „image" for something
     * whose content is already on the page. Set it where the shape says more than its
     * endpoints do.
     */
    get spoken(): string | null {
        return this.getAttribute('spoken')
    }
    set spoken(v: string | null) {
        if (v != null) this.setAttribute('spoken', v)
        else this.removeAttribute('spoken')
    }

    // ── Render ───────────────────────────────────────────────────────────────

    // The SVG element is created once; only its geometry attributes are patched, so a
    // series that ticks does not rebuild the subtree. The consumer's captions are the
    // HOST's children and are never touched — they are positioned by CSS off their
    // `slot` attribute, so nothing is re-parented and nothing can go stale under
    // react-dom (see the header comments in src/MobileShell.ts and src/AppBar.ts).
    private _render(): void {
        const svg = this._ensureSvg()
        if (!this._built || !svg.firstChild) {
            // Namespaced through innerHTML on an SVG element, which parses in the SVG
            // namespace — createElementNS per node would be six calls for no gain. No
            // interpolation here: every value is written with setAttribute below.
            svg.innerHTML =
                `<path class="tc-trend-spark-area" />` +
                `<polyline class="tc-trend-spark-line" fill="none"` +
                ` vector-effect="non-scaling-stroke" />` +
                `<path class="tc-trend-spark-dot" fill="none" stroke-linecap="round"` +
                ` vector-effect="non-scaling-stroke" />`
            this._built = true
        }

        const points = this.points
        const area = svg.querySelector('.tc-trend-spark-area')
        const line = svg.querySelector('.tc-trend-spark-line')
        const dot = svg.querySelector('.tc-trend-spark-dot')

        const coords = this._coords(points)
        // An empty series renders an empty box rather than nothing: the panel's height
        // stays put while the first measurement is being saved.
        line?.setAttribute('points', coords.map((p) => `${p[0]},${p[1]}`).join(' '))

        // A single point has no line to draw — just the dot that says where you are.
        const wantsArea = !this.noFill && coords.length > 1
        if (area) {
            if (wantsArea) {
                const d =
                    `M${coords[0][0]},${coords[0][1]}` +
                    coords
                        .slice(1)
                        .map((p) => `L${p[0]},${p[1]}`)
                        .join('') +
                    `L${coords[coords.length - 1][0]},${VB_H}L${coords[0][0]},${VB_H}Z`
                area.setAttribute('d', d)
            } else {
                area.removeAttribute('d')
            }
        }

        if (dot) {
            const last = coords[coords.length - 1]
            // A zero-length subpath (moveto + lineto to the same point) with a round cap
            // renders a dot of exactly `stroke-width` diameter — and, being a stroke, it
            // honours `vector-effect` where a <circle> cannot. See the header comment.
            if (last && !this.noDot)
                dot.setAttribute('d', `M${last[0]},${last[1]}L${last[0]},${last[1]}`)
            else dot.removeAttribute('d')
        }

        const spoken = this.spoken
        if (spoken) {
            svg.setAttribute('role', 'img')
            svg.setAttribute('aria-label', spoken)
            svg.removeAttribute('aria-hidden')
        } else {
            svg.removeAttribute('role')
            svg.removeAttribute('aria-label')
            svg.setAttribute('aria-hidden', 'true')
        }
    }

    /** Series → viewBox coordinates, rounded to 0.1 so the markup stays readable. */
    private _coords(points: number[]): Array<[string, string]> {
        const n = points.length
        if (n === 0) return []

        const authoredMin = this.min
        const authoredMax = this.max
        const lo = authoredMin ?? Math.min(...points)
        const hi = authoredMax ?? Math.max(...points)
        const range = hi - lo
        const band = PLOT_BOTTOM - PLOT_TOP

        const y = (v: number): number => {
            // A flat (or clamped-flat) series sits in the MIDDLE of the band — see the
            // header comment. Higher values sit HIGHER, so the normalised value is
            // subtracted from the band's bottom.
            if (range <= 0) return PLOT_TOP + band / 2
            const t = Math.max(0, Math.min(1, (v - lo) / range))
            return PLOT_BOTTOM - t * band
        }
        // One point is drawn at the right edge, where „now" is on every other series.
        const x = (i: number): number =>
            n === 1 ? VB_W - PAD_X : PAD_X + (i / (n - 1)) * (VB_W - PAD_X * 2)

        return points.map((v, i) => [x(i).toFixed(1), y(v).toFixed(1)])
    }

    // Created once and reused. Inserted FIRST so the graphic precedes its captions in
    // the DOM — visual order is CSS's job, reading order is the DOM's.
    private _ensureSvg(): SVGSVGElement {
        let svg = this._svg
        if (svg?.parentNode === this) return svg
        svg = this.querySelector<SVGSVGElement>(':scope > .tc-trend-spark-canvas')
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
            svg.setAttribute('class', 'tc-trend-spark-canvas')
            svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`)
            // Released deliberately — see the header comment.
            svg.setAttribute('preserveAspectRatio', 'none')
            this.insertBefore(svg, this.firstChild)
            this._built = false
        }
        this._svg = svg
        return svg
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TrendSpark
    }
}

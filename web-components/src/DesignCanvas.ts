import { setHostClass } from './internal/host-class'
import { num } from './internal/tc-element'

// tc-design-canvas — the pan-and-zoom viewport an artboard sits in.
//
// From `EditorStage`, which webgame.cloud and mindmap both ship: measure the
// viewport, work out the scale at which a fixed-size artboard FITS inside it, and
// multiply that by the reader's own zoom. Fit-then-zoom rather than a raw scale is
// the whole trick — "100%" then means "as large as this window allows", which is
// what a reader expects from a design tool and never what a raw CSS scale gives.
//
// THE SCALE IS PUBLISHED, NOT APPLIED. This element writes `--tc-canvas-scale`,
// `--tc-canvas-x` and `--tc-canvas-y` on itself and lets `tc-artboard` (or your
// own box) read them. That is deliberate: applying a transform would mean owning
// a wrapper around your children, and moving a node you did not create is what
// makes react-dom throw NotFoundError. Publishing a number moves nothing.
//
// The pointer contract, from the same two apps: SPACE or the middle button drags
// the canvas, ⌘/Ctrl + wheel zooms about the pointer, a plain wheel scrolls. A
// plain drag is left alone entirely — it belongs to whatever is on the artboard,
// and a canvas that steals it is a canvas you cannot select anything on.

const TAG_NAME = 'tc-design-canvas'

/** The zoom ladder. Steps rather than a continuous scale, so ⌘+ lands on the same
 *  values every time and "100%" is always reachable. */
const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8]

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value))

export class DesignCanvas extends HTMLElement {
    private _built = false
    private _observer: ResizeObserver | null = null
    private _fit = 0
    private _panning = false
    private _spaceHeld = false
    private _pointerId = -1
    private _startX = 0
    private _startY = 0
    private _originX = 0
    private _originY = 0

    static get observedAttributes(): string[] {
        return [
            'content-width',
            'content-height',
            'zoom',
            'pan-x',
            'pan-y',
            'min-zoom',
            'max-zoom',
            'class',
        ]
    }

    connectedCallback(): void {
        this._built = true
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')
        this.addEventListener('pointerdown', this._onPointerDown)
        this.addEventListener('pointermove', this._onPointerMove)
        this.addEventListener('pointerup', this._onPointerUp)
        this.addEventListener('pointercancel', this._onPointerUp)
        // Non-passive: `preventDefault()` on a ⌘+wheel is the only way to stop the
        // browser zooming the whole PAGE, which is never what a canvas wants.
        this.addEventListener('wheel', this._onWheel, { passive: false })
        this.addEventListener('keydown', this._onKeydown)
        this.addEventListener('keyup', this._onKeyup)
        // If the window loses focus while SPACE is physically held (alt-tab, a
        // devtools/dialog steal, ⌘-tab), the `keyup` that would clear it never
        // reaches this document — the canvas would otherwise stay stuck in
        // pan-mode (grab cursor, every drag hijacked) until the reader happens to
        // tap SPACE again. Losing focus is the same signal a browser uses to
        // cancel an in-flight pointer capture, so reset both here.
        window.addEventListener('blur', this._onWindowBlur)
        this._observe()
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('pointerdown', this._onPointerDown)
        this.removeEventListener('pointermove', this._onPointerMove)
        this.removeEventListener('pointerup', this._onPointerUp)
        this.removeEventListener('pointercancel', this._onPointerUp)
        this.removeEventListener('wheel', this._onWheel)
        this.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('keyup', this._onKeyup)
        window.removeEventListener('blur', this._onWindowBlur)
        this._observer?.disconnect()
        this._observer = null
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** The artboard's natural width in px. */
    get contentWidth(): number {
        return num(this.getAttribute('content-width'), 0)
    }
    set contentWidth(v: number) {
        this.setAttribute('content-width', String(v))
    }

    /** The artboard's natural height in px. */
    get contentHeight(): number {
        return num(this.getAttribute('content-height'), 0)
    }
    set contentHeight(v: number) {
        this.setAttribute('content-height', String(v))
    }

    /** The reader's zoom, multiplied by the fit. `1` is "fits the window". */
    get zoom(): number {
        return num(this.getAttribute('zoom'), 1)
    }
    set zoom(v: number) {
        this.setAttribute('zoom', String(clamp(v, this.minZoom, this.maxZoom)))
    }

    get minZoom(): number {
        return num(this.getAttribute('min-zoom'), 0.1)
    }
    set minZoom(v: number) {
        this.setAttribute('min-zoom', String(v))
    }

    get maxZoom(): number {
        return num(this.getAttribute('max-zoom'), 8)
    }
    set maxZoom(v: number) {
        this.setAttribute('max-zoom', String(v))
    }

    get panX(): number {
        return num(this.getAttribute('pan-x'), 0)
    }
    set panX(v: number) {
        this.setAttribute('pan-x', String(Math.round(v)))
    }

    get panY(): number {
        return num(this.getAttribute('pan-y'), 0)
    }
    set panY(v: number) {
        this.setAttribute('pan-y', String(Math.round(v)))
    }

    /** The scale at which the artboard exactly fills the viewport. Read-only —
     *  it is measured, not set. `0` until the element has been laid out. */
    get fit(): number {
        return this._fit
    }

    /** Fit and centre. What "zoom to fit" means, and the safe way back from a
     *  reader who has zoomed into a corner and lost the artboard. */
    fitToView(): void {
        this.zoom = 1
        this.panX = 0
        this.panY = 0
        this._emitZoom()
    }

    /** One step along the zoom ladder. `direction` is +1 in, -1 out. */
    stepZoom(direction: number): void {
        const current = this.zoom
        const ladder = ZOOM_STEPS.filter((s) => s >= this.minZoom && s <= this.maxZoom)
        const next =
            direction > 0
                ? (ladder.find((s) => s > current + 0.0001) ?? ladder[ladder.length - 1])
                : ([...ladder].reverse().find((s) => s < current - 0.0001) ?? ladder[0])
        this.zoom = next
        this._emitZoom()
    }

    private _observe(): void {
        if (this._observer || typeof ResizeObserver === 'undefined') return
        this._observer = new ResizeObserver((entries) => {
            const box = entries[0]?.contentRect
            if (!box || box.width <= 0 || box.height <= 0) return
            const width = this.contentWidth
            const height = this.contentHeight
            if (width <= 0 || height <= 0) return
            const next = Math.min(box.width / width, box.height / height)
            if (Math.abs(next - this._fit) < 0.0001) return
            this._fit = next
            this._publish()
            this._emitZoom()
        })
        this._observer.observe(this)
    }

    private patch(): void {
        setHostClass(this, 'tc-design-canvas')
        this._publish()
    }

    private _publish(): void {
        const scale = this._fit * this.zoom
        // The host centres the artboard's NATURAL (untransformed) box via CSS grid
        // (`place-items: center`) — layout never sees the transform. `tc-artboard`
        // then scales itself from its own top-left (`transform-origin: 0 0`), which
        // is what keeps its design coordinates meaning what they say. Those two
        // facts don't agree for free: scaling from a corner instead of the centre
        // walks the artboard away from the grid-centred position by half its
        // natural size times how far the scale is from 1. Fold that drift back in
        // here so `panX/panY` stay what they claim to be — the reader's OWN offset
        // from centred — instead of leaking a fit-dependent bias into every pan.
        const driftX = (this.contentWidth / 2) * (1 - scale)
        const driftY = (this.contentHeight / 2) * (1 - scale)
        this.style.setProperty('--tc-canvas-scale', String(scale || 0))
        this.style.setProperty('--tc-canvas-x', `${this.panX + driftX}px`)
        this.style.setProperty('--tc-canvas-y', `${this.panY + driftY}px`)
        this.style.setProperty('--tc-canvas-width', `${this.contentWidth}px`)
        this.style.setProperty('--tc-canvas-height', `${this.contentHeight}px`)
        this.setAttribute('data-panning', this._panning ? 'true' : 'false')
        this.setAttribute('data-pannable', this._spaceHeld ? 'true' : 'false')
    }

    private _emitZoom(): void {
        this.dispatchEvent(
            new CustomEvent('tc-zoom', {
                bubbles: true,
                composed: true,
                detail: { zoom: this.zoom, fit: this._fit, scale: this._fit * this.zoom },
            }),
        )
    }

    // ── Pan ──────────────────────────────────────────────────────────────────

    private _onPointerDown = (event: PointerEvent): void => {
        // Middle button, or SPACE held. A plain left drag belongs to whatever is on
        // the artboard — a canvas that claims it is a canvas you cannot select on.
        if (event.button !== 1 && !this._spaceHeld) return
        event.preventDefault()
        this._panning = true
        this._pointerId = event.pointerId
        this._startX = event.clientX
        this._startY = event.clientY
        this._originX = this.panX
        this._originY = this.panY
        this.setPointerCapture(event.pointerId)
        this._publish()
    }

    private _onPointerMove = (event: PointerEvent): void => {
        if (!this._panning || event.pointerId !== this._pointerId) return
        this.panX = this._originX + (event.clientX - this._startX)
        this.panY = this._originY + (event.clientY - this._startY)
        this._publish()
    }

    private _onPointerUp = (event: PointerEvent): void => {
        if (event.pointerId !== this._pointerId) return
        this._panning = false
        this._pointerId = -1
        if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId)
        this._publish()
    }

    // ── Zoom ─────────────────────────────────────────────────────────────────

    private _onWheel = (event: WheelEvent): void => {
        if (!event.ctrlKey && !event.metaKey) return
        event.preventDefault()
        const before = this.zoom
        // A trackpad reports fractional deltas; a mouse wheel reports ~100 per
        // notch. Sign is all that is needed for a stepped ladder.
        this.stepZoom(event.deltaY < 0 ? 1 : -1)
        const after = this.zoom
        if (after === before || this._fit === 0) return
        // Zoom ABOUT THE POINTER: keep the point under the cursor where it was, or
        // zooming into a corner walks the artboard off screen.
        const box = this.getBoundingClientRect()
        const cx = event.clientX - box.left - box.width / 2 - this.panX
        const cy = event.clientY - box.top - box.height / 2 - this.panY
        const ratio = after / before
        this.panX -= cx * (ratio - 1)
        this.panY -= cy * (ratio - 1)
        this._publish()
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        if (event.key === ' ' && !this._spaceHeld) {
            this._spaceHeld = true
            this._publish()
            // Only prevented while the canvas itself has focus: SPACE inside a panel
            // input is a space.
            if (event.target === this) event.preventDefault()
            return
        }
        if (!event.ctrlKey && !event.metaKey) return
        if (event.key === '=' || event.key === '+') {
            event.preventDefault()
            this.stepZoom(1)
        } else if (event.key === '-') {
            event.preventDefault()
            this.stepZoom(-1)
        } else if (event.key === '0') {
            event.preventDefault()
            this.fitToView()
        }
    }

    private _onKeyup = (event: KeyboardEvent): void => {
        if (event.key !== ' ') return
        this._spaceHeld = false
        this._publish()
    }

    private _onWindowBlur = (): void => {
        if (!this._spaceHeld && !this._panning) return
        this._spaceHeld = false
        this._panning = false
        this._pointerId = -1
        this._publish()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DesignCanvas
    }
}

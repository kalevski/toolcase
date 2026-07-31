import { cssLength } from './internal/cssLength'

const TAG_NAME = 'tc-physics-editor'

// ── Public type surface (mirrors @toolcase/react-components PhysicsEditor) ──────

export type PhysicsTool = 'select' | 'polygon' | 'circle' | 'box' | 'none'
const TOOLS: PhysicsTool[] = ['select', 'polygon', 'circle', 'box', 'none']

export interface PhysicsPoint {
    x: number
    y: number
}
export interface PolygonShape {
    type: 'polygon'
    points: PhysicsPoint[]
}
export interface CircleShape {
    type: 'circle'
    x: number
    y: number
    r: number
}
export interface BoxShape {
    type: 'box'
    x: number
    y: number
    w: number
    h: number
}
export type PhysicsShape = PolygonShape | CircleShape | BoxShape

// Any pixel with alpha strictly above the threshold counts as "opaque" for the
// auto-fit helper (default 1 → any non-fully-transparent pixel).
const DEFAULT_ALPHA_THRESHOLD = 1
// Pointer hit radius (CSS px) for vertex / handle grabbing.
const DEFAULT_HANDLE_HIT = 9
// Drawn handle size (CSS px).
const DEFAULT_HANDLE_SIZE = 8
// Smallest drawn extent (image coords) that counts as a real shape — anything
// smaller on pointer-up is discarded as an accidental click.
const DEFAULT_MIN_SIZE = 4
// Cap the resolution used to sample alpha for the auto-fit helper — a huge image
// would make the per-pixel scan slow.
const DEFAULT_MAX_ALPHA_DIM = 512
// Douglas-Peucker tolerance (alpha-raster px) for the auto-fit silhouette trace.
// Matches the @toolcase/react-components default `simplifyTolerance`.
const DEFAULT_SIMPLIFY_TOLERANCE = 1.5

let _idCounter = 0

// Box corners in draw order: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left.
function boxCorners(b: BoxShape): PhysicsPoint[] {
    return [
        { x: b.x, y: b.y },
        { x: b.x + b.w, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
    ]
}

const numAttr = (el: HTMLElement, name: string, def: number, min = -Infinity): number => {
    const v = parseFloat(el.getAttribute(name) ?? '')
    return Number.isFinite(v) ? Math.max(min, v) : def
}

/** A `[{ type, ... }]` JSON attribute → validated shape list. */
const parseShapesJson = (raw: string | null): PhysicsShape[] | null => {
    if (!raw) return null
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return null
    }
    if (!Array.isArray(parsed)) return null
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    const out: PhysicsShape[] = []
    for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue
        const s = entry as any
        if (s.type === 'polygon' && Array.isArray(s.points)) {
            const points = s.points
                .filter((p: any) => p && typeof p === 'object')
                .map((p: any) => ({ x: num(p.x), y: num(p.y) }))
            if (points.length >= 3) out.push({ type: 'polygon', points })
        } else if (s.type === 'circle') {
            out.push({ type: 'circle', x: num(s.x), y: num(s.y), r: num(s.r) })
        } else if (s.type === 'box') {
            out.push({ type: 'box', x: num(s.x), y: num(s.y), w: num(s.w), h: num(s.h) })
        }
    }
    return out
}

interface ViewTransform {
    scale: number
    offsetX: number
    offsetY: number
}

interface Palette {
    stroke: string
    fill: string
    selStroke: string
    selFill: string
    handleBg: string
    handleBorder: string
    preview: string
}

type DragKind = 'move' | 'vertex' | 'radius' | 'box-corner' | 'circle-new' | 'box-new' | null

interface HandleHit {
    kind: 'vertex' | 'radius' | 'center' | 'corner'
    index?: number
}

/**
 * Canvas-only physics shape editor: the element renders a single drawing canvas
 * and nothing else (no tool buttons, no undo/redo/delete/auto-fit chrome). The
 * active tool, geometry limits, handle sizes, snapping, history depth, and the
 * shapes model are all configured from the outside via attributes/properties;
 * the actions are exposed as imperative methods.
 */
export class PhysicsEditor extends HTMLElement {
    private _initialised = false
    private _idPrefix: string
    private _sourceInternal = false

    // Background source + raster info (for drawing and the alpha auto-fit helper).
    private _source: string | File | Blob | null = null
    private _img: HTMLImageElement | null = null
    private _natW = 0
    private _natH = 0
    private _alphaData: Uint8ClampedArray | null = null
    private _alphaW = 0
    private _alphaH = 0

    // Shapes model + undo/redo history (snapshots of the whole array).
    private _shapes: PhysicsShape[] = []
    private _selected = -1
    private _undo: PhysicsShape[][] = []
    private _redo: PhysicsShape[][] = []

    // In-progress polygon (click-to-add-vertex) + rubber-band cursor.
    private _pendingPolygon: PhysicsPoint[] | null = null
    private _pendingCursor: PhysicsPoint | null = null

    // View transform (image coords → canvas CSS px) recomputed each draw.
    private _view: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 }
    private _paletteCache: Palette | null = null
    private _raf: number | null = null
    private _resizeObserver: ResizeObserver | null = null

    // Drag state (a single gesture: move / edit handle / draw new shape).
    private _dragKind: DragKind = null
    private _dragIndex = -1
    private _dragVertex = -1
    private _dragCorner = -1
    private _dragStart: PhysicsPoint | null = null
    private _dragOrig: PhysicsShape | null = null
    private _dragBefore: PhysicsShape[] | null = null
    private _moveHandler: ((e: PointerEvent) => void) | null = null
    private _upHandler: (() => void) | null = null

    /** Optional callback mirroring the `tc-change` event. */
    onChange: ((shapes: PhysicsShape[]) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-pe-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return [
            'source',
            'shapes',
            'tool',
            // Canvas box
            'canvas-width',
            'canvas-height',
            'fit-parent',
            // Geometry / interaction limits
            'handle-size',
            'handle-hit',
            'min-size',
            'snap',
            'handles',
            'shortcuts',
            'history-limit',
            // Auto-fit helper
            'alpha-threshold',
            'simplify-tolerance',
            'max-alpha-dim',
            'auto-fit',
            'readonly',
            'disabled',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
            this._applyCanvasSize()
            const attrShapes = parseShapesJson(this.getAttribute('shapes'))
            if (attrShapes && this._shapes.length === 0) this._shapes = attrShapes
            const attrSource = this.getAttribute('source')
            if (this._source != null) this._loadSource(this._source)
            else if (attrSource) this._loadSource(attrSource)
            else this._scheduleDraw()
        }
        this._observeResize()
    }

    disconnectedCallback(): void {
        this._cleanupDrag()
        if (this._raf != null) {
            cancelAnimationFrame(this._raf)
            this._raf = null
        }
        if (this._resizeObserver) {
            this._resizeObserver.disconnect()
            this._resizeObserver = null
        }
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
        if (!this.isConnected || !this._initialised) return
        switch (name) {
            case 'source':
                if (this._sourceInternal) return
                this._source = value
                this._loadSource(value)
                break
            case 'shapes': {
                const next = parseShapesJson(value)
                if (next) this.shapes = next
                break
            }
            case 'tool':
                // Switching tools cancels an in-progress polygon.
                this._pendingPolygon = null
                this._pendingCursor = null
                this._scheduleDraw()
                break
            case 'handle-size':
            case 'handles':
            case 'min-size':
                this._scheduleDraw()
                break
            case 'canvas-width':
            case 'canvas-height':
            case 'fit-parent':
                this._applyCanvasSize()
                this._scheduleDraw()
                break
            case 'max-alpha-dim':
                // Re-sample the alpha raster at the new resolution cap.
                if (this._img) this._extractAlpha(this._img)
                break
            case 'history-limit':
                this._trimHistory()
                break
            case 'alpha-threshold':
            case 'simplify-tolerance':
                // Affects only the next auto-fit run; nothing to redraw.
                break
            case 'readonly':
            case 'disabled':
                this._updateDisabled()
                break
        }
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    get tool(): PhysicsTool {
        const v = this.getAttribute('tool') as PhysicsTool
        return TOOLS.includes(v) ? v : 'select'
    }
    set tool(v: PhysicsTool) {
        this.setAttribute('tool', v)
    }

    // ── Canvas box ────────────────────────────────────────────────────────────

    /** CSS width of the drawing canvas (bare numbers are px); `''` = stylesheet default. */
    get canvasWidth(): string {
        return this.getAttribute('canvas-width') ?? ''
    }
    set canvasWidth(v: string) {
        if (v) this.setAttribute('canvas-width', v)
        else this.removeAttribute('canvas-width')
    }

    /**
     * CSS height of the drawing canvas (bare numbers are px); `''` = stylesheet
     * default. Under `fit-parent` it acts as the minimum height instead.
     */
    get canvasHeight(): string {
        return this.getAttribute('canvas-height') ?? ''
    }
    set canvasHeight(v: string) {
        if (v) this.setAttribute('canvas-height', v)
        else this.removeAttribute('canvas-height')
    }

    /**
     * Stretch the element and its canvas to fill the parent box, so the stage
     * auto-scales with the layout instead of using a fixed canvas height. The
     * parent needs a definite height; `canvas-height` is the floor when it hasn't.
     */
    get fitParent(): boolean {
        return this.hasAttribute('fit-parent')
    }
    set fitParent(v: boolean) {
        if (v) this.setAttribute('fit-parent', '')
        else this.removeAttribute('fit-parent')
    }

    /** Mirrors the canvas-box attributes onto the --bs-* custom properties. */
    private _applyCanvasSize(): void {
        const w = cssLength(this.getAttribute('canvas-width'))
        if (w) this.style.setProperty('--bs-physics-editor-canvas-width', w)
        else this.style.removeProperty('--bs-physics-editor-canvas-width')
        const h = cssLength(this.getAttribute('canvas-height'))
        if (h) this.style.setProperty('--bs-physics-editor-canvas-height', h)
        else this.style.removeProperty('--bs-physics-editor-canvas-height')
    }

    /** Drawn handle size in CSS px. */
    get handleSize(): number {
        return numAttr(this, 'handle-size', DEFAULT_HANDLE_SIZE, 1)
    }
    set handleSize(v: number) {
        this.setAttribute('handle-size', String(v))
    }

    /** Pointer grab radius for vertices/handles, in CSS px. */
    get handleHit(): number {
        return numAttr(this, 'handle-hit', DEFAULT_HANDLE_HIT, 1)
    }
    set handleHit(v: number) {
        this.setAttribute('handle-hit', String(v))
    }

    /** Smallest accepted extent (image px) for a freshly drawn circle/box. */
    get minSize(): number {
        return numAttr(this, 'min-size', DEFAULT_MIN_SIZE, 0)
    }
    set minSize(v: number) {
        this.setAttribute('min-size', String(v))
    }

    /** Grid step (image px) that drawn/edited points snap to; `0` disables it. */
    get snap(): number {
        return numAttr(this, 'snap', 0, 0)
    }
    set snap(v: number) {
        this.setAttribute('snap', String(v))
    }

    /** `handles="off"` hides the vertex/resize handles and disables grabbing them. */
    get handles(): boolean {
        return this.getAttribute('handles') !== 'off'
    }
    set handles(v: boolean) {
        this.setAttribute('handles', v ? 'on' : 'off')
    }

    /** `shortcuts="off"` disables the undo/redo/delete/close keyboard bindings. */
    get shortcuts(): boolean {
        return this.getAttribute('shortcuts') !== 'off'
    }
    set shortcuts(v: boolean) {
        this.setAttribute('shortcuts', v ? 'on' : 'off')
    }

    /** Maximum undo snapshots kept; `0` = unlimited. */
    get historyLimit(): number {
        return Math.round(numAttr(this, 'history-limit', 0, 0))
    }
    set historyLimit(v: number) {
        this.setAttribute('history-limit', String(v))
    }

    get alphaThreshold(): number {
        const v = parseFloat(this.getAttribute('alpha-threshold') ?? '')
        if (!Number.isFinite(v)) return DEFAULT_ALPHA_THRESHOLD
        return Math.max(0, Math.min(255, v))
    }
    set alphaThreshold(v: number) {
        this.setAttribute('alpha-threshold', String(v))
    }

    /** Douglas-Peucker tolerance for the auto-fit silhouette trace. */
    get simplifyTolerance(): number {
        return numAttr(this, 'simplify-tolerance', DEFAULT_SIMPLIFY_TOLERANCE, 0)
    }
    set simplifyTolerance(v: number) {
        this.setAttribute('simplify-tolerance', String(v))
    }

    /** Resolution cap (longest edge) for the alpha raster used by `autoFit()`. */
    get maxAlphaDim(): number {
        return Math.max(1, Math.round(numAttr(this, 'max-alpha-dim', DEFAULT_MAX_ALPHA_DIM, 1)))
    }
    set maxAlphaDim(v: number) {
        this.setAttribute('max-alpha-dim', String(v))
    }

    /** Runs `autoFit()` once as soon as a source image finishes loading. */
    get autoFitOnLoad(): boolean {
        return this.hasAttribute('auto-fit')
    }
    set autoFitOnLoad(v: boolean) {
        if (v) this.setAttribute('auto-fit', '')
        else this.removeAttribute('auto-fit')
    }

    /** View-only: shapes render and stay selectable-free, without the dimmed look. */
    get readonly(): boolean {
        return this.hasAttribute('readonly')
    }
    set readonly(v: boolean) {
        if (v) this.setAttribute('readonly', '')
        else this.removeAttribute('readonly')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    /** No editing at all — `disabled`, `readonly`, or `tool="none"`. */
    private get _locked(): boolean {
        return this.disabled || this.readonly || this.tool === 'none'
    }

    // ── source (URL string | File | Blob) ───────────────────────────────────────

    get source(): string | File | Blob | null {
        return this._source ?? this.getAttribute('source')
    }
    set source(v: string | File | Blob | null) {
        this._source = v ?? null
        this._sourceInternal = true
        if (typeof v === 'string') this.setAttribute('source', v)
        else this.removeAttribute('source')
        this._sourceInternal = false
        if (this._initialised) this._loadSource(this._source)
    }

    // ── shapes (JS property; also settable as a JSON attribute) ──────────────────

    get shapes(): PhysicsShape[] {
        return this._clone(this._shapes)
    }
    set shapes(v: PhysicsShape[]) {
        this._shapes = Array.isArray(v) ? this._clone(v) : []
        // Programmatic replacement resets selection + history; no change event.
        this._selected = -1
        this._undo = []
        this._redo = []
        this._pendingPolygon = null
        this._pendingCursor = null
        if (this._initialised) this._scheduleDraw()
    }

    /** Index of the selected shape, or `-1`. */
    get selectedIndex(): number {
        return this._selected
    }
    set selectedIndex(v: number) {
        const idx = Number.isFinite(v) && v >= 0 && v < this._shapes.length ? Math.floor(v) : -1
        this._setSelected(idx)
    }

    get canUndo(): boolean {
        return this._undo.length > 0
    }

    get canRedo(): boolean {
        return this._redo.length > 0
    }

    /** Whether `autoFit()` has an alpha raster to trace. */
    get canAutoFit(): boolean {
        return this._alphaData != null && this._natW > 0
    }

    // ── Public actions ───────────────────────────────────────────────────────────

    undo(): void {
        if (this.disabled || this._undo.length === 0) return
        this._redo.push(this._clone(this._shapes))
        this._shapes = this._undo.pop()!
        this._clampSelection()
        this._pendingPolygon = null
        this._emitChange()
        this._announce('Undo')
        this._scheduleDraw()
    }

    redo(): void {
        if (this.disabled || this._redo.length === 0) return
        this._undo.push(this._clone(this._shapes))
        this._shapes = this._redo.pop()!
        this._clampSelection()
        this._pendingPolygon = null
        this._emitChange()
        this._announce('Redo')
        this._scheduleDraw()
    }

    deleteSelected(): void {
        if (this.disabled || this._selected < 0) return
        const idx = this._selected
        this._mutate(() => {
            const next = this._clone(this._shapes)
            next.splice(idx, 1)
            return next
        })
        this._setSelected(-1)
        this._announce('Shape deleted')
    }

    /** Removes every shape (undoable). */
    clear(): void {
        if (this.disabled || this._shapes.length === 0) return
        this._mutate(() => [])
        this._setSelected(-1)
        this._announce('All shapes cleared')
    }

    /** Drops an in-progress polygon without committing it. */
    cancelDrawing(): void {
        if (!this._pendingPolygon) return
        this._pendingPolygon = null
        this._pendingCursor = null
        this._announce('Polygon cancelled')
        this._scheduleDraw()
    }

    /**
     * Auto-fit: trace the sprite's non-transparent silhouette into a polygon that
     * hugs the actual image edges (ported from @toolcase/react-components
     * PhysicsEditor `autoTrace`). Pipeline: alpha mask → Moore-neighbor contour
     * follow → Douglas-Peucker simplify, then map the pixel-space ring back into
     * source (natural-image) coordinates — the same space shapes are stored in.
     */
    autoFit(): void {
        if (this.disabled) return
        if (!this._alphaData || this._natW === 0) {
            this._announce('No image to auto-fit')
            return
        }
        const w = this._alphaW
        const h = this._alphaH
        const thr = this.alphaThreshold
        // Binary opaque mask from RGBA alpha (`alpha >= threshold`), matching the
        // react reference's `alphaMask`.
        const mask = this._alphaMask(this._alphaData, w, h, thr)
        const contour = this._traceContour(mask, w, h)
        if (contour.length < 3) {
            this._announce('No opaque region found')
            return
        }
        const ring = this._simplify(contour, this.simplifyTolerance)
        if (ring.length < 3) {
            this._announce('No opaque region found')
            return
        }
        // The alpha raster may be a capped/downscaled copy of the source image;
        // map pixel-space points back into natural-image coordinates so the polygon
        // lands exactly on the visible edges regardless of sample resolution.
        const sx = this._natW / w
        const sy = this._natH / h
        const points: PhysicsPoint[] = ring.map(([px, py]) => ({
            x: Math.round(px * sx),
            y: Math.round(py * sy),
        }))
        const polygon: PolygonShape = { type: 'polygon', points }
        this._mutate(() => {
            const next = this._clone(this._shapes)
            next.push(polygon)
            return next
        })
        this._setSelected(this._shapes.length - 1)
        this._announce('Auto-fit shape added')
    }

    // ── Auto-fit silhouette trace (ported from react-components autoTrace) ───────

    /** Binary opaque mask from RGBA alpha, `1` where `alpha >= threshold`. */
    private _alphaMask(
        rgba: Uint8ClampedArray,
        w: number,
        h: number,
        threshold: number,
    ): Uint8Array {
        const out = new Uint8Array(w * h)
        const t = Math.max(0, Math.min(255, threshold))
        for (let i = 0; i < w * h; i++) out[i] = rgba[i * 4 + 3] >= t ? 1 : 0
        return out
    }

    /**
     * Trace the outer boundary of the first opaque blob (row-major) via
     * Moore-neighbor tracing. Returns a closed ring of pixel points (no duplicated
     * closing vertex), or `[]` for an empty mask.
     */
    private _traceContour(mask: Uint8Array, w: number, h: number): Array<[number, number]> {
        const at = (x: number, y: number) =>
            x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]

        let start = -1
        for (let i = 0; i < w * h; i++) {
            if (mask[i]) {
                start = i
                break
            }
        }
        if (start < 0) return []

        const sx = start % w
        const sy = (start - sx) / w

        // 8-neighborhood offsets, clockwise starting from west.
        const N: Array<[number, number]> = [
            [-1, 0],
            [-1, -1],
            [0, -1],
            [1, -1],
            [1, 0],
            [1, 1],
            [0, 1],
            [-1, 1],
        ]

        const contour: Array<[number, number]> = []
        let px = sx
        let py = sy
        let backDir = 0
        let guard = 0
        const maxSteps = w * h * 8 + 16

        while (guard++ < maxSteps) {
            contour.push([px, py])
            let found = -1
            for (let k = 1; k <= 8; k++) {
                const dir = (backDir + k) % 8
                const nx = px + N[dir][0]
                const ny = py + N[dir][1]
                if (at(nx, ny)) {
                    found = dir
                    px = nx
                    py = ny
                    backDir = (dir + 4) % 8
                    break
                }
            }
            if (found < 0) break // isolated pixel
            if (px === sx && py === sy) break // closed the ring at the start
        }

        return contour
    }

    /** Perpendicular distance from `p` to the line through `a`,`b`. */
    private _perpDist(p: [number, number], a: [number, number], b: [number, number]): number {
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const len = Math.hypot(dx, dy)
        if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
        return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len
    }

    /** Douglas-Peucker on an open polyline. */
    private _dpReduce(pts: Array<[number, number]>, tolerance: number): Array<[number, number]> {
        if (pts.length < 3) return pts.slice()
        let maxD = 0
        let idx = 0
        const a = pts[0]
        const b = pts[pts.length - 1]
        for (let i = 1; i < pts.length - 1; i++) {
            const d = this._perpDist(pts[i], a, b)
            if (d > maxD) {
                maxD = d
                idx = i
            }
        }
        if (maxD > tolerance) {
            const left = this._dpReduce(pts.slice(0, idx + 1), tolerance)
            const right = this._dpReduce(pts.slice(idx), tolerance)
            return left.slice(0, -1).concat(right)
        }
        return [a, b]
    }

    /**
     * Simplify a closed ring (Douglas-Peucker). Splits at the two farthest points
     * so the closure isn't biased by the arbitrary start vertex.
     */
    private _simplify(ring: Array<[number, number]>, tolerance: number): Array<[number, number]> {
        if (ring.length <= 3 || tolerance <= 0) return ring.slice()

        let far = 0
        let farD = -1
        for (let i = 1; i < ring.length; i++) {
            const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
            if (d > farD) {
                farD = d
                far = i
            }
        }
        const first = this._dpReduce(ring.slice(0, far + 1), tolerance)
        const second = this._dpReduce(ring.slice(far).concat([ring[0]]), tolerance)
        const out = first.slice(0, -1).concat(second.slice(0, -1))
        return out.length >= 3 ? out : ring.slice()
    }

    // ── Image loading + alpha extraction ─────────────────────────────────────────

    private _loadSource(src: string | File | Blob | null): void {
        if (src == null || src === '') {
            this._img = null
            this._natW = 0
            this._natH = 0
            this._alphaData = null
            this._scheduleDraw()
            return
        }
        let url: string
        let revoke = false
        if (typeof src === 'string') {
            url = src
        } else {
            // oxlint-disable-next-line react-doctor/no-create-object-url-without-revoke -- revoked in both onload and onerror below; static analysis cannot prove callback-based disposal
            url = URL.createObjectURL(src)
            revoke = true
        }
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
            if (revoke) URL.revokeObjectURL(url)
            this._img = img
            this._natW = img.naturalWidth || img.width
            this._natH = img.naturalHeight || img.height
            this._extractAlpha(img)
            this._scheduleDraw()
            if (this.autoFitOnLoad) this.autoFit()
        }
        img.onerror = () => {
            if (revoke) URL.revokeObjectURL(url)
            this._img = null
            this._natW = 0
            this._natH = 0
            this._alphaData = null
            this._scheduleDraw()
        }
        img.src = url
    }

    /** Rasterise the image (capped) so the auto-fit helper can scan its alpha. */
    private _extractAlpha(img: HTMLImageElement): void {
        const iw = img.naturalWidth || img.width
        const ih = img.naturalHeight || img.height
        if (iw === 0 || ih === 0) {
            this._alphaData = null
            return
        }
        const fit = Math.min(1, this.maxAlphaDim / Math.max(iw, ih))
        const w = Math.max(1, Math.round(iw * fit))
        const h = Math.max(1, Math.round(ih * fit))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            this._alphaData = null
            return
        }
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        try {
            this._alphaData = ctx.getImageData(0, 0, w, h).data
            this._alphaW = w
            this._alphaH = h
        } catch {
            // Tainted canvas (cross-origin image without CORS headers).
            this._alphaData = null
        }
    }

    // ── Geometry helpers ─────────────────────────────────────────────────────────

    private _canvas(): HTMLCanvasElement | null {
        return this.querySelector<HTMLCanvasElement>('.tc-physics-editor-canvas')
    }

    private _computeView(canvas: HTMLCanvasElement): ViewTransform | null {
        const cw = canvas.clientWidth
        const ch = canvas.clientHeight
        if (cw <= 0 || ch <= 0) return null
        if (this._natW <= 0 || this._natH <= 0) {
            // No image — image coords map 1:1 onto canvas CSS px.
            return { scale: 1, offsetX: 0, offsetY: 0 }
        }
        const fit = Math.min(cw / this._natW, ch / this._natH)
        const drawW = this._natW * fit
        const drawH = this._natH * fit
        return { scale: fit, offsetX: (cw - drawW) / 2, offsetY: (ch - drawH) / 2 }
    }

    /** Pointer position → image coordinates. */
    private _toImage(e: { clientX: number; clientY: number }): PhysicsPoint {
        const canvas = this._canvas()!
        const rect = canvas.getBoundingClientRect()
        const cssX = e.clientX - rect.left
        const cssY = e.clientY - rect.top
        const { scale, offsetX, offsetY } = this._view
        return { x: (cssX - offsetX) / scale, y: (cssY - offsetY) / scale }
    }

    /** Image-space point snapped to the `snap` grid (identity when snapping is off). */
    private _snapPoint(p: PhysicsPoint): PhysicsPoint {
        const step = this.snap
        if (step <= 0) return p
        return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step }
    }

    /** Pointer position → canvas CSS px. */
    private _cssPointer(e: { clientX: number; clientY: number }): PhysicsPoint {
        const canvas = this._canvas()!
        const rect = canvas.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    /** Image coords → canvas CSS px. */
    private _toCss(p: PhysicsPoint): PhysicsPoint {
        const { scale, offsetX, offsetY } = this._view
        return { x: offsetX + p.x * scale, y: offsetY + p.y * scale }
    }

    // ── Hit testing ──────────────────────────────────────────────────────────────

    private _hitHandle(idx: number, cssP: PhysicsPoint): HandleHit | null {
        if (!this.handles) return null
        const shape = this._shapes[idx]
        if (!shape) return null
        const hit = this.handleHit
        const near = (p: PhysicsPoint) => Math.hypot(cssP.x - p.x, cssP.y - p.y) <= hit
        if (shape.type === 'polygon') {
            for (let i = 0; i < shape.points.length; i++) {
                if (near(this._toCss(shape.points[i]))) return { kind: 'vertex', index: i }
            }
        } else if (shape.type === 'circle') {
            if (near(this._toCss({ x: shape.x, y: shape.y }))) return { kind: 'center' }
            if (near(this._toCss({ x: shape.x + shape.r, y: shape.y }))) return { kind: 'radius' }
        } else {
            const corners = boxCorners(shape)
            for (let i = 0; i < 4; i++) {
                if (near(this._toCss(corners[i]))) return { kind: 'corner', index: i }
            }
        }
        return null
    }

    /** Topmost shape (highest index) containing the image-space point, or -1. */
    private _hitShape(p: PhysicsPoint): number {
        for (let i = this._shapes.length - 1; i >= 0; i--) {
            if (this._pointInShape(p, this._shapes[i])) return i
        }
        return -1
    }

    private _pointInShape(p: PhysicsPoint, shape: PhysicsShape): boolean {
        if (shape.type === 'circle') {
            return Math.hypot(p.x - shape.x, p.y - shape.y) <= shape.r
        }
        if (shape.type === 'box') {
            return (
                p.x >= shape.x &&
                p.x <= shape.x + shape.w &&
                p.y >= shape.y &&
                p.y <= shape.y + shape.h
            )
        }
        // Polygon — ray casting.
        const pts = shape.points
        let inside = false
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i].x
            const yi = pts[i].y
            const xj = pts[j].x
            const yj = pts[j].y
            const intersect =
                yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi
            if (intersect) inside = !inside
        }
        return inside
    }

    // ── Pointer interaction (select / draw) ──────────────────────────────────────

    private _onPointerDown = (e: PointerEvent): void => {
        if (this._locked) return
        const canvas = this._canvas()
        if (!canvas) return
        const tool = this.tool
        if (tool === 'polygon') return // handled via click / dblclick
        const p = this._snapPoint(this._toImage(e))
        const cssP = this._cssPointer(e)

        if (tool === 'select') {
            // Edit a handle of the already-selected shape first.
            if (this._selected >= 0) {
                const hit = this._hitHandle(this._selected, cssP)
                if (hit) {
                    this._startEditDrag(hit, p)
                    this._beginPointer(e)
                    return
                }
            }
            // Otherwise select + move the topmost shape under the pointer.
            const idx = this._hitShape(p)
            if (idx >= 0) {
                this._setSelected(idx)
                this._dragBefore = this._clone(this._shapes)
                this._dragIndex = idx
                this._dragOrig = this._cloneShape(this._shapes[idx])
                this._dragStart = p
                this._dragKind = 'move'
                this._beginPointer(e)
            } else {
                this._setSelected(-1)
            }
            return
        }

        if (tool === 'circle') {
            this._dragBefore = this._clone(this._shapes)
            const shape: CircleShape = { type: 'circle', x: p.x, y: p.y, r: 0 }
            this._shapes.push(shape)
            this._dragIndex = this._shapes.length - 1
            this._setSelected(this._dragIndex)
            this._dragStart = p
            this._dragKind = 'circle-new'
            this._beginPointer(e)
            return
        }

        if (tool === 'box') {
            this._dragBefore = this._clone(this._shapes)
            const shape: BoxShape = { type: 'box', x: p.x, y: p.y, w: 0, h: 0 }
            this._shapes.push(shape)
            this._dragIndex = this._shapes.length - 1
            this._setSelected(this._dragIndex)
            this._dragStart = p
            this._dragKind = 'box-new'
            this._beginPointer(e)
        }
    }

    private _startEditDrag(hit: HandleHit, p: PhysicsPoint): void {
        this._dragBefore = this._clone(this._shapes)
        this._dragIndex = this._selected
        this._dragOrig = this._cloneShape(this._shapes[this._selected])
        this._dragStart = p
        if (hit.kind === 'vertex') {
            this._dragKind = 'vertex'
            this._dragVertex = hit.index ?? -1
        } else if (hit.kind === 'radius') {
            this._dragKind = 'radius'
        } else if (hit.kind === 'center') {
            this._dragKind = 'move'
        } else {
            this._dragKind = 'box-corner'
            this._dragCorner = hit.index ?? -1
        }
    }

    private _beginPointer(e: PointerEvent): void {
        const canvas = this._canvas()
        try {
            canvas?.setPointerCapture(e.pointerId)
        } catch {
            /* fast tap — drag works without capture */
        }
        this._cleanupDrag()
        this._moveHandler = (ev: PointerEvent) => this._onPointerMove(ev)
        this._upHandler = () => this._onPointerUp()
        document.addEventListener('pointermove', this._moveHandler)
        document.addEventListener('pointerup', this._upHandler)
        document.addEventListener('pointercancel', this._upHandler)
        e.preventDefault()
    }

    private _onPointerMove(e: PointerEvent): void {
        if (!this._dragKind) return
        const p = this._snapPoint(this._toImage(e))
        const shape = this._shapes[this._dragIndex]
        const orig = this._dragOrig
        const start = this._dragStart
        if (!shape || !start) return
        const minSize = this.minSize
        switch (this._dragKind) {
            case 'move':
                if (orig) this._translateShape(shape, orig, p.x - start.x, p.y - start.y)
                break
            case 'vertex':
                if (shape.type === 'polygon' && this._dragVertex >= 0) {
                    shape.points[this._dragVertex] = { x: p.x, y: p.y }
                }
                break
            case 'radius':
                if (shape.type === 'circle') {
                    shape.r = Math.max(minSize, Math.hypot(p.x - shape.x, p.y - shape.y))
                }
                break
            case 'circle-new':
                if (shape.type === 'circle') {
                    shape.r = Math.hypot(p.x - shape.x, p.y - shape.y)
                }
                break
            case 'box-corner':
                if (shape.type === 'box' && orig && orig.type === 'box') {
                    this._resizeBoxCorner(shape, orig, this._dragCorner, p)
                }
                break
            case 'box-new':
                if (shape.type === 'box') {
                    shape.x = Math.min(start.x, p.x)
                    shape.y = Math.min(start.y, p.y)
                    shape.w = Math.abs(p.x - start.x)
                    shape.h = Math.abs(p.y - start.y)
                }
                break
        }
        this._scheduleDraw()
    }

    private _onPointerUp(): void {
        const kind = this._dragKind
        this._dragKind = null
        this._cleanupDrag()
        if (!kind) return

        // Discard accidentally-tiny freshly-drawn shapes.
        const minSize = this.minSize
        const shape = this._shapes[this._dragIndex]
        let discarded = false
        if (kind === 'circle-new' && shape && shape.type === 'circle' && shape.r < minSize) {
            this._shapes.splice(this._dragIndex, 1)
            discarded = true
        } else if (
            kind === 'box-new' &&
            shape &&
            shape.type === 'box' &&
            (shape.w < minSize || shape.h < minSize)
        ) {
            this._shapes.splice(this._dragIndex, 1)
            discarded = true
        }
        if (discarded) {
            this._setSelected(-1)
            this._dragBefore = null
            this._scheduleDraw()
            return
        }

        // Commit to history only if the gesture actually changed the model.
        if (this._dragBefore && JSON.stringify(this._dragBefore) !== JSON.stringify(this._shapes)) {
            this._undo.push(this._dragBefore)
            this._redo = []
            this._trimHistory()
            this._emitChange()
        }
        this._dragBefore = null
        this._dragOrig = null
        this._scheduleDraw()
    }

    private _cleanupDrag(): void {
        if (this._moveHandler) document.removeEventListener('pointermove', this._moveHandler)
        if (this._upHandler) {
            document.removeEventListener('pointerup', this._upHandler)
            document.removeEventListener('pointercancel', this._upHandler)
        }
        this._moveHandler = null
        this._upHandler = null
    }

    private _translateShape(live: PhysicsShape, orig: PhysicsShape, dx: number, dy: number): void {
        if (live.type === 'polygon' && orig.type === 'polygon') {
            live.points = orig.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }))
        } else if (live.type === 'circle' && orig.type === 'circle') {
            live.x = orig.x + dx
            live.y = orig.y + dy
        } else if (live.type === 'box' && orig.type === 'box') {
            live.x = orig.x + dx
            live.y = orig.y + dy
        }
    }

    private _resizeBoxCorner(
        live: BoxShape,
        orig: BoxShape,
        corner: number,
        p: PhysicsPoint,
    ): void {
        // Keep the opposite corner pinned; the dragged corner follows the pointer.
        const opp = boxCorners(orig)[(corner + 2) % 4]
        live.x = Math.min(opp.x, p.x)
        live.y = Math.min(opp.y, p.y)
        live.w = Math.abs(p.x - opp.x)
        live.h = Math.abs(p.y - opp.y)
    }

    // ── Polygon (click to add vertex, dbl-click / Enter to close) ─────────────────

    private _onCanvasClick = (e: MouseEvent): void => {
        if (this._locked || this.tool !== 'polygon') return
        const p = this._snapPoint(this._toImage(e))
        const cssP = this._cssPointer(e)
        if (!this._pendingPolygon) {
            this._pendingPolygon = [{ x: p.x, y: p.y }]
            this._pendingCursor = { x: p.x, y: p.y }
            this._announce('Polygon started — click to add points, double-click to finish')
            this._scheduleDraw()
            return
        }
        // Click near the first vertex closes the polygon (≥ 3 points).
        if (this._pendingPolygon.length >= 3) {
            const first = this._toCss(this._pendingPolygon[0])
            if (Math.hypot(cssP.x - first.x, cssP.y - first.y) <= this.handleHit) {
                this._closePolygon()
                return
            }
        }
        this._pendingPolygon.push({ x: p.x, y: p.y })
        this._scheduleDraw()
    }

    private _onCanvasDblClick = (e: MouseEvent): void => {
        if (this._locked || this.tool !== 'polygon') return
        e.preventDefault()
        this._closePolygon()
    }

    private _onCanvasHover = (e: PointerEvent): void => {
        if (this.tool !== 'polygon' || !this._pendingPolygon) return
        this._pendingCursor = this._snapPoint(this._toImage(e))
        this._scheduleDraw()
    }

    private _closePolygon(): void {
        const pts = this._pendingPolygon
        this._pendingPolygon = null
        this._pendingCursor = null
        if (!pts) return
        const cleaned = this._dedupePoints(pts)
        if (cleaned.length < 3) {
            this._announce('Polygon needs at least 3 points')
            this._scheduleDraw()
            return
        }
        this._mutate(() => {
            const next = this._clone(this._shapes)
            next.push({ type: 'polygon', points: cleaned })
            return next
        })
        this._setSelected(this._shapes.length - 1)
        this._announce('Polygon added')
    }

    /** Drop consecutive near-duplicate points (covers the dbl-click double add). */
    private _dedupePoints(pts: PhysicsPoint[]): PhysicsPoint[] {
        const eps = this.handleHit / (this._view.scale || 1)
        const out: PhysicsPoint[] = []
        for (const pt of pts) {
            const last = out[out.length - 1]
            if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > eps) out.push(pt)
        }
        return out
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────────

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (this.disabled || this.readonly || !this.shortcuts) return
        const meta = e.ctrlKey || e.metaKey
        if (meta && (e.key === 'z' || e.key === 'Z')) {
            e.preventDefault()
            if (e.shiftKey) this.redo()
            else this.undo()
            return
        }
        if (meta && (e.key === 'y' || e.key === 'Y')) {
            e.preventDefault()
            this.redo()
            return
        }
        if (e.key === 'Enter') {
            if (this.tool === 'polygon' && this._pendingPolygon) {
                e.preventDefault()
                this._closePolygon()
            }
            return
        }
        if (e.key === 'Escape') {
            this.cancelDrawing()
            return
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this._selected >= 0) {
                e.preventDefault()
                this.deleteSelected()
            }
        }
    }

    // ── History / selection helpers ───────────────────────────────────────────────

    private _mutate(producer: () => PhysicsShape[]): void {
        const before = this._clone(this._shapes)
        const next = producer()
        this._undo.push(before)
        this._redo = []
        this._trimHistory()
        this._shapes = next
        this._emitChange()
        this._scheduleDraw()
    }

    private _trimHistory(): void {
        const limit = this.historyLimit
        if (limit <= 0) return
        if (this._undo.length > limit) this._undo.splice(0, this._undo.length - limit)
        if (this._redo.length > limit) this._redo.splice(0, this._redo.length - limit)
    }

    private _setSelected(idx: number): void {
        this._selected = idx
        const shape = idx >= 0 ? this._shapes[idx] : null
        if (shape) this._announce(`Selected ${shape.type} shape`)
        this._scheduleDraw()
    }

    private _clampSelection(): void {
        if (this._selected >= this._shapes.length) this._selected = -1
    }

    private _clone(shapes: PhysicsShape[]): PhysicsShape[] {
        return structuredClone(shapes)
    }

    private _cloneShape(shape: PhysicsShape): PhysicsShape {
        return structuredClone(shape)
    }

    private _emitChange(): void {
        const detail = { shapes: this._clone(this._shapes) }
        // The `shapes` attribute is input-only — a full JSON snapshot per drag
        // commit would bloat the DOM; read the model back via the property/event.
        this.dispatchEvent(new CustomEvent('tc-change', { bubbles: true, composed: true, detail }))
        if (typeof this.onChange === 'function') this.onChange(detail.shapes)
    }

    private _announce(message: string): void {
        const el = this.querySelector('.tc-physics-editor-status')
        if (el) el.textContent = message
    }

    // ── Drawing ────────────────────────────────────────────────────────────────────

    private _scheduleDraw(): void {
        if (this._raf != null) return
        this._raf = requestAnimationFrame(() => {
            this._raf = null
            this._draw()
        })
    }

    // Resolve the canvas-drawn colours from the --bs-physics-editor-* custom
    // properties. getComputedStyle returns custom properties *unresolved* (the raw
    // `var(...)` token), so a hidden probe is used to force var() substitution into
    // a concrete colour via the real `color` property. Cached — drags never re-run
    // this (the palette only changes when the theme/markup changes, i.e. on render).
    private _palette(): Palette {
        if (this._paletteCache) return this._paletteCache
        const probe = document.createElement('span')
        probe.style.position = 'absolute'
        probe.style.visibility = 'hidden'
        probe.style.pointerEvents = 'none'
        this.appendChild(probe)
        const resolve = (name: string, fallback: string): string => {
            probe.style.color = `var(${name}, ${fallback})`
            return getComputedStyle(probe).color || fallback
        }
        const pal: Palette = {
            stroke: resolve('--bs-physics-editor-shape-stroke', '#94a3b8'),
            fill: resolve('--bs-physics-editor-shape-fill', 'rgba(148, 163, 184, 0.16)'),
            selStroke: resolve('--bs-physics-editor-selected-stroke', '#1e293b'),
            selFill: resolve('--bs-physics-editor-selected-fill', 'rgba(30, 41, 59, 0.16)'),
            handleBg: resolve('--bs-physics-editor-handle-bg', '#ffffff'),
            handleBorder: resolve('--bs-physics-editor-handle-border', '#1e293b'),
            preview: resolve('--bs-physics-editor-preview-stroke', '#06b6d4'),
        }
        this.removeChild(probe)
        this._paletteCache = pal
        return pal
    }

    private _draw(): void {
        const canvas = this._canvas()
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const view = this._computeView(canvas)
        if (!view) return
        this._view = view

        const cw = canvas.clientWidth
        const ch = canvas.clientHeight
        const dpr = window.devicePixelRatio || 1
        const pw = Math.max(1, Math.round(cw * dpr))
        const ph = Math.max(1, Math.round(ch * dpr))
        if (canvas.width !== pw) canvas.width = pw
        if (canvas.height !== ph) canvas.height = ph
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, cw, ch)

        // Background image (fit + centred).
        if (this._img && this._natW > 0) {
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(
                this._img,
                view.offsetX,
                view.offsetY,
                this._natW * view.scale,
                this._natH * view.scale,
            )
        }

        const pal = this._palette()
        this._shapes.forEach((shape, i) => {
            const selected = i === this._selected
            ctx.lineWidth = selected ? 2 : 1.5
            ctx.strokeStyle = selected ? pal.selStroke : pal.stroke
            ctx.fillStyle = selected ? pal.selFill : pal.fill
            this._tracePath(ctx, shape)
            ctx.fill()
            ctx.stroke()
        })

        if (this.handles && this._selected >= 0 && this._shapes[this._selected]) {
            this._drawHandles(ctx, this._shapes[this._selected], pal)
        }
        if (this._pendingPolygon && this._pendingPolygon.length > 0) {
            this._drawPending(ctx, pal)
        }
    }

    private _tracePath(ctx: CanvasRenderingContext2D, shape: PhysicsShape): void {
        ctx.beginPath()
        if (shape.type === 'polygon') {
            shape.points.forEach((pt, i) => {
                const c = this._toCss(pt)
                if (i === 0) ctx.moveTo(c.x, c.y)
                else ctx.lineTo(c.x, c.y)
            })
            ctx.closePath()
        } else if (shape.type === 'circle') {
            const c = this._toCss({ x: shape.x, y: shape.y })
            ctx.arc(c.x, c.y, Math.max(0, shape.r * this._view.scale), 0, Math.PI * 2)
        } else {
            const tl = this._toCss({ x: shape.x, y: shape.y })
            ctx.rect(tl.x, tl.y, shape.w * this._view.scale, shape.h * this._view.scale)
        }
    }

    private _handleSquare(ctx: CanvasRenderingContext2D, p: PhysicsPoint, pal: Palette): void {
        const s = this.handleSize
        ctx.fillStyle = pal.handleBg
        ctx.strokeStyle = pal.handleBorder
        ctx.lineWidth = 1.5
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
        ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s)
    }

    private _handleCircle(ctx: CanvasRenderingContext2D, p: PhysicsPoint, pal: Palette): void {
        ctx.beginPath()
        ctx.arc(p.x, p.y, this.handleSize / 2, 0, Math.PI * 2)
        ctx.fillStyle = pal.handleBg
        ctx.strokeStyle = pal.handleBorder
        ctx.lineWidth = 1.5
        ctx.fill()
        ctx.stroke()
    }

    private _drawHandles(ctx: CanvasRenderingContext2D, shape: PhysicsShape, pal: Palette): void {
        if (shape.type === 'polygon') {
            shape.points.forEach((pt) => this._handleSquare(ctx, this._toCss(pt), pal))
        } else if (shape.type === 'circle') {
            this._handleSquare(ctx, this._toCss({ x: shape.x, y: shape.y }), pal)
            this._handleCircle(ctx, this._toCss({ x: shape.x + shape.r, y: shape.y }), pal)
        } else {
            boxCorners(shape).forEach((c) => this._handleSquare(ctx, this._toCss(c), pal))
        }
    }

    private _drawPending(ctx: CanvasRenderingContext2D, pal: Palette): void {
        const pts = this._pendingPolygon!
        const handleSize = this.handleSize
        ctx.beginPath()
        pts.forEach((pt, i) => {
            const c = this._toCss(pt)
            if (i === 0) ctx.moveTo(c.x, c.y)
            else ctx.lineTo(c.x, c.y)
        })
        if (this._pendingCursor) {
            const c = this._toCss(this._pendingCursor)
            ctx.lineTo(c.x, c.y)
        }
        ctx.strokeStyle = pal.preview
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.stroke()
        ctx.setLineDash([])
        // Vertex markers (the first one larger so closing is discoverable).
        pts.forEach((pt, i) => {
            const c = this._toCss(pt)
            ctx.beginPath()
            ctx.arc(c.x, c.y, i === 0 ? handleSize / 2 + 1 : handleSize / 2 - 1, 0, Math.PI * 2)
            ctx.fillStyle = pal.preview
            ctx.fill()
        })
    }

    // ── Resize ──────────────────────────────────────────────────────────────────────

    private _observeResize(): void {
        if (this._resizeObserver || typeof ResizeObserver === 'undefined') return
        const canvas = this._canvas()
        if (!canvas) return
        this._resizeObserver = new ResizeObserver(() => this._scheduleDraw())
        this._resizeObserver.observe(canvas)
    }

    // ── Disabled state ────────────────────────────────────────────────────────────

    private _updateDisabled(): void {
        const disabled = this.disabled
        const root = this.querySelector('.tc-physics-editor')
        if (root) {
            root.classList.toggle('tc-physics-editor--disabled', disabled)
            if (disabled) root.setAttribute('aria-disabled', 'true')
            else root.removeAttribute('aria-disabled')
        }
        if (this._locked) {
            this._pendingPolygon = null
            this._pendingCursor = null
            this._cleanupDrag()
            this._dragKind = null
        }
        this._scheduleDraw()
    }

    // ── Markup ────────────────────────────────────────────────────────────────────

    private render(): void {
        this._paletteCache = null
        const disabled = this.disabled
        const canvasId = `${this._idPrefix}-canvas`
        this.innerHTML =
            `<div class="tc-physics-editor${disabled ? ' tc-physics-editor--disabled' : ''}"${disabled ? ' aria-disabled="true"' : ''}>` +
            `<div class="tc-physics-editor-stage" role="application"` +
            ` aria-label="Shape canvas. Set the active tool from outside the component, then draw or edit shapes. Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Delete removes the selected shape, Enter closes a polygon, Escape cancels.">` +
            `<canvas class="tc-physics-editor-canvas" id="${canvasId}" tabindex="0"` +
            ` aria-label="Physics shape drawing canvas"></canvas>` +
            `</div>` +
            `<span class="tc-physics-editor-status visually-hidden" role="status" aria-live="polite"></span>` +
            `</div>`

        const canvas = this._canvas()
        if (canvas) {
            canvas.addEventListener('pointerdown', this._onPointerDown)
            canvas.addEventListener('pointermove', this._onCanvasHover)
            canvas.addEventListener('click', this._onCanvasClick)
            canvas.addEventListener('dblclick', this._onCanvasDblClick)
            canvas.addEventListener('keydown', this._onKeyDown)
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PhysicsEditor
    }
}

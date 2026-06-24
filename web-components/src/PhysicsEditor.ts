import { lucideByName } from './internal/lucide'

const TAG_NAME = 'tc-physics-editor'

// ── Public type surface (mirrors @toolcase/react-components PhysicsEditor) ──────

export type PhysicsTool = 'select' | 'polygon' | 'circle' | 'box'
const TOOLS: PhysicsTool[] = ['select', 'polygon', 'circle', 'box']

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
const HANDLE_HIT = 9
// Drawn handle size (CSS px).
const HANDLE_SIZE = 8
// Smallest drawn extent (image coords) that counts as a real shape — anything
// smaller on pointer-up is discarded as an accidental click.
const MIN_SIZE = 4
// Cap the resolution used to sample alpha for the auto-fit helper — a huge image
// would make the per-pixel scan slow.
const MAX_ALPHA_DIM = 512
// Douglas-Peucker tolerance (alpha-raster px) for the auto-fit silhouette trace.
// Matches the @toolcase/react-components default `simplifyTolerance`.
const SIMPLIFY_TOLERANCE = 1.5

let _idCounter = 0

const TOOL_META: Array<{ tool: PhysicsTool; label: string; iconHtml: string }> = [
    { tool: 'select', label: 'Select / move shapes', iconHtml: lucideByName('mouse-pointer-2') },
    { tool: 'polygon', label: 'Draw polygon', iconHtml: lucideByName('pen-tool') },
    { tool: 'circle', label: 'Draw circle', iconHtml: lucideByName('circle') },
    { tool: 'box', label: 'Draw box', iconHtml: lucideByName('square') },
]

const undoIconHtml = lucideByName('undo-2')
const redoIconHtml = lucideByName('redo-2')
const deleteIconHtml = lucideByName('trash-2')
const autoFitIconHtml = lucideByName('wand-2')

// Box corners in draw order: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left.
function boxCorners(b: BoxShape): PhysicsPoint[] {
    return [
        { x: b.x, y: b.y },
        { x: b.x + b.w, y: b.y },
        { x: b.x + b.w, y: b.y + b.h },
        { x: b.x, y: b.y + b.h },
    ]
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
        return ['source', 'tool', 'alpha-threshold', 'disabled']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
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
            case 'tool':
                // Switching tools cancels an in-progress polygon.
                this._pendingPolygon = null
                this._pendingCursor = null
                this._updateToolbar()
                this._scheduleDraw()
                break
            case 'alpha-threshold':
                // Affects only the next auto-fit run; nothing to redraw.
                break
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

    get alphaThreshold(): number {
        const v = parseFloat(this.getAttribute('alpha-threshold') ?? '')
        if (!Number.isFinite(v)) return DEFAULT_ALPHA_THRESHOLD
        return Math.max(0, Math.min(255, v))
    }
    set alphaThreshold(v: number) {
        this.setAttribute('alpha-threshold', String(v))
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
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

    // ── shapes (JS property) ─────────────────────────────────────────────────────

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
        if (this._initialised) {
            this._scheduleDraw()
            this._updateToolbar()
        }
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
        this._updateToolbar()
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
        this._updateToolbar()
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
        const ring = this._simplify(contour, SIMPLIFY_TOLERANCE)
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
            this._updateToolbar()
            return
        }
        let url: string
        let revoke = false
        if (typeof src === 'string') {
            url = src
        } else {
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
            this._updateToolbar()
        }
        img.onerror = () => {
            if (revoke) URL.revokeObjectURL(url)
            this._img = null
            this._natW = 0
            this._natH = 0
            this._alphaData = null
            this._scheduleDraw()
            this._updateToolbar()
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
        const fit = Math.min(1, MAX_ALPHA_DIM / Math.max(iw, ih))
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
        const shape = this._shapes[idx]
        if (!shape) return null
        const near = (p: PhysicsPoint) => Math.hypot(cssP.x - p.x, cssP.y - p.y) <= HANDLE_HIT
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
        if (this.disabled) return
        const canvas = this._canvas()
        if (!canvas) return
        const tool = this.tool
        if (tool === 'polygon') return // handled via click / dblclick
        const p = this._toImage(e)
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
        const p = this._toImage(e)
        const shape = this._shapes[this._dragIndex]
        const orig = this._dragOrig
        const start = this._dragStart
        if (!shape || !start) return
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
                    shape.r = Math.max(MIN_SIZE, Math.hypot(p.x - shape.x, p.y - shape.y))
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
        const shape = this._shapes[this._dragIndex]
        let discarded = false
        if (kind === 'circle-new' && shape && shape.type === 'circle' && shape.r < MIN_SIZE) {
            this._shapes.splice(this._dragIndex, 1)
            discarded = true
        } else if (
            kind === 'box-new' &&
            shape &&
            shape.type === 'box' &&
            (shape.w < MIN_SIZE || shape.h < MIN_SIZE)
        ) {
            this._shapes.splice(this._dragIndex, 1)
            discarded = true
        }
        if (discarded) {
            this._setSelected(-1)
            this._dragBefore = null
            this._scheduleDraw()
            this._updateToolbar()
            return
        }

        // Commit to history only if the gesture actually changed the model.
        if (this._dragBefore && JSON.stringify(this._dragBefore) !== JSON.stringify(this._shapes)) {
            this._undo.push(this._dragBefore)
            this._redo = []
            this._emitChange()
        }
        this._dragBefore = null
        this._dragOrig = null
        this._scheduleDraw()
        this._updateToolbar()
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
        if (this.disabled || this.tool !== 'polygon') return
        const p = this._toImage(e)
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
            if (Math.hypot(cssP.x - first.x, cssP.y - first.y) <= HANDLE_HIT) {
                this._closePolygon()
                return
            }
        }
        this._pendingPolygon.push({ x: p.x, y: p.y })
        this._scheduleDraw()
    }

    private _onCanvasDblClick = (e: MouseEvent): void => {
        if (this.disabled || this.tool !== 'polygon') return
        e.preventDefault()
        this._closePolygon()
    }

    private _onCanvasHover = (e: PointerEvent): void => {
        if (this.tool !== 'polygon' || !this._pendingPolygon) return
        this._pendingCursor = this._toImage(e)
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
        const eps = HANDLE_HIT / (this._view.scale || 1)
        const out: PhysicsPoint[] = []
        for (const pt of pts) {
            const last = out[out.length - 1]
            if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > eps) out.push(pt)
        }
        return out
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────────

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (this.disabled) return
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
            if (this._pendingPolygon) {
                this._pendingPolygon = null
                this._pendingCursor = null
                this._announce('Polygon cancelled')
                this._scheduleDraw()
            }
            return
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this._selected >= 0) {
                e.preventDefault()
                this.deleteSelected()
            }
        }
    }

    // ── Toolbar ────────────────────────────────────────────────────────────────────

    private _onToolbarClick = (e: Event): void => {
        if (this.disabled) return
        const target = e.target as HTMLElement
        const toolBtn = target.closest<HTMLElement>('[data-tool]')
        if (toolBtn) {
            this.tool = toolBtn.getAttribute('data-tool') as PhysicsTool
            return
        }
        const actionBtn = target.closest<HTMLElement>('[data-action]')
        if (!actionBtn || actionBtn.getAttribute('aria-disabled') === 'true') return
        switch (actionBtn.getAttribute('data-action')) {
            case 'undo':
                this.undo()
                break
            case 'redo':
                this.redo()
                break
            case 'delete':
                this.deleteSelected()
                break
            case 'autofit':
                this.autoFit()
                break
        }
    }

    // ── History / selection helpers ───────────────────────────────────────────────

    private _mutate(producer: () => PhysicsShape[]): void {
        const before = this._clone(this._shapes)
        const next = producer()
        this._undo.push(before)
        this._redo = []
        this._shapes = next
        this._emitChange()
        this._scheduleDraw()
        this._updateToolbar()
    }

    private _setSelected(idx: number): void {
        this._selected = idx
        const shape = idx >= 0 ? this._shapes[idx] : null
        if (shape) this._announce(`Selected ${shape.type} shape`)
        this._scheduleDraw()
        this._updateToolbar()
    }

    private _clampSelection(): void {
        if (this._selected >= this._shapes.length) this._selected = -1
    }

    private _clone(shapes: PhysicsShape[]): PhysicsShape[] {
        return JSON.parse(JSON.stringify(shapes))
    }

    private _cloneShape(shape: PhysicsShape): PhysicsShape {
        return JSON.parse(JSON.stringify(shape))
    }

    private _emitChange(): void {
        const detail = { shapes: this._clone(this._shapes) }
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

        if (this._selected >= 0 && this._shapes[this._selected]) {
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
        const s = HANDLE_SIZE
        ctx.fillStyle = pal.handleBg
        ctx.strokeStyle = pal.handleBorder
        ctx.lineWidth = 1.5
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s)
        ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s)
    }

    private _handleCircle(ctx: CanvasRenderingContext2D, p: PhysicsPoint, pal: Palette): void {
        ctx.beginPath()
        ctx.arc(p.x, p.y, HANDLE_SIZE / 2, 0, Math.PI * 2)
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
            ctx.arc(c.x, c.y, i === 0 ? HANDLE_SIZE / 2 + 1 : HANDLE_SIZE / 2 - 1, 0, Math.PI * 2)
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
        if (disabled) {
            this._pendingPolygon = null
            this._pendingCursor = null
            this._cleanupDrag()
            this._dragKind = null
        }
        this._scheduleDraw()
    }

    // ── Toolbar state ─────────────────────────────────────────────────────────────

    private _updateToolbar(): void {
        const tool = this.tool
        this.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
            const active = btn.getAttribute('data-tool') === tool
            btn.classList.toggle('tc-physics-editor-tool--active', active)
            btn.setAttribute('aria-pressed', active ? 'true' : 'false')
        })
        const setAction = (action: string, enabled: boolean) => {
            const btn = this.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)
            if (!btn) return
            btn.classList.toggle('tc-physics-editor-action--disabled', !enabled)
            btn.setAttribute('aria-disabled', enabled ? 'false' : 'true')
        }
        setAction('autofit', this._alphaData != null && this._natW > 0)
        setAction('undo', this._undo.length > 0)
        setAction('redo', this._redo.length > 0)
        setAction('delete', this._selected >= 0)
    }

    // ── Markup ────────────────────────────────────────────────────────────────────

    private _toolButtonsHtml(): string {
        const tool = this.tool
        return TOOL_META.map(({ tool: t, label, iconHtml }) => {
            const active = t === tool
            return (
                `<button type="button" class="tc-physics-editor-tool${active ? ' tc-physics-editor-tool--active' : ''}"` +
                ` data-tool="${t}" aria-label="${label}" aria-pressed="${active ? 'true' : 'false'}">${iconHtml}</button>`
            )
        }).join('')
    }

    private _actionButtonsHtml(): string {
        const action = (name: string, label: string, iconHtml: string) =>
            `<button type="button" class="tc-physics-editor-action tc-physics-editor-action--disabled"` +
            ` data-action="${name}" aria-label="${label}" aria-disabled="true">${iconHtml}</button>`
        return (
            action('autofit', 'Auto-fit shape to image', autoFitIconHtml) +
            action('undo', 'Undo', undoIconHtml) +
            action('redo', 'Redo', redoIconHtml) +
            action('delete', 'Delete selected shape', deleteIconHtml)
        )
    }

    private render(): void {
        this._paletteCache = null
        const disabled = this.disabled
        const canvasId = `${this._idPrefix}-canvas`
        this.innerHTML =
            `<div class="tc-physics-editor${disabled ? ' tc-physics-editor--disabled' : ''}"${disabled ? ' aria-disabled="true"' : ''}>` +
            `<div class="tc-physics-editor-toolbar" role="toolbar" aria-label="Physics shape editor tools">` +
            `<div class="tc-physics-editor-tools" role="group" aria-label="Drawing tools">${this._toolButtonsHtml()}</div>` +
            `<div class="tc-physics-editor-actions" role="group" aria-label="History and actions">${this._actionButtonsHtml()}</div>` +
            `</div>` +
            `<div class="tc-physics-editor-stage" role="application"` +
            ` aria-label="Shape canvas. Use the toolbar to pick a tool, then draw or edit shapes. Keyboard: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Delete removes the selected shape, Enter closes a polygon, Escape cancels.">` +
            `<canvas class="tc-physics-editor-canvas" id="${canvasId}" tabindex="0"` +
            ` aria-label="Physics shape drawing canvas"></canvas>` +
            `</div>` +
            `<span class="tc-physics-editor-status visually-hidden" role="status" aria-live="polite"></span>` +
            `</div>`

        const root = this.querySelector('.tc-physics-editor')
        if (root) root.addEventListener('click', this._onToolbarClick)
        const canvas = this._canvas()
        if (canvas) {
            canvas.addEventListener('pointerdown', this._onPointerDown)
            canvas.addEventListener('pointermove', this._onCanvasHover)
            canvas.addEventListener('click', this._onCanvasClick)
            canvas.addEventListener('dblclick', this._onCanvasDblClick)
            canvas.addEventListener('keydown', this._onKeyDown)
        }

        this._updateToolbar()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PhysicsEditor
    }
}

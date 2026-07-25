import { lucideByName } from './internal/lucide'

const TAG_NAME = 'tc-normal-map-generator'

// ── Public type surface (mirrors @toolcase/react-components NormalMapGenerator) ──

export type EditorTool = 'brush' | 'erase' | 'mask' | 'pan'
const TOOLS: EditorTool[] = ['brush', 'erase', 'mask', 'pan']

export type PreviewMode = 'normal' | 'albedo' | 'lit' | 'lit-surface'
const PREVIEW_MODES: PreviewMode[] = ['normal', 'albedo', 'lit', 'lit-surface']

/** Output handed to `tc-generate` / `onGenerate` whenever the normal map is recomputed. */
export interface NormalMapOutput {
    /** PNG data URL of the computed normal map at source resolution. */
    dataUrl: string
    width: number
    height: number
}

// Default scalar values (mirror the React prop defaults).
const DEFAULT_STRENGTH = 1
const DEFAULT_EMBOSS = 2
const DEFAULT_BEVEL = 0

// Cap the working resolution — the Sobel + distance-transform passes are O(w·h)
// and a huge sprite would freeze the main thread.
const MAX_DIM = 256

// Flat up-normal fill for transparent source pixels (#8080ff).
const FLAT_NORMAL: [number, number, number] = [128, 128, 255]

let _idCounter = 0

const TOOL_META: Array<{ tool: EditorTool; label: string; iconHtml: string }> = [
    { tool: 'brush', label: 'Brush', iconHtml: lucideByName('brush') },
    { tool: 'erase', label: 'Erase', iconHtml: lucideByName('eraser') },
    { tool: 'mask', label: 'Mask', iconHtml: lucideByName('square-dashed') },
    { tool: 'pan', label: 'Pan', iconHtml: lucideByName('move') },
]

const PREVIEW_META: Array<{ mode: PreviewMode; label: string }> = [
    { mode: 'normal', label: 'Normal' },
    { mode: 'albedo', label: 'Albedo' },
    { mode: 'lit', label: 'Lit' },
    { mode: 'lit-surface', label: 'Surface' },
]

// ── Pure height → normal pipeline (ported from the React generate.ts) ──────────

const LUMA_R = 0.299
const LUMA_G = 0.587
const LUMA_B = 0.114
const D_ORTHO = 1
const D_DIAG = Math.SQRT2

/** Edge-replicated heightmap sample. */
const clampSample = (height: Float32Array, w: number, h: number, x: number, y: number): number => {
    const cx = x < 0 ? 0 : x >= w ? w - 1 : x
    const cy = y < 0 ? 0 : y >= h ? h - 1 : y
    return height[cy * w + cx]
}

/** Luminance heightmap from RGBA (Rec. 601 weights), scaled by `embossHeight`. */
const toHeightmap = (
    rgba: Uint8ClampedArray,
    w: number,
    h: number,
    embossHeight: number,
): Float32Array => {
    const out = new Float32Array(w * h)
    if (embossHeight === 0) return out
    for (let i = 0; i < out.length; i++) {
        const o = i * 4
        const lum = (LUMA_R * rgba[o] + LUMA_G * rgba[o + 1] + LUMA_B * rgba[o + 2]) / 255
        out[i] = lum * embossHeight
    }
    return out
}

/** Two-pass chamfer distance transform: px distance from the nearest transparent pixel. */
const alphaToDistance = (rgba: Uint8ClampedArray, w: number, h: number): Float32Array => {
    const dist = new Float32Array(w * h)
    for (let i = 0; i < dist.length; i++) dist[i] = rgba[i * 4 + 3] === 0 ? 0 : Infinity

    const at = (x: number, y: number): number =>
        x < 0 || x >= w || y < 0 || y >= h ? 0 : dist[y * w + x]

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x
            if (dist[i] === 0) continue
            let d = dist[i]
            d = Math.min(d, at(x - 1, y) + D_ORTHO)
            d = Math.min(d, at(x, y - 1) + D_ORTHO)
            d = Math.min(d, at(x - 1, y - 1) + D_DIAG)
            d = Math.min(d, at(x + 1, y - 1) + D_DIAG)
            dist[i] = d
        }
    }
    for (let y = h - 1; y >= 0; y--) {
        for (let x = w - 1; x >= 0; x--) {
            const i = y * w + x
            if (dist[i] === 0) continue
            let d = dist[i]
            d = Math.min(d, at(x + 1, y) + D_ORTHO)
            d = Math.min(d, at(x, y + 1) + D_ORTHO)
            d = Math.min(d, at(x + 1, y + 1) + D_DIAG)
            d = Math.min(d, at(x - 1, y + 1) + D_DIAG)
            dist[i] = d
        }
    }
    return dist
}

/** Separable box blur (in place), `radius` px. */
const blurHeightmap = (
    height: Float32Array,
    w: number,
    h: number,
    radius: number,
): Float32Array => {
    const r = Math.floor(radius)
    if (r <= 0) return height
    const win = r * 2 + 1
    const tmp = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0
            for (let k = -r; k <= r; k++) {
                let sx = x + k
                if (sx < 0) sx = 0
                else if (sx >= w) sx = w - 1
                sum += height[y * w + sx]
            }
            tmp[y * w + x] = sum / win
        }
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0
            for (let k = -r; k <= r; k++) {
                let sy = y + k
                if (sy < 0) sy = 0
                else if (sy >= h) sy = h - 1
                sum += tmp[sy * w + x]
            }
            height[y * w + x] = sum / win
        }
    }
    return height
}

interface HeightOptions {
    embossHeight: number
    /** Alpha-bevel reach in px. Doubles as the post-combine blur radius. */
    bevelWidth: number
}

/** Combined emboss + alpha-bevel heightmap, blurred by `bevelWidth`. */
const buildHeightmap = (
    rgba: Uint8ClampedArray,
    w: number,
    h: number,
    opts: HeightOptions,
): Float32Array => {
    const height = toHeightmap(rgba, w, h, opts.embossHeight)
    if (opts.bevelWidth > 0) {
        const dist = alphaToDistance(rgba, w, h)
        for (let i = 0; i < height.length; i++) {
            const d = Math.min(dist[i], opts.bevelWidth)
            height[i] += d / opts.bevelWidth
        }
        // The bevel width also softens the surface (blur ≈ half the reach).
        blurHeightmap(height, w, h, opts.bevelWidth * 0.5)
    }
    return height
}

/** Sobel → normal → pack. Transparent source pixels become `FLAT_NORMAL` with `a = 0`. */
const normalsFromHeight = (
    height: Float32Array,
    rgba: Uint8ClampedArray,
    w: number,
    h: number,
    strength: number,
): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4
            const srcA = rgba[o + 3]
            if (srcA === 0) {
                out[o] = FLAT_NORMAL[0]
                out[o + 1] = FLAT_NORMAL[1]
                out[o + 2] = FLAT_NORMAL[2]
                out[o + 3] = 0
                continue
            }
            const tl = clampSample(height, w, h, x - 1, y - 1)
            const t = clampSample(height, w, h, x, y - 1)
            const tr = clampSample(height, w, h, x + 1, y - 1)
            const l = clampSample(height, w, h, x - 1, y)
            const rr = clampSample(height, w, h, x + 1, y)
            const bl = clampSample(height, w, h, x - 1, y + 1)
            const bo = clampSample(height, w, h, x, y + 1)
            const br = clampSample(height, w, h, x + 1, y + 1)

            const dx = tr + 2 * rr + br - (tl + 2 * l + bl)
            const dy = bl + 2 * bo + br - (tl + 2 * t + tr)

            let nx = -dx * strength
            let ny = -dy * strength
            let nz = 1
            const len = Math.hypot(nx, ny, nz) || 1
            nx /= len
            ny /= len
            nz /= len

            out[o] = (nx * 0.5 + 0.5) * 255
            out[o + 1] = (ny * 0.5 + 0.5) * 255
            out[o + 2] = (nz * 0.5 + 0.5) * 255
            out[o + 3] = srcA
        }
    }
    return out
}

/** Per-pixel Lambert shading (Canvas2D). `surfaceOnly` ignores the albedo (lit mode). */
const shade = (
    albedo: Uint8ClampedArray,
    normal: Uint8ClampedArray,
    w: number,
    h: number,
    light: { x: number; y: number; z: number },
    surfaceOnly: boolean,
): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(w * h * 4)
    const ambient = 0.2
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4
            const ar = surfaceOnly ? 1 : albedo[o] / 255
            const ag = surfaceOnly ? 1 : albedo[o + 1] / 255
            const ab = surfaceOnly ? 1 : albedo[o + 2] / 255

            let nx = normal[o] / 127.5 - 1
            let ny = normal[o + 1] / 127.5 - 1
            let nz = normal[o + 2] / 127.5 - 1
            const nl = Math.hypot(nx, ny, nz) || 1
            nx /= nl
            ny /= nl
            nz /= nl

            const su = (x + 0.5) / w
            const sv = (y + 0.5) / h
            let lx = light.x - su
            let ly = light.y - sv
            let lz = light.z
            const ll = Math.hypot(lx, ly, lz) || 1
            lx /= ll
            ly /= ll
            lz /= ll

            const diff = Math.max(nx * lx + ny * ly + nz * lz, 0)
            out[o] = Math.min(255, ar * (ambient + diff) * 255)
            out[o + 1] = Math.min(255, ag * (ambient + diff) * 255)
            out[o + 2] = Math.min(255, ab * (ambient + diff) * 255)
            out[o + 3] = albedo[o + 3]
        }
    }
    return out
}

// ── The element ────────────────────────────────────────────────────────────────

interface ViewTransform {
    scale: number
    offsetX: number
    offsetY: number
}

export class NormalMapGenerator extends HTMLElement {
    private _initialised = false
    private _idPrefix: string
    private _internalUpdate = false
    private _sourceInternal = false

    // Source/working buffers (native, capped to MAX_DIM).
    private _source: string | File | Blob | null = null
    private _width = 0
    private _height = 0
    private _albedo: Uint8ClampedArray | null = null
    private _normal: Uint8ClampedArray | null = null
    private _paint: Float32Array | null = null
    private _mask: Uint8Array | null = null
    private _maskActive = false

    // Off-screen native-resolution canvases + the visible preview canvas.
    private _srcCanvas: HTMLCanvasElement | null = null
    private _normalCanvas: HTMLCanvasElement | null = null
    private _previewCanvas: HTMLCanvasElement | null = null
    private _view: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 }

    // Pan + paint interaction state.
    private _panX = 0
    private _panY = 0
    private _light = { x: 0.35, y: 0.3, z: 0.6 }
    private _painting = false
    private _panStart: { x: number; y: number; px: number; py: number } | null = null
    private _moveHandler: ((e: PointerEvent) => void) | null = null
    private _upHandler: (() => void) | null = null

    // Brush shape.
    private readonly _brushSize = 16
    private readonly _brushStrength = 0.6

    /** Optional callback mirroring the `tc-generate` event. */
    onGenerate: ((output: NormalMapOutput) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-nmg-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return [
            'source',
            'strength',
            'emboss-height',
            'bevel-width',
            'editable',
            'tool',
            'preview-mode',
            'disabled',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
            // Load from the URL attribute, if present, after the DOM exists.
            const attrSource = this.getAttribute('source')
            if (this._source != null) this._loadSource(this._source)
            else if (attrSource) this._loadSource(attrSource)
            else this._renderPreview()
        }
    }

    disconnectedCallback(): void {
        this._cleanupDrag()
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
        if (!this.isConnected || !this._initialised) return
        switch (name) {
            case 'source':
                if (this._sourceInternal) return
                this._source = value
                this._loadSource(value)
                break
            case 'strength':
            case 'emboss-height':
            case 'bevel-width':
                if (this._internalUpdate) return
                this._syncControls()
                this._recompute()
                break
            case 'tool':
                this._updateToolbar()
                break
            case 'preview-mode':
                this._updateSegmented()
                this._renderPreview()
                break
            case 'editable':
                this._updateToolbar()
                break
            case 'disabled':
                this._updateDisabled()
                break
        }
    }

    // ── Scalar attributes ───────────────────────────────────────────────────────

    get strength(): number {
        const v = parseFloat(this.getAttribute('strength') ?? '')
        return Number.isFinite(v) ? Math.max(0, v) : DEFAULT_STRENGTH
    }
    set strength(v: number) {
        this.setAttribute('strength', String(v))
    }

    get embossHeight(): number {
        const v = parseFloat(this.getAttribute('emboss-height') ?? '')
        return Number.isFinite(v) ? Math.max(0, v) : DEFAULT_EMBOSS
    }
    set embossHeight(v: number) {
        this.setAttribute('emboss-height', String(v))
    }

    get bevelWidth(): number {
        const v = parseFloat(this.getAttribute('bevel-width') ?? '')
        return Number.isFinite(v) ? Math.max(0, v) : DEFAULT_BEVEL
    }
    set bevelWidth(v: number) {
        this.setAttribute('bevel-width', String(v))
    }

    get editable(): boolean {
        return this.hasAttribute('editable')
    }
    set editable(v: boolean) {
        if (v) this.setAttribute('editable', '')
        else this.removeAttribute('editable')
    }

    get tool(): EditorTool {
        const v = this.getAttribute('tool') as EditorTool
        return TOOLS.includes(v) ? v : 'brush'
    }
    set tool(v: EditorTool) {
        this.setAttribute('tool', v)
    }

    get previewMode(): PreviewMode {
        const v = this.getAttribute('preview-mode') as PreviewMode
        return PREVIEW_MODES.includes(v) ? v : 'normal'
    }
    set previewMode(v: PreviewMode) {
        this.setAttribute('preview-mode', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ── source (URL string | File | Blob) ────────────────────────────────────────

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

    // ── Image loading + ingest ───────────────────────────────────────────────────

    private _loadSource(src: string | File | Blob | null): void {
        if (src == null || src === '') {
            this._albedo = null
            this._normal = null
            this._renderPreview()
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
            this._ingest(img)
        }
        img.onerror = () => {
            if (revoke) URL.revokeObjectURL(url)
            this._albedo = null
            this._normal = null
            this._renderPreview()
        }
        img.src = url
    }

    /** Rasterise the loaded image (capped to MAX_DIM) into the albedo buffer. */
    private _ingest(img: HTMLImageElement): void {
        const iw = img.naturalWidth || img.width
        const ih = img.naturalHeight || img.height
        if (iw === 0 || ih === 0) return
        const fit = Math.min(1, MAX_DIM / Math.max(iw, ih))
        const w = Math.max(1, Math.round(iw * fit))
        const h = Math.max(1, Math.round(ih * fit))

        const src = this._srcCanvas
        if (!src) return
        src.width = w
        src.height = h
        const ctx = src.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)

        this._width = w
        this._height = h
        this._albedo = ctx.getImageData(0, 0, w, h).data
        this._paint = new Float32Array(w * h)
        this._mask = new Uint8Array(w * h)
        this._maskActive = false
        if (this._normalCanvas) {
            this._normalCanvas.width = w
            this._normalCanvas.height = h
        }
        this._panX = 0
        this._panY = 0
        this._recompute()
    }

    // ── Recompute pipeline ───────────────────────────────────────────────────────

    private _recompute(): void {
        if (!this._albedo || this._width === 0) {
            this._renderPreview()
            return
        }
        const w = this._width
        const h = this._height
        const height = buildHeightmap(this._albedo, w, h, {
            embossHeight: this.embossHeight,
            bevelWidth: this.bevelWidth,
        })
        if (this._paint) {
            for (let i = 0; i < height.length; i++) height[i] += this._paint[i]
        }
        this._normal = normalsFromHeight(height, this._albedo, w, h, this.strength)
        this._drawNormalCanvas()
        this._renderPreview()
        this._emitGenerate()
    }

    private _drawNormalCanvas(): void {
        const c = this._normalCanvas
        if (!c || !this._normal) return
        const ctx = c.getContext('2d')
        if (!ctx) return
        // ImageData expects an ArrayBuffer-backed Uint8ClampedArray; ours is always
        // ArrayBuffer-backed at runtime — the cast bridges the lib.dom generic gap.
        ctx.putImageData(
            new ImageData(
                this._normal as Uint8ClampedArray<ArrayBuffer>,
                this._width,
                this._height,
            ),
            0,
            0,
        )
    }

    private _emitGenerate(): void {
        const c = this._normalCanvas
        if (!c || !this._normal) return
        const dataUrl = c.toDataURL('image/png')
        const output: NormalMapOutput = { dataUrl, width: this._width, height: this._height }
        this.dispatchEvent(
            new CustomEvent<NormalMapOutput>('tc-generate', {
                bubbles: true,
                composed: true,
                detail: output,
            }),
        )
        if (typeof this.onGenerate === 'function') this.onGenerate(output)
    }

    // ── Preview rendering ────────────────────────────────────────────────────────

    /** Returns the native-resolution canvas/imagedata source for the active preview mode. */
    private _layerCanvas(): HTMLCanvasElement | null {
        const mode = this.previewMode
        if (mode === 'albedo') return this._srcCanvas
        if (mode === 'normal') return this._normalCanvas
        // lit / lit-surface — shade into a scratch canvas.
        if (!this._albedo || !this._normal) return this._normalCanvas
        const shaded = shade(
            this._albedo,
            this._normal,
            this._width,
            this._height,
            this._light,
            mode === 'lit',
        )
        const scratch = document.createElement('canvas')
        scratch.width = this._width
        scratch.height = this._height
        const sctx = scratch.getContext('2d')
        if (sctx)
            sctx.putImageData(
                new ImageData(shaded as Uint8ClampedArray<ArrayBuffer>, this._width, this._height),
                0,
                0,
            )
        return scratch
    }

    private _renderPreview(): void {
        const canvas = this._previewCanvas
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const displayW = canvas.clientWidth
        const displayH = canvas.clientHeight
        if (displayW <= 0 || displayH <= 0) return
        canvas.width = Math.round(displayW * dpr)
        canvas.height = Math.round(displayH * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, displayW, displayH)

        if (!this._albedo || this._width === 0) {
            ctx.fillStyle = 'rgba(100, 116, 139, 0.8)'
            ctx.font = '13px system-ui, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('No source image', displayW / 2, displayH / 2)
            return
        }

        const fit = Math.min(displayW / this._width, displayH / this._height)
        const drawW = this._width * fit
        const drawH = this._height * fit
        const offsetX = (displayW - drawW) / 2 + this._panX
        const offsetY = (displayH - drawH) / 2 + this._panY
        this._view = { scale: fit, offsetX, offsetY }

        const layer = this._layerCanvas()
        if (layer) {
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(layer, offsetX, offsetY, drawW, drawH)
        }

        // Translucent selection-mask overlay.
        if (this._maskActive && this._mask) {
            this._drawMaskOverlay(ctx, offsetX, offsetY, drawW, drawH)
        }
    }

    private _drawMaskOverlay(
        ctx: CanvasRenderingContext2D,
        ox: number,
        oy: number,
        dw: number,
        dh: number,
    ): void {
        const mask = this._mask
        if (!mask) return
        const overlay = document.createElement('canvas')
        overlay.width = this._width
        overlay.height = this._height
        const octx = overlay.getContext('2d')
        if (!octx) return
        const data = new Uint8ClampedArray(this._width * this._height * 4)
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] > 0) {
                const o = i * 4
                data[o] = 34
                data[o + 1] = 211
                data[o + 2] = 238
                data[o + 3] = Math.min(160, mask[i])
            }
        }
        octx.putImageData(new ImageData(data, this._width, this._height), 0, 0)
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(overlay, ox, oy, dw, dh)
    }

    // ── Pointer interaction (paint / pan / light) ────────────────────────────────

    private _onPointerDown = (e: PointerEvent): void => {
        if (this.disabled || !this._albedo) return
        const tool = this.tool
        if (tool === 'pan') {
            this._panStart = { x: e.clientX, y: e.clientY, px: this._panX, py: this._panY }
        } else {
            if (!this.editable) return
            this._painting = true
            this._stampAt(e)
        }
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        this._moveHandler = (ev: PointerEvent) => this._onPointerMove(ev)
        this._upHandler = () => this._onPointerUp()
        document.addEventListener('pointermove', this._moveHandler)
        document.addEventListener('pointerup', this._upHandler)
        document.addEventListener('pointercancel', this._upHandler)
        e.preventDefault()
    }

    private _onPointerMove(e: PointerEvent): void {
        if (this._panStart) {
            this._panX = this._panStart.px + (e.clientX - this._panStart.x)
            this._panY = this._panStart.py + (e.clientY - this._panStart.y)
            this._renderPreview()
        } else if (this._painting) {
            this._stampAt(e)
            this._drawNormalCanvas()
            this._renderPreview()
        }
    }

    private _onPointerUp(): void {
        const wasPainting = this._painting
        const wasMask = this.tool === 'mask'
        this._painting = false
        this._panStart = null
        this._cleanupDrag()
        // A completed brush/erase stroke re-derives the normal map + fires the event.
        if (wasPainting && !wasMask) this._recompute()
        else if (wasPainting && wasMask) this._renderPreview()
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

    /** Light tracks the cursor over the preview in lit modes (when not dragging). */
    private _onPointerHover = (e: PointerEvent): void => {
        if (this._painting || this._panStart) return
        const mode = this.previewMode
        if (mode !== 'lit' && mode !== 'lit-surface') return
        if (!this._albedo) return
        const p = this._toSource(e)
        this._light.x = Math.max(0, Math.min(1, p.x / this._width))
        this._light.y = Math.max(0, Math.min(1, p.y / this._height))
        this._renderPreview()
    }

    private _toSource(e: PointerEvent): { x: number; y: number } {
        const canvas = this._previewCanvas!
        const rect = canvas.getBoundingClientRect()
        const cssX = e.clientX - rect.left
        const cssY = e.clientY - rect.top
        const { scale, offsetX, offsetY } = this._view
        return { x: (cssX - offsetX) / scale, y: (cssY - offsetY) / scale }
    }

    /** Paints the active tool into the working buffer at the pointer position. */
    private _stampAt(e: PointerEvent): void {
        const p = this._toSource(e)
        const cx = Math.round(p.x)
        const cy = Math.round(p.y)
        const r = this._brushSize
        const tool = this.tool
        const w = this._width
        const h = this._height
        const paint = this._paint
        const mask = this._mask
        for (let y = cy - r; y <= cy + r; y++) {
            if (y < 0 || y >= h) continue
            for (let x = cx - r; x <= cx + r; x++) {
                if (x < 0 || x >= w) continue
                const dx = x - cx
                const dy = y - cy
                const d = Math.hypot(dx, dy)
                if (d > r) continue
                const falloff = 1 - d / r
                const weight = falloff * this._brushStrength
                const i = y * w + x
                if (tool === 'brush' && paint) {
                    paint[i] += weight
                } else if (tool === 'erase' && paint) {
                    paint[i] *= Math.max(0, 1 - weight)
                } else if (tool === 'mask' && mask) {
                    mask[i] = Math.max(mask[i], Math.round(weight * 255))
                    this._maskActive = true
                }
            }
        }
    }

    // ── Control wiring ───────────────────────────────────────────────────────────

    private _el<T extends HTMLElement = HTMLElement>(suffix: string): T | null {
        return this.querySelector<T>(`#${this._idPrefix}-${suffix}`)
    }

    private _onControlInput = (e: Event): void => {
        if (this.disabled) return
        const target = e.target as HTMLInputElement
        const field = target.getAttribute('data-field')
        if (!field) return
        const attr = field // strength | emboss-height | bevel-width
        this._internalUpdate = true
        this.setAttribute(attr, target.value)
        this._internalUpdate = false
        this._updateControlLabel(field, target.value)
        this._recompute()
    }

    private _onToolbarClick = (e: Event): void => {
        if (this.disabled) return
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]')
        if (btn) {
            const tool = btn.getAttribute('data-tool') as EditorTool
            if (!this.editable && tool !== 'pan') return
            this.tool = tool
            return
        }
        const seg = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]')
        if (seg) {
            this.previewMode = seg.getAttribute('data-mode') as PreviewMode
        }
    }

    private _updateControlLabel(field: string, value: string): void {
        const out = this._el(`${field}-value`)
        if (out) out.textContent = value
    }

    private _syncControls(): void {
        const set = (field: string, value: string) => {
            const el = this._el<HTMLInputElement>(field)
            if (el) el.value = value
            this._updateControlLabel(field, value)
        }
        set('strength', String(this.strength))
        set('emboss-height', String(this.embossHeight))
        set('bevel-width', String(this.bevelWidth))
    }

    private _updateToolbar(): void {
        const tool = this.tool
        const editable = this.editable
        this.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
            const t = btn.getAttribute('data-tool') as EditorTool
            const active = t === tool
            btn.classList.toggle('tc-nmg-tool--active', active)
            btn.setAttribute('aria-pressed', active ? 'true' : 'false')
            // Paint tools require `editable`; pan is always available.
            const enabled = editable || t === 'pan'
            btn.disabled = !enabled
        })
    }

    private _updateSegmented(): void {
        const mode = this.previewMode
        this.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) => {
            const active = btn.getAttribute('data-mode') === mode
            btn.classList.toggle('tc-nmg-seg--active', active)
            btn.setAttribute('aria-selected', active ? 'true' : 'false')
            btn.tabIndex = active ? 0 : -1
        })
    }

    private _updateDisabled(): void {
        const disabled = this.disabled
        const root = this.querySelector('.tc-normal-map-generator')
        if (root) {
            root.classList.toggle('tc-normal-map-generator--disabled', disabled)
            if (disabled) root.setAttribute('aria-disabled', 'true')
            else root.removeAttribute('aria-disabled')
        }
    }

    // ── Markup ───────────────────────────────────────────────────────────────────

    private _toolButtonsHtml(): string {
        return TOOL_META.map(
            ({ tool, label, iconHtml }) =>
                `<button type="button" class="tc-nmg-tool" data-tool="${tool}" aria-label="${label} tool" aria-pressed="false">${iconHtml}</button>`,
        ).join('')
    }

    private _segmentsHtml(): string {
        return PREVIEW_META.map(
            ({ mode, label }) =>
                `<button type="button" class="tc-nmg-seg" data-mode="${mode}" role="tab" aria-selected="false" tabindex="-1">${label}</button>`,
        ).join('')
    }

    private _sliderHtml(
        field: string,
        label: string,
        min: string,
        max: string,
        step: string,
    ): string {
        const id = `${this._idPrefix}-${field}`
        return (
            `<div class="tc-nmg-control">` +
            `<label class="tc-nmg-control-label" for="${id}">${label}</label>` +
            `<input class="tc-nmg-range" type="range" id="${id}" data-field="${field}" min="${min}" max="${max}" step="${step}">` +
            `<output class="tc-nmg-control-value" id="${id}-value"></output>` +
            `</div>`
        )
    }

    private render(): void {
        const disabled = this.disabled

        this.innerHTML =
            `<div class="tc-normal-map-generator${disabled ? ' tc-normal-map-generator--disabled' : ''}"${disabled ? ' aria-disabled="true"' : ''}>` +
            `<div class="tc-nmg-toolbar" role="toolbar" aria-label="Normal map editor tools">` +
            `<div class="tc-nmg-tools" aria-label="Editing tools">${this._toolButtonsHtml()}</div>` +
            `<div class="tc-nmg-segmented" role="tablist" aria-label="Preview mode">${this._segmentsHtml()}</div>` +
            `</div>` +
            `<div class="tc-nmg-stage">` +
            `<canvas class="tc-nmg-canvas" id="${this._idPrefix}-preview" aria-label="Normal map preview and editing canvas"></canvas>` +
            `</div>` +
            `<div class="tc-nmg-params">` +
            this._sliderHtml('strength', 'Strength', '0', '5', '0.1') +
            this._sliderHtml('emboss-height', 'Emboss', '0', '5', '0.1') +
            this._sliderHtml('bevel-width', 'Bevel', '0', '32', '1') +
            `</div>` +
            `</div>`

        this._previewCanvas = this._el<HTMLCanvasElement>('preview')

        // Off-screen native-resolution canvases (never inserted into the DOM).
        if (!this._srcCanvas) this._srcCanvas = document.createElement('canvas')
        if (!this._normalCanvas) this._normalCanvas = document.createElement('canvas')

        // Delegated listeners on the fresh container (replaced wholesale per render).
        const root = this.querySelector('.tc-normal-map-generator')
        if (root) {
            root.addEventListener('input', this._onControlInput)
            root.addEventListener('click', this._onToolbarClick)
        }
        if (this._previewCanvas) {
            this._previewCanvas.addEventListener('pointerdown', this._onPointerDown)
            this._previewCanvas.addEventListener('pointermove', this._onPointerHover)
        }

        this._syncControls()
        this._updateToolbar()
        this._updateSegmented()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: NormalMapGenerator
    }
}

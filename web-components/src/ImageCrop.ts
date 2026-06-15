import { Check } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-image-crop'

// User-zoom clamp. At scale 1 the image is sized to *cover* the crop frame
// (baseScale), so 1 is the minimum that keeps the window fully covered; the
// pan-clamp relies on this invariant.
const MIN_SCALE = 1
const MAX_SCALE = 5
// Margin (CSS px) between the crop frame and the stage edge — leaves room for
// the dimmed scrim so the user can see what they are panning past.
const FRAME_MARGIN = 20

const checkIconHtml = icon(Check, 'tc-image-crop-apply-icon')

function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v))
}

interface Geometry {
    stageW: number
    stageH: number
    frameX: number
    frameY: number
    frameW: number
    frameH: number
    baseScale: number
}

interface ImageBox {
    drawW: number
    drawH: number
    imgLeft: number
    imgTop: number
}

export class ImageCrop extends HTMLElement {

    private _initialised = false

    // Crop transform — preserved across attribute-driven re-renders; reset only
    // when a new `src` is loaded.
    private _scale = 1
    private _panX = 0
    private _panY = 0

    // Offscreen source image + load state.
    private _img: HTMLImageElement | null = null
    private _pendingImg: HTMLImageElement | null = null
    private _loaded = false

    private _raf: number | null = null
    private _resizeObserver: ResizeObserver | null = null

    // Per-drag document listeners (drag lifetime, not element lifetime).
    private _dragMove: ((e: PointerEvent) => void) | null = null
    private _dragUp: ((e: PointerEvent) => void) | null = null
    private _dragOrigX = 0
    private _dragOrigY = 0
    private _dragStartX = 0
    private _dragStartY = 0

    /** Optional callback mirroring the `tc-crop` event. */
    onCrop: ((blob: Blob) => void) | null = null
    /** Optional callback mirroring the `tc-error` event. */
    onError: ((error: Error) => void) | null = null

    static get observedAttributes(): string[] {
        return ['src', 'aspect-ratio', 'circular']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._observeResize()
        this._loadImage()
    }

    disconnectedCallback(): void {
        if (this._raf != null) {
            cancelAnimationFrame(this._raf)
            this._raf = null
        }
        this._cleanupDrag()
        if (this._resizeObserver) {
            this._resizeObserver.disconnect()
            this._resizeObserver = null
        }
        this._pendingImg = null
    }

    attributeChangedCallback(name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'src') {
            this.render()
            this._loadImage()
            return
        }
        // aspect-ratio / circular: keep the current transform but re-render the
        // mask + toolbar and redraw (the frame geometry may have changed).
        this.render()
        this._scheduleDraw()
    }

    // ── Props ─────────────────────────────────────────────────────────────────

    get src(): string {
        return this.getAttribute('src') ?? ''
    }
    set src(v: string) {
        this.setAttribute('src', v)
    }

    get aspectRatio(): number {
        const raw = parseFloat(this.getAttribute('aspect-ratio') ?? '')
        return Number.isFinite(raw) && raw > 0 ? raw : 1
    }
    set aspectRatio(v: number) {
        if (Number.isFinite(v) && v > 0) this.setAttribute('aspect-ratio', String(v))
        else this.removeAttribute('aspect-ratio')
    }

    get circular(): boolean {
        return this.hasAttribute('circular')
    }
    set circular(v: boolean) {
        if (v) this.setAttribute('circular', '')
        else this.removeAttribute('circular')
    }

    // ── Image loading ───────────────────────────────────────────────────────────

    private _loadImage(): void {
        const src = this.src
        this._loaded = false
        this._img = null
        this._pendingImg = null
        this._scale = 1
        this._panX = 0
        this._panY = 0
        this._syncSlider()
        this._updateError(null)

        if (!src) {
            this._scheduleDraw()
            return
        }

        const img = new Image()
        // A CORS-blocked image used to fail silently (blank canvas forever) —
        // request anonymous credentials so same-origin exports stay untainted,
        // and surface real failures via onerror.
        img.crossOrigin = 'anonymous'
        this._pendingImg = img
        img.onload = () => {
            if (this._pendingImg !== img) return // superseded by a newer src
            this._img = img
            this._loaded = true
            this._pendingImg = null
            this._scheduleDraw()
        }
        img.onerror = () => {
            if (this._pendingImg !== img) return
            this._pendingImg = null
            this._updateError('Failed to load image.')
            this._emitError(new Error(`tc-image-crop: failed to load image "${src}"`))
        }
        img.src = src
    }

    // ── Geometry ──────────────────────────────────────────────────────────────

    private _canvas(): HTMLCanvasElement | null {
        return this.querySelector<HTMLCanvasElement>('.tc-image-crop-canvas')
    }

    private _geometry(canvas: HTMLCanvasElement): Geometry | null {
        const stageW = canvas.clientWidth
        const stageH = canvas.clientHeight
        if (stageW <= 0 || stageH <= 0) return null

        const ar = this.aspectRatio
        const availW = Math.max(1, stageW - FRAME_MARGIN * 2)
        const availH = Math.max(1, stageH - FRAME_MARGIN * 2)
        let frameW = availW
        let frameH = frameW / ar
        if (frameH > availH) {
            frameH = availH
            frameW = frameH * ar
        }
        const frameX = (stageW - frameW) / 2
        const frameY = (stageH - frameH) / 2

        let baseScale = 1
        if (this._img && this._img.naturalWidth > 0 && this._img.naturalHeight > 0) {
            baseScale = Math.max(frameW / this._img.naturalWidth, frameH / this._img.naturalHeight)
        }
        return { stageW, stageH, frameX, frameY, frameW, frameH, baseScale }
    }

    private _imageBox(g: Geometry, scale = this._scale): ImageBox {
        const img = this._img!
        const total = g.baseScale * scale
        const drawW = img.naturalWidth * total
        const drawH = img.naturalHeight * total
        const frameCx = g.frameX + g.frameW / 2
        const frameCy = g.frameY + g.frameH / 2
        const imgLeft = frameCx - drawW / 2 + this._panX
        const imgTop = frameCy - drawH / 2 + this._panY
        return { drawW, drawH, imgLeft, imgTop }
    }

    private _clampPan(g: Geometry): void {
        if (!this._img) return
        const box = this._imageBox(g)
        const maxX = Math.max(0, (box.drawW - g.frameW) / 2)
        const maxY = Math.max(0, (box.drawH - g.frameH) / 2)
        this._panX = clamp(this._panX, -maxX, maxX)
        this._panY = clamp(this._panY, -maxY, maxY)
    }

    // ── Zoom ──────────────────────────────────────────────────────────────────

    /** Set the user zoom, keeping the point (anchorX, anchorY) fixed on screen. */
    private _setScale(next: number, anchorX?: number, anchorY?: number): void {
        const canvas = this._canvas()
        if (!canvas || !this._img) return
        const g = this._geometry(canvas)
        if (!g) return

        const clamped = clamp(next, MIN_SCALE, MAX_SCALE)
        const ax = anchorX ?? g.frameX + g.frameW / 2
        const ay = anchorY ?? g.frameY + g.frameH / 2

        const before = this._imageBox(g)
        const fx = before.drawW ? (ax - before.imgLeft) / before.drawW : 0.5
        const fy = before.drawH ? (ay - before.imgTop) / before.drawH : 0.5

        this._scale = clamped
        const after = this._imageBox(g) // drawW/drawH only depend on the new scale
        const frameCx = g.frameX + g.frameW / 2
        const frameCy = g.frameY + g.frameH / 2
        this._panX = ax - fx * after.drawW - (frameCx - after.drawW / 2)
        this._panY = ay - fy * after.drawH - (frameCy - after.drawH / 2)

        this._clampPan(g)
        this._syncSlider()
        this._scheduleDraw()
    }

    private _syncSlider(): void {
        const slider = this.querySelector<HTMLInputElement>('.tc-image-crop-zoom')
        if (slider) slider.value = String(this._scale)
    }

    // ── Drawing ───────────────────────────────────────────────────────────────

    private _scheduleDraw(): void {
        if (this._raf != null) return
        this._raf = requestAnimationFrame(() => {
            this._raf = null
            this._draw()
        })
    }

    private _draw(): void {
        const canvas = this._canvas()
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const g = this._geometry(canvas)
        if (!g) return

        this._clampPan(g)
        this._positionWindow(g)

        // Respect device pixel ratio for a crisp stage.
        const dpr = window.devicePixelRatio || 1
        const pw = Math.max(1, Math.round(g.stageW * dpr))
        const ph = Math.max(1, Math.round(g.stageH * dpr))
        if (canvas.width !== pw) canvas.width = pw
        if (canvas.height !== ph) canvas.height = ph

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, g.stageW, g.stageH)

        if (this._loaded && this._img) {
            const box = this._imageBox(g)
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(this._img, box.imgLeft, box.imgTop, box.drawW, box.drawH)
        }
    }

    /** Place the DOM crop window (the transparent cutout + scrim) over the frame. */
    private _positionWindow(g: Geometry): void {
        const win = this.querySelector<HTMLElement>('.tc-image-crop-window')
        if (!win) return
        win.style.left = `${g.frameX}px`
        win.style.top = `${g.frameY}px`
        win.style.width = `${g.frameW}px`
        win.style.height = `${g.frameH}px`
    }

    // ── Pointer / wheel / keyboard interaction ──────────────────────────────────

    private _onPointerDown = (e: PointerEvent): void => {
        if (!this._loaded) return
        e.preventDefault()
        const canvas = this._canvas()
        if (!canvas) return
        // setPointerCapture throws if the pointer is already gone (fast tap) —
        // the drag still works without capture, so don't let it crash.
        try {
            canvas.setPointerCapture(e.pointerId)
        } catch {
            /* ignore */
        }
        this._dragStartX = e.clientX
        this._dragStartY = e.clientY
        this._dragOrigX = this._panX
        this._dragOrigY = this._panY
        this.querySelector('.tc-image-crop-stage')?.classList.add('tc-image-crop-stage--grabbing')

        this._cleanupDrag()
        this._dragMove = (ev: PointerEvent) => {
            this._panX = this._dragOrigX + (ev.clientX - this._dragStartX)
            this._panY = this._dragOrigY + (ev.clientY - this._dragStartY)
            this._scheduleDraw()
        }
        this._dragUp = () => this._cleanupDrag()
        document.addEventListener('pointermove', this._dragMove)
        document.addEventListener('pointerup', this._dragUp)
        document.addEventListener('pointercancel', this._dragUp)
    }

    private _cleanupDrag(): void {
        if (this._dragMove) document.removeEventListener('pointermove', this._dragMove)
        if (this._dragUp) {
            document.removeEventListener('pointerup', this._dragUp)
            document.removeEventListener('pointercancel', this._dragUp)
        }
        this._dragMove = null
        this._dragUp = null
        this.querySelector('.tc-image-crop-stage')?.classList.remove('tc-image-crop-stage--grabbing')
    }

    private _onWheel = (e: WheelEvent): void => {
        if (!this._loaded) return
        e.preventDefault()
        const canvas = this._canvas()
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const cursorX = e.clientX - rect.left
        const cursorY = e.clientY - rect.top
        this._setScale(this._scale - e.deltaY * 0.0025, cursorX, cursorY)
    }

    private _onCanvasKeyDown = (e: KeyboardEvent): void => {
        if (!this._loaded) return
        const step = 12
        switch (e.key) {
            case 'ArrowLeft':
                this._panX += step
                break
            case 'ArrowRight':
                this._panX -= step
                break
            case 'ArrowUp':
                this._panY += step
                break
            case 'ArrowDown':
                this._panY -= step
                break
            case '+':
            case '=':
                this._setScale(this._scale + 0.1)
                e.preventDefault()
                return
            case '-':
            case '_':
                this._setScale(this._scale - 0.1)
                e.preventDefault()
                return
            default:
                return
        }
        e.preventDefault()
        this._scheduleDraw()
    }

    private _onZoomInput = (e: Event): void => {
        const v = parseFloat((e.target as HTMLInputElement).value)
        if (Number.isFinite(v)) this._setScale(v)
    }

    private _onReset = (): void => {
        this._scale = 1
        this._panX = 0
        this._panY = 0
        this._syncSlider()
        this._scheduleDraw()
    }

    // ── Crop / output ───────────────────────────────────────────────────────────

    private _onApply = (): void => {
        const canvas = this._canvas()
        if (!canvas || !this._loaded || !this._img) {
            this._emitError(new Error('tc-image-crop: no image loaded to crop'))
            return
        }
        const g = this._geometry(canvas)
        if (!g) return

        const dpr = window.devicePixelRatio || 1
        const outW = Math.max(1, Math.round(g.frameW * dpr))
        const outH = Math.max(1, Math.round(g.frameH * dpr))
        const out = document.createElement('canvas')
        out.width = outW
        out.height = outH
        const octx = out.getContext('2d')
        if (!octx) {
            this._emitError(new Error('tc-image-crop: could not acquire output 2D context'))
            return
        }

        if (this.circular) {
            octx.beginPath()
            octx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2)
            octx.clip()
        }

        // Map the on-stage image into the frame region, scaled to output px.
        const box = this._imageBox(g)
        octx.imageSmoothingQuality = 'high'
        octx.drawImage(
            this._img,
            (box.imgLeft - g.frameX) * dpr,
            (box.imgTop - g.frameY) * dpr,
            box.drawW * dpr,
            box.drawH * dpr,
        )

        out.toBlob((blob) => {
            if (blob) {
                this._emitCrop(blob)
            } else {
                // null blob = tainted canvas (image served without CORS headers)
                this._emitError(new Error('tc-image-crop: canvas export failed (tainted canvas?)'))
            }
        }, 'image/png')
    }

    private _emitCrop(blob: Blob): void {
        this.dispatchEvent(new CustomEvent('tc-crop', { bubbles: true, composed: true, detail: { blob } }))
        if (typeof this.onCrop === 'function') this.onCrop(blob)
    }

    private _emitError(error: Error): void {
        this.dispatchEvent(new CustomEvent('tc-error', { bubbles: true, composed: true, detail: { error } }))
        if (typeof this.onError === 'function') this.onError(error)
    }

    private _updateError(message: string | null): void {
        const el = this.querySelector('.tc-image-crop-error')
        if (!el) return
        if (message) {
            el.textContent = message
            el.removeAttribute('hidden')
        } else {
            el.textContent = ''
            el.setAttribute('hidden', '')
        }
    }

    // ── Resize ────────────────────────────────────────────────────────────────

    private _observeResize(): void {
        if (this._resizeObserver || typeof ResizeObserver === 'undefined') return
        const canvas = this._canvas()
        if (!canvas) return
        this._resizeObserver = new ResizeObserver(() => this._scheduleDraw())
        this._resizeObserver.observe(canvas)
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private render(): void {
        this.classList.add('tc-image-crop')
        this.classList.toggle('tc-image-crop--circular', this.circular)

        this.innerHTML = [
            '<div class="tc-image-crop-stage">',
            '<canvas class="tc-image-crop-canvas" tabindex="0" role="img"',
            ' aria-label="Image crop area. Drag to reposition, scroll or use the zoom slider to zoom, arrow keys to pan."></canvas>',
            '<div class="tc-image-crop-mask" aria-hidden="true"><div class="tc-image-crop-window"></div></div>',
            '</div>',
            '<div class="tc-image-crop-error" role="alert" hidden></div>',
            '<div class="tc-image-crop-toolbar">',
            '<label class="tc-image-crop-zoom-field">',
            '<span class="tc-image-crop-zoom-label">Zoom</span>',
            `<input class="tc-image-crop-zoom" type="range" min="${MIN_SCALE}" max="${MAX_SCALE}" step="0.01"`,
            ` value="${this._scale}" aria-label="Zoom">`,
            '</label>',
            '<div class="tc-image-crop-actions">',
            '<button type="button" class="tc-image-crop-btn tc-image-crop-btn--ghost tc-image-crop-reset">Reset</button>',
            '<button type="button" class="tc-image-crop-btn tc-image-crop-btn--primary tc-image-crop-apply">',
            checkIconHtml,
            '<span>Apply</span>',
            '</button>',
            '</div>',
            '</div>',
        ].join('')

        this._bind()
    }

    /** Wire listeners to the freshly-rendered elements (re-run on every render). */
    private _bind(): void {
        const canvas = this._canvas()
        if (canvas) {
            canvas.addEventListener('pointerdown', this._onPointerDown)
            canvas.addEventListener('wheel', this._onWheel, { passive: false })
            canvas.addEventListener('keydown', this._onCanvasKeyDown)
        }
        this.querySelector<HTMLInputElement>('.tc-image-crop-zoom')?.addEventListener('input', this._onZoomInput)
        this.querySelector('.tc-image-crop-reset')?.addEventListener('click', this._onReset)
        this.querySelector('.tc-image-crop-apply')?.addEventListener('click', this._onApply)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ImageCrop
    }
}

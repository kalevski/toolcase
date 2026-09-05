import { patchHtml } from './internal/patch-html'
import { cssLength } from './internal/cssLength'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-bitmap-font-generator'

// ── Public type surface (mirrors @toolcase/react-components BitmapFontGenerator) ──

export interface BitmapFontFill {
    type: 'solid' | 'gradient'
    color?: string
    gradientColors?: string[]
    gradientAngle?: number
    /** Gradient shape. Defaults to `linear`. */
    gradientType?: 'linear' | 'radial'
}

export interface BitmapFontBorder {
    color: string
    thickness: number
    /** Where the stroke sits relative to the glyph edge. Defaults to `center`. */
    align?: 'inner' | 'outer' | 'center'
}

export interface BitmapFontDropShadow {
    color: string
    size: number
    /** Horizontal offset. Defaults to `size * 0.5`. */
    offsetX?: number
    /** Vertical offset. Defaults to `size * 0.5`. */
    offsetY?: number
    /** Blur radius. Defaults to `size`. */
    blur?: number
}

/** Symmetric outer glow (a blurred, zero-offset halo). */
export interface BitmapFontGlow {
    color: string
    size: number
}

export type BitmapFontExportFormat = 'xml' | 'json' | 'fnt'
const EXPORT_FORMATS: BitmapFontExportFormat[] = ['xml', 'json', 'fnt']

export type BitmapFontPreviewAlign = 'start' | 'center' | 'end'
const PREVIEW_ALIGNS: BitmapFontPreviewAlign[] = ['start', 'center', 'end']

export interface BitmapFontGlyph {
    char: string
    x: number
    y: number
    width: number
    height: number
    xOffset: number
    yOffset: number
    xAdvance: number
}

export interface BitmapFontOutput {
    png: Blob
    /** Always the BMFont XML, regardless of `exportFormat` (back-compat). */
    xml: string
    /** Serialized descriptor in the chosen `exportFormat`. */
    text: string
    format: BitmapFontExportFormat
    glyphs: BitmapFontGlyph[]
    width: number
    height: number
}

const DEFAULT_FONT = 'Arial'
const DEFAULT_TEXT = 'Hello World!'
const DEFAULT_GLYPHS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?-+:;\'"()[]{}/@#$%^&*~`<>=_\\|'

const DEFAULT_FILL_COLOR = '#ffffff'
const DEFAULT_BORDER_COLOR = '#000000'
const DEFAULT_BORDER_THICKNESS = 2
const DEFAULT_SHADOW_COLOR = '#000000'
const DEFAULT_SHADOW_SIZE = 4
const DEFAULT_GLOW_COLOR = '#00e5ff'
const DEFAULT_GLOW_SIZE = 8
const BORDER_ALIGNS: Array<NonNullable<BitmapFontBorder['align']>> = ['inner', 'outer', 'center']

// ── Pure renderer (ported verbatim from the React implementation) ──────────────

interface ResolvedEffect {
    color: string
    blur: number
    offsetX: number
    offsetY: number
}

/** Fully-resolved, scale-applied generation config used by the renderer. */
interface RenderConfig {
    fontFamily: string
    fontSize: number
    fill: BitmapFontFill
    borders: BitmapFontBorder[]
    shadow?: ResolvedEffect
    glow?: ResolvedEffect
    padding: number
    letterSpacing: number
}

const uniqueChars = (str: string): string => {
    const seen = new Set<string>()
    let result = ''
    for (const ch of str) {
        if (!seen.has(ch)) {
            seen.add(ch)
            result += ch
        }
    }
    return result
}

const nextPow2 = (n: number): number => {
    let p = 1
    while (p < n) p <<= 1
    return p
}

const resolveShadow = (
    ds: BitmapFontDropShadow | undefined,
    scale: number,
): ResolvedEffect | undefined => {
    if (!ds || ds.size <= 0) return undefined
    return {
        color: ds.color,
        blur: (ds.blur ?? ds.size) * scale,
        offsetX: (ds.offsetX ?? ds.size * 0.5) * scale,
        offsetY: (ds.offsetY ?? ds.size * 0.5) * scale,
    }
}

const resolveGlow = (
    glow: BitmapFontGlow | undefined,
    scale: number,
): ResolvedEffect | undefined => {
    if (!glow || glow.size <= 0) return undefined
    return { color: glow.color, blur: glow.size * scale, offsetX: 0, offsetY: 0 }
}

/** Builds the renderer config, applying `scale` to every geometric value. */
const resolveConfig = (props: {
    fontFamily: string
    fontSize: number
    fill: BitmapFontFill
    padding: number
    letterSpacing: number
    borders: BitmapFontBorder[]
    dropShadow?: BitmapFontDropShadow
    glow?: BitmapFontGlow
    scale: number
}): RenderConfig => {
    const s = props.scale
    return {
        fontFamily: props.fontFamily,
        fontSize: props.fontSize * s,
        fill: props.fill,
        borders: props.borders.map((b) => ({ ...b, thickness: b.thickness * s })),
        shadow: resolveShadow(props.dropShadow, s),
        glow: resolveGlow(props.glow, s),
        padding: props.padding * s,
        letterSpacing: props.letterSpacing * s,
    }
}

const maxBorderThickness = (borders: BitmapFontBorder[]): number =>
    borders.reduce((m, b) => Math.max(m, b.thickness), 0)

/** Maximum px any effect bleeds past the glyph bounds. */
const effectExtent = (cfg: RenderConfig): number => {
    const shadow = cfg.shadow
        ? cfg.shadow.blur + Math.max(Math.abs(cfg.shadow.offsetX), Math.abs(cfg.shadow.offsetY))
        : 0
    const glow = cfg.glow ? cfg.glow.blur : 0
    return Math.max(shadow, glow)
}

const createFillStyle = (
    ctx: CanvasRenderingContext2D,
    fill: BitmapFontFill,
    gx: number,
    gy: number,
    gw: number,
    gh: number,
): string | CanvasGradient => {
    if (fill.type === 'solid' || !fill.gradientColors?.length) {
        return fill.color ?? DEFAULT_FILL_COLOR
    }
    const cx = gx + gw / 2
    const cy = gy + gh / 2
    const colors = fill.gradientColors
    let gradient: CanvasGradient
    if (fill.gradientType === 'radial') {
        gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(gw, gh) / 2)
    } else {
        const rad = ((fill.gradientAngle ?? 0) * Math.PI) / 180
        const len = Math.max(gw, gh) / 2
        gradient = ctx.createLinearGradient(
            cx - Math.cos(rad) * len,
            cy - Math.sin(rad) * len,
            cx + Math.cos(rad) * len,
            cy + Math.sin(rad) * len,
        )
    }
    colors.forEach((c, i) => gradient.addColorStop(i / Math.max(colors.length - 1, 1), c))
    return gradient
}

const measureGlyphs = (
    ctx: CanvasRenderingContext2D,
    chars: string,
    cfg: RenderConfig,
): { widths: number[]; maxHeight: number; ascent: number } => {
    ctx.font = `${cfg.fontSize}px "${cfg.fontFamily}"`
    const metrics = ctx.measureText('M')
    const ascent = metrics.actualBoundingBoxAscent ?? cfg.fontSize * 0.8
    const descent = metrics.actualBoundingBoxDescent ?? cfg.fontSize * 0.2
    const baseHeight = Math.ceil(ascent + descent)

    const border = maxBorderThickness(cfg.borders)
    const extra = border * 2 + effectExtent(cfg) + cfg.padding * 2
    const maxHeight = baseHeight + extra

    const widths: number[] = []
    for (const ch of chars) {
        const m = ctx.measureText(ch)
        widths.push(Math.ceil(m.width) + extra + cfg.letterSpacing)
    }

    return { widths, maxHeight, ascent: Math.ceil(ascent) }
}

/** Paints a blurred/offset copy of the glyph to cast a shadow or glow. */
const castEffect = (
    ctx: CanvasRenderingContext2D,
    char: string,
    x: number,
    y: number,
    fx: ResolvedEffect,
) => {
    ctx.save()
    ctx.shadowColor = fx.color
    ctx.shadowBlur = fx.blur
    ctx.shadowOffsetX = fx.offsetX
    ctx.shadowOffsetY = fx.offsetY
    // The source paint is covered by the real fill/borders later; only its
    // shadow survives. Use the effect colour so a zero-blur glow still reads.
    ctx.fillStyle = fx.color
    ctx.fillText(char, x, y)
    ctx.restore()
}

const renderGlyph = (
    ctx: CanvasRenderingContext2D,
    char: string,
    x: number,
    y: number,
    cfg: RenderConfig,
    cellHeight: number,
) => {
    ctx.font = `${cfg.fontSize}px "${cfg.fontFamily}"`
    ctx.textBaseline = 'top'

    const pad = maxBorderThickness(cfg.borders) + cfg.padding
    const drawX = x + pad
    const drawY = y + pad

    if (cfg.glow) castEffect(ctx, char, drawX, drawY, cfg.glow)
    if (cfg.shadow) castEffect(ctx, char, drawX, drawY, cfg.shadow)

    // Outer/center borders, thickest first → concentric rings under the fill.
    const outer = cfg.borders
        .filter((b) => b.align !== 'inner')
        .sort((a, b) => b.thickness - a.thickness)
    ctx.lineJoin = 'round'
    for (const b of outer) {
        if (b.thickness <= 0) continue
        ctx.strokeStyle = b.color
        ctx.lineWidth = b.align === 'center' ? b.thickness : b.thickness * 2
        ctx.strokeText(char, drawX, drawY)
    }

    const charW = ctx.measureText(char).width
    ctx.fillStyle = createFillStyle(ctx, cfg.fill, drawX, drawY, charW, cellHeight)
    ctx.fillText(char, drawX, drawY)

    // Inner borders clip to the painted fill via source-atop.
    const inner = cfg.borders.filter((b) => b.align === 'inner')
    if (inner.length) {
        ctx.save()
        ctx.globalCompositeOperation = 'source-atop'
        ctx.lineJoin = 'round'
        for (const b of inner) {
            if (b.thickness <= 0) continue
            ctx.strokeStyle = b.color
            ctx.lineWidth = b.thickness * 2
            ctx.strokeText(char, drawX, drawY)
        }
        ctx.restore()
    }
}

const buildXml = (
    fontFamily: string,
    fontSize: number,
    lineHeight: number,
    base: number,
    width: number,
    height: number,
    glyphs: BitmapFontGlyph[],
): string => {
    const pageFile = `${fontFamily.replace(/\s/g, '_')}_${fontSize}.png`
    const lines = [
        '<?xml version="1.0"?>',
        `<font>`,
        `  <info face="${fontFamily}" size="${fontSize}" />`,
        `  <common lineHeight="${lineHeight}" base="${base}" scaleW="${width}" scaleH="${height}" pages="1" />`,
        `  <pages>`,
        `    <page id="0" file="${pageFile}" />`,
        `  </pages>`,
        `  <chars count="${glyphs.length}">`,
    ]
    for (const g of glyphs) {
        lines.push(
            `    <char id="${g.char.charCodeAt(0)}" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" xoffset="${g.xOffset}" yoffset="${g.yOffset}" xadvance="${g.xAdvance}" page="0" />`,
        )
    }
    lines.push(`  </chars>`, `</font>`)
    return lines.join('\n')
}

const buildFnt = (
    fontFamily: string,
    fontSize: number,
    lineHeight: number,
    base: number,
    width: number,
    height: number,
    glyphs: BitmapFontGlyph[],
): string => {
    const pageFile = `${fontFamily.replace(/\s/g, '_')}_${fontSize}.png`
    const lines = [
        `info face="${fontFamily}" size=${fontSize} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=0,0`,
        `common lineHeight=${lineHeight} base=${base} scaleW=${width} scaleH=${height} pages=1 packed=0`,
        `page id=0 file="${pageFile}"`,
        `chars count=${glyphs.length}`,
    ]
    for (const g of glyphs) {
        lines.push(
            `char id=${g.char.charCodeAt(0)} x=${g.x} y=${g.y} width=${g.width} height=${g.height} xoffset=${g.xOffset} yoffset=${g.yOffset} xadvance=${g.xAdvance} page=0 chnl=15`,
        )
    }
    return lines.join('\n')
}

const buildJson = (
    fontFamily: string,
    fontSize: number,
    lineHeight: number,
    base: number,
    width: number,
    height: number,
    glyphs: BitmapFontGlyph[],
): string =>
    JSON.stringify(
        {
            info: { face: fontFamily, size: fontSize },
            common: { lineHeight, base, scaleW: width, scaleH: height, pages: 1 },
            chars: glyphs.map((g) => ({ id: g.char.charCodeAt(0), ...g })),
        },
        null,
        2,
    )

const generateBitmapFont = (
    cfg: RenderConfig,
    glyphString: string,
    opts: {
        glyphsPerRow: number
        lineHeight?: number
        powerOfTwo: boolean
        background?: string
        exportFormat: BitmapFontExportFormat
    },
): { canvas: HTMLCanvasElement; glyphs: BitmapFontGlyph[]; xml: string; text: string } => {
    const chars = uniqueChars(glyphString)
    const measure = document.createElement('canvas')
    const mCtx = measure.getContext('2d')!
    mCtx.font = `${cfg.fontSize}px "${cfg.fontFamily}"`

    const { widths, maxHeight, ascent } = measureGlyphs(mCtx, chars, cfg)

    const perRow = Math.max(1, opts.glyphsPerRow)
    const rows = Math.ceil(chars.length / perRow)
    const maxRowWidth = Math.max(
        1,
        ...Array.from({ length: rows }, (_, r) => {
            let w = 0
            for (let i = r * perRow; i < Math.min((r + 1) * perRow, chars.length); i++) {
                w += widths[i]
            }
            return w
        }),
    )

    const canvas = document.createElement('canvas')
    canvas.width = opts.powerOfTwo ? nextPow2(maxRowWidth) : maxRowWidth
    canvas.height = opts.powerOfTwo ? nextPow2(rows * maxHeight) : rows * maxHeight
    const ctx = canvas.getContext('2d')!
    if (opts.background) {
        ctx.fillStyle = opts.background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    const glyphData: BitmapFontGlyph[] = []
    const pad = maxBorderThickness(cfg.borders) + cfg.padding
    let cx = 0
    let cy = 0
    let col = 0

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i]
        const w = widths[i]

        renderGlyph(ctx, ch, cx, cy, cfg, maxHeight)

        glyphData.push({
            char: ch,
            x: cx,
            y: cy,
            width: w,
            height: maxHeight,
            xOffset: 0,
            yOffset: 0,
            xAdvance: w - pad,
        })

        cx += w
        col++
        if (col >= perRow) {
            col = 0
            cx = 0
            cy += maxHeight
        }
    }

    const lineHeight = opts.lineHeight ?? maxHeight
    const xml = buildXml(
        cfg.fontFamily,
        cfg.fontSize,
        lineHeight,
        ascent,
        canvas.width,
        canvas.height,
        glyphData,
    )
    const text =
        opts.exportFormat === 'json'
            ? buildJson(
                  cfg.fontFamily,
                  cfg.fontSize,
                  lineHeight,
                  ascent,
                  canvas.width,
                  canvas.height,
                  glyphData,
              )
            : opts.exportFormat === 'fnt'
              ? buildFnt(
                    cfg.fontFamily,
                    cfg.fontSize,
                    lineHeight,
                    ascent,
                    canvas.width,
                    canvas.height,
                    glyphData,
                )
              : xml

    return { canvas, glyphs: glyphData, xml, text }
}

// ── Attribute helpers ──────────────────────────────────────────────────────────

const numAttr = (el: HTMLElement, name: string, def: number, min = -Infinity): number => {
    const v = parseFloat(el.getAttribute(name) ?? '')
    return Number.isFinite(v) ? Math.max(min, v) : def
}

const csvAttr = (el: HTMLElement, name: string): string[] =>
    (el.getAttribute(name) ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

/** A `[{ color, thickness, align? }]` JSON attribute → validated border list. */
const parseBordersJson = (raw: string | null): BitmapFontBorder[] | null => {
    if (!raw) return null
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return null
    }
    if (!Array.isArray(parsed)) return null
    const out: BitmapFontBorder[] = []
    for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue
        const b = entry as Partial<BitmapFontBorder>
        const thickness = typeof b.thickness === 'number' ? b.thickness : DEFAULT_BORDER_THICKNESS
        if (thickness <= 0) continue
        out.push({
            color: typeof b.color === 'string' ? b.color : DEFAULT_BORDER_COLOR,
            thickness,
            align: BORDER_ALIGNS.includes(b.align as any) ? b.align : 'center',
        })
    }
    return out
}

// ── Custom element ─────────────────────────────────────────────────────────────

/**
 * Headless-by-configuration bitmap-font atlas generator: the element renders a
 * single preview `<canvas>` and nothing else. Everything is driven from the
 * outside — attributes for the whole font/effect/layout/export surface, JS
 * properties for the structured effect objects, and imperative
 * `generate()` / `download()` / `copyDescriptor()` for output.
 */
export class BitmapFontGenerator extends HTMLElement {
    private _initialised = false
    private _generating = false
    private _lastOutput: BitmapFontOutput | null = null
    private _canvas: HTMLCanvasElement | null = null
    private _resizeObserver: ResizeObserver | null = null
    private _resizeHandler: (() => void) | null = null
    private _autoTimer: ReturnType<typeof setTimeout> | null = null

    // Structured effect overrides. `null` (or an empty array) means "derive from
    // the attributes"; assigning an object pins it until cleared with `null`.
    private _fill: BitmapFontFill | null = null
    private _border: BitmapFontBorder | null = null
    private _borders: BitmapFontBorder[] = []
    private _dropShadow: BitmapFontDropShadow | null = null
    private _glow: BitmapFontGlow | null = null

    /** Optional callback mirroring the `tc-generate` event. */
    onGenerate: ((output: BitmapFontOutput) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            // Font + content
            'font-family',
            'font-size',
            'glyphs',
            'text',
            // Fill
            'fill-type',
            'fill-color',
            'gradient-type',
            'gradient-colors',
            'gradient-angle',
            // Outline
            'border-color',
            'border-thickness',
            'border-align',
            'borders',
            // Drop shadow
            'shadow-color',
            'shadow-size',
            'shadow-offset-x',
            'shadow-offset-y',
            'shadow-blur',
            // Glow
            'glow-color',
            'glow-size',
            // Atlas layout / export
            'letter-spacing',
            'padding',
            'glyphs-per-row',
            'line-height',
            'power-of-two',
            'scale',
            'background',
            'export-format',
            'auto-generate',
            // Preview canvas
            'preview-background',
            'preview-padding',
            'preview-line-gap',
            'preview-scale',
            'preview-align',
            // Canvas box
            'canvas-width',
            'canvas-height',
            'fit-parent',
            'disabled',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
            this._applyCanvasSize()
        }
        this._attachHandlers()
        this._drawPreview()
        if (this.autoGenerate) this._scheduleAutoGenerate()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        if (this._autoTimer !== null) {
            clearTimeout(this._autoTimer)
            this._autoTimer = null
        }
    }

    attributeChangedCallback(name: string): void {
        if (!this._initialised) return
        if (name === 'disabled') {
            this._updateDisabled()
            return
        }
        // Canvas-box changes only reflow the preview — the atlas output is unaffected,
        // so they must not trigger an auto-generate pass.
        if (name === 'canvas-width' || name === 'canvas-height' || name === 'fit-parent') {
            this._applyCanvasSize()
            this._drawPreview()
            return
        }
        this._invalidate()
    }

    // ── Font + content ─────────────────────────────────────────────────────────

    get fontFamily(): string {
        return this.getAttribute('font-family') ?? DEFAULT_FONT
    }
    set fontFamily(v: string) {
        setAttr(this, 'font-family', v)
    }

    get fontSize(): number {
        return Math.max(1, parseFloat(this.getAttribute('font-size') ?? '') || 32)
    }
    set fontSize(v: number) {
        this.setAttribute('font-size', String(v))
    }

    get glyphs(): string {
        return this.getAttribute('glyphs') ?? DEFAULT_GLYPHS
    }
    set glyphs(v: string) {
        setAttr(this, 'glyphs', v)
    }

    /** Preview-only text; the atlas always rasterises `glyphs`. */
    get text(): string {
        return this.getAttribute('text') ?? DEFAULT_TEXT
    }
    set text(v: string) {
        setAttr(this, 'text', v)
    }

    // ── Atlas layout / export ──────────────────────────────────────────────────

    get letterSpacing(): number {
        return numAttr(this, 'letter-spacing', 0)
    }
    set letterSpacing(v: number) {
        this.setAttribute('letter-spacing', String(v))
    }

    get padding(): number {
        return numAttr(this, 'padding', 2, 0)
    }
    set padding(v: number) {
        this.setAttribute('padding', String(v))
    }

    get glyphsPerRow(): number {
        return Math.max(1, parseInt(this.getAttribute('glyphs-per-row') ?? '', 10) || 16)
    }
    set glyphsPerRow(v: number) {
        this.setAttribute('glyphs-per-row', String(v))
    }

    /** Reported BMFont lineHeight; `0` means auto (use the cell height). */
    get lineHeight(): number {
        return numAttr(this, 'line-height', 0, 0)
    }
    set lineHeight(v: number) {
        this.setAttribute('line-height', String(v))
    }

    get powerOfTwo(): boolean {
        return this.hasAttribute('power-of-two')
    }
    set powerOfTwo(v: boolean) {
        if (v) this.setAttribute('power-of-two', '')
        else this.removeAttribute('power-of-two')
    }

    get scale(): number {
        return Math.max(1, parseFloat(this.getAttribute('scale') ?? '') || 1)
    }
    set scale(v: number) {
        this.setAttribute('scale', String(v))
    }

    /** Atlas background colour; `null` means transparent. */
    get background(): string | null {
        return this.getAttribute('background')
    }
    set background(v: string | null) {
        if (v != null) this.setAttribute('background', v)
        else this.removeAttribute('background')
    }

    get exportFormat(): BitmapFontExportFormat {
        const v = this.getAttribute('export-format') as BitmapFontExportFormat
        return EXPORT_FORMATS.includes(v) ? v : 'xml'
    }
    set exportFormat(v: BitmapFontExportFormat) {
        setAttr(this, 'export-format', v)
    }

    /** Regenerate (and fire `tc-generate`) automatically on every config change. */
    get autoGenerate(): boolean {
        return this.hasAttribute('auto-generate')
    }
    set autoGenerate(v: boolean) {
        if (v) this.setAttribute('auto-generate', '')
        else this.removeAttribute('auto-generate')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ── Preview canvas ─────────────────────────────────────────────────────────

    /** Preview backdrop; falls back to `background`, then to a transparent canvas. */
    get previewBackground(): string | null {
        return this.getAttribute('preview-background') ?? this.background
    }
    set previewBackground(v: string | null) {
        if (v != null) this.setAttribute('preview-background', v)
        else this.removeAttribute('preview-background')
    }

    get previewPadding(): number {
        return numAttr(this, 'preview-padding', 16, 0)
    }
    set previewPadding(v: number) {
        this.setAttribute('preview-padding', String(v))
    }

    get previewLineGap(): number {
        return numAttr(this, 'preview-line-gap', 8)
    }
    set previewLineGap(v: number) {
        this.setAttribute('preview-line-gap', String(v))
    }

    /** Scales the preview glyph geometry only; the export uses `scale`. */
    get previewScale(): number {
        return numAttr(this, 'preview-scale', 1, 0.05)
    }
    set previewScale(v: number) {
        this.setAttribute('preview-scale', String(v))
    }

    /** CSS width of the preview canvas (bare numbers are px); `''` = stylesheet default. */
    get canvasWidth(): string {
        return this.getAttribute('canvas-width') ?? ''
    }
    set canvasWidth(v: string) {
        if (v) this.setAttribute('canvas-width', v)
        else this.removeAttribute('canvas-width')
    }

    /**
     * CSS height of the preview canvas (bare numbers are px); `''` = stylesheet
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
     * Stretch the element and its canvas to fill the parent box, so the preview
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
        if (w) this.style.setProperty('--bs-bitmap-font-generator-canvas-width', w)
        else this.style.removeProperty('--bs-bitmap-font-generator-canvas-width')
        const h = cssLength(this.getAttribute('canvas-height'))
        if (h) this.style.setProperty('--bs-bitmap-font-generator-canvas-height', h)
        else this.style.removeProperty('--bs-bitmap-font-generator-canvas-height')
    }

    get previewAlign(): BitmapFontPreviewAlign {
        const v = this.getAttribute('preview-align') as BitmapFontPreviewAlign
        return PREVIEW_ALIGNS.includes(v) ? v : 'start'
    }
    set previewAlign(v: BitmapFontPreviewAlign) {
        setAttr(this, 'preview-align', v)
    }

    // ── Structured effect properties (attribute-backed, property-overridable) ───

    get fill(): BitmapFontFill {
        return this._fill ?? this._attrFill()
    }
    set fill(v: BitmapFontFill | null) {
        this._fill = v && typeof v === 'object' ? v : null
        this._invalidate()
    }

    get border(): BitmapFontBorder | null {
        return this._border ?? this.borders[0] ?? null
    }
    set border(v: BitmapFontBorder | null) {
        this._border = v && typeof v === 'object' ? v : null
        this._invalidate()
    }

    /** Stacked outlines, drawn thickest-first; `borders` overrides `border`. */
    get borders(): BitmapFontBorder[] {
        if (this._borders.length) return this._borders
        if (this._border) return [this._border]
        return this._attrBorders()
    }
    set borders(v: BitmapFontBorder[]) {
        this._borders = Array.isArray(v) ? v : []
        this._invalidate()
    }

    get dropShadow(): BitmapFontDropShadow | null {
        return this._dropShadow ?? this._attrShadow()
    }
    set dropShadow(v: BitmapFontDropShadow | null) {
        this._dropShadow = v && typeof v === 'object' ? v : null
        this._invalidate()
    }

    get glow(): BitmapFontGlow | null {
        return this._glow ?? this._attrGlow()
    }
    set glow(v: BitmapFontGlow | null) {
        this._glow = v && typeof v === 'object' ? v : null
        this._invalidate()
    }

    /** The most recent `generate()` result, or `null`. */
    get output(): BitmapFontOutput | null {
        return this._lastOutput
    }

    // ── Attribute → effect resolution ──────────────────────────────────────────

    private _attrFill(): BitmapFontFill {
        const color = this.getAttribute('fill-color') ?? DEFAULT_FILL_COLOR
        if (this.getAttribute('fill-type') !== 'gradient') return { type: 'solid', color }
        return {
            type: 'gradient',
            color,
            gradientType: this.getAttribute('gradient-type') === 'radial' ? 'radial' : 'linear',
            // An empty list degrades to the solid `color` inside createFillStyle.
            gradientColors: csvAttr(this, 'gradient-colors'),
            gradientAngle: numAttr(this, 'gradient-angle', 90),
        }
    }

    private _attrBorders(): BitmapFontBorder[] {
        const json = parseBordersJson(this.getAttribute('borders'))
        if (json) return json
        const color = this.getAttribute('border-color')
        const thickness = numAttr(
            this,
            'border-thickness',
            color != null ? DEFAULT_BORDER_THICKNESS : 0,
            0,
        )
        if (thickness <= 0) return []
        const align = this.getAttribute('border-align') as BitmapFontBorder['align']
        return [
            {
                color: color ?? DEFAULT_BORDER_COLOR,
                thickness,
                align: BORDER_ALIGNS.includes(align as any) ? align : 'center',
            },
        ]
    }

    private _attrShadow(): BitmapFontDropShadow | null {
        const color = this.getAttribute('shadow-color')
        const size = numAttr(this, 'shadow-size', color != null ? DEFAULT_SHADOW_SIZE : 0, 0)
        if (size <= 0) return null
        const shadow: BitmapFontDropShadow = { color: color ?? DEFAULT_SHADOW_COLOR, size }
        if (this.hasAttribute('shadow-offset-x')) {
            shadow.offsetX = numAttr(this, 'shadow-offset-x', size * 0.5)
        }
        if (this.hasAttribute('shadow-offset-y')) {
            shadow.offsetY = numAttr(this, 'shadow-offset-y', size * 0.5)
        }
        if (this.hasAttribute('shadow-blur')) {
            shadow.blur = numAttr(this, 'shadow-blur', size, 0)
        }
        return shadow
    }

    private _attrGlow(): BitmapFontGlow | null {
        const color = this.getAttribute('glow-color')
        const size = numAttr(this, 'glow-size', color != null ? DEFAULT_GLOW_SIZE : 0, 0)
        if (size <= 0) return null
        return { color: color ?? DEFAULT_GLOW_COLOR, size }
    }

    // ── Lifecycle helpers ──────────────────────────────────────────────────────

    private _attachHandlers(): void {
        this._detachHandlers()
        if (typeof ResizeObserver !== 'undefined' && this._canvas) {
            this._resizeObserver = new ResizeObserver(() => this._drawPreview())
            this._resizeObserver.observe(this._canvas)
            return
        }
        this._resizeHandler = () => this._drawPreview()
        window.addEventListener('resize', this._resizeHandler, { passive: true })
    }

    private _detachHandlers(): void {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect()
            this._resizeObserver = null
        }
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler)
            this._resizeHandler = null
        }
    }

    /** Any config change: repaint the preview, and re-export when auto-generating. */
    private _invalidate(): void {
        if (!this._initialised) return
        this._drawPreview()
        if (this.autoGenerate) this._scheduleAutoGenerate()
    }

    /** Coalesces bursts of attribute writes into a single generation pass. */
    private _scheduleAutoGenerate(): void {
        if (this._autoTimer !== null) clearTimeout(this._autoTimer)
        this._autoTimer = setTimeout(() => {
            this._autoTimer = null
            void this.generate()
        }, 32)
    }

    private _updateDisabled(): void {
        const root = this.querySelector('.tc-bfg')
        if (!root) return
        const disabled = this.disabled
        root.classList.toggle('tc-bfg--disabled', disabled)
        if (disabled) root.setAttribute('aria-disabled', 'true')
        else root.removeAttribute('aria-disabled')
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Renders the atlas, fires `tc-generate`/`onGenerate`, and resolves with the
     * output. Resolves `null` if `disabled` or a generation is already in flight.
     */
    async generate(): Promise<BitmapFontOutput | null> {
        if (this.disabled || this._generating) return null
        this._generating = true
        try {
            const cfg = resolveConfig({
                fontFamily: this.fontFamily,
                fontSize: this.fontSize,
                fill: this.fill,
                padding: this.padding,
                letterSpacing: this.letterSpacing,
                borders: this.borders,
                dropShadow: this.dropShadow ?? undefined,
                glow: this.glow ?? undefined,
                scale: this.scale,
            })

            const lh = this.lineHeight
            const {
                canvas,
                glyphs: glyphData,
                xml,
                text: descriptor,
            } = generateBitmapFont(cfg, this.glyphs, {
                glyphsPerRow: this.glyphsPerRow,
                lineHeight: lh > 0 ? lh : undefined,
                powerOfTwo: this.powerOfTwo,
                background: this.background ?? undefined,
                exportFormat: this.exportFormat,
            })

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) resolve(b)
                    else reject(new Error('Failed to generate PNG'))
                }, 'image/png')
            })

            const output: BitmapFontOutput = {
                png: blob,
                xml,
                text: descriptor,
                format: this.exportFormat,
                glyphs: glyphData,
                width: canvas.width,
                height: canvas.height,
            }
            this._lastOutput = output

            this.dispatchEvent(
                new CustomEvent<BitmapFontOutput>('tc-generate', {
                    bubbles: true,
                    composed: true,
                    detail: output,
                }),
            )
            if (typeof this.onGenerate === 'function') this.onGenerate(output)
            return output
        } finally {
            this._generating = false
        }
    }

    /** Copies the descriptor text to the clipboard; generates first if needed. */
    async copyDescriptor(): Promise<boolean> {
        const out = this._lastOutput ?? (await this.generate())
        if (!out) return false
        try {
            await navigator.clipboard.writeText(out.text)
            return true
        } catch {
            return false
        }
    }

    /** Downloads the atlas PNG + descriptor; generates first if needed. */
    async download(baseName?: string): Promise<boolean> {
        const out = this._lastOutput ?? (await this.generate())
        if (!out) return false
        const base = baseName ?? `${this.fontFamily.replace(/\s/g, '_')}_${this.fontSize}`
        const ext: Record<BitmapFontExportFormat, string> = { xml: 'xml', json: 'json', fnt: 'fnt' }
        const mime: Record<BitmapFontExportFormat, string> = {
            xml: 'text/xml',
            json: 'application/json',
            fnt: 'text/plain',
        }

        const pngUrl = URL.createObjectURL(out.png)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = `${base}.png`
        a.click()
        URL.revokeObjectURL(pngUrl)

        const descBlob = new Blob([out.text], { type: mime[out.format] })
        const descUrl = URL.createObjectURL(descBlob)
        const b = document.createElement('a')
        b.href = descUrl
        b.download = `${base}.${ext[out.format]}`
        b.click()
        URL.revokeObjectURL(descUrl)
        return true
    }

    /** Repaints the preview canvas (also called on resize + attribute changes). */
    refresh(): void {
        this._drawPreview()
    }

    // ── Preview rendering ──────────────────────────────────────────────────────

    private _drawPreview(): void {
        const canvas = this._canvas
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

        const bg = this.previewBackground
        if (bg) {
            ctx.fillStyle = bg
            ctx.fillRect(0, 0, displayW, displayH)
        }

        // The preview has its own scale so the atlas `scale` can stay export-only.
        const cfg = resolveConfig({
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fill: this.fill,
            padding: this.padding,
            letterSpacing: this.letterSpacing,
            borders: this.borders,
            dropShadow: this.dropShadow ?? undefined,
            glow: this.glow ?? undefined,
            scale: this.previewScale,
        })

        ctx.font = `${cfg.fontSize}px "${cfg.fontFamily}"`
        ctx.textBaseline = 'top'

        const pad = maxBorderThickness(cfg.borders) + cfg.padding
        const margin = this.previewPadding
        const maxW = Math.max(1, displayW - margin * 2)
        const cellH = cfg.fontSize + pad * 2 + effectExtent(cfg)
        const lineH = cellH + this.previewLineGap

        // Wrap into lines first so alignment can use each line's measured width.
        const lines: Array<{ chars: string[]; widths: number[]; width: number }> = []
        let line: { chars: string[]; widths: number[]; width: number } = {
            chars: [],
            widths: [],
            width: 0,
        }
        const pushLine = () => {
            lines.push(line)
            line = { chars: [], widths: [], width: 0 }
        }
        for (const ch of this.text) {
            if (ch === '\n') {
                pushLine()
                continue
            }
            const charW = ctx.measureText(ch).width + pad * 2 + cfg.letterSpacing
            if (line.chars.length && line.width + charW > maxW) pushLine()
            line.chars.push(ch)
            line.widths.push(charW)
            line.width += charW
        }
        pushLine()

        const align = this.previewAlign
        lines.forEach((l, row) => {
            const slack = Math.max(0, maxW - l.width)
            let x = margin + (align === 'center' ? slack / 2 : align === 'end' ? slack : 0)
            const y = margin + row * lineH
            if (y > displayH) return
            l.chars.forEach((ch, i) => {
                renderGlyph(ctx, ch, x, y, cfg, cellH)
                x += l.widths[i]
            })
        })
    }

    // ── Markup ─────────────────────────────────────────────────────────────────

    private render(): void {
        const disabled = this.disabled
        patchHtml(
            this,
            `<div class="tc-bfg${disabled ? ' tc-bfg--disabled' : ''}"${disabled ? ' aria-disabled="true"' : ''}>` +
                `<canvas class="tc-bfg-canvas" aria-label="Bitmap font live preview"></canvas>` +
                `</div>`,
        )
        this._canvas = this.querySelector<HTMLCanvasElement>('.tc-bfg-canvas')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BitmapFontGenerator
    }
}

import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

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

let _idCounter = 0

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')
    const svg = (LucideIcons as Record<string, string>)[pascal]
    return svg ? icon(svg) : ''
}

const downloadIconHtml = lucideByName('download')
const copyIconHtml = lucideByName('copy')
const checkIconHtml = lucideByName('check')
const sparklesIconHtml = lucideByName('sparkles')

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

const resolveShadow = (ds: BitmapFontDropShadow | undefined, scale: number): ResolvedEffect | undefined => {
    if (!ds || ds.size <= 0) return undefined
    return {
        color: ds.color,
        blur: (ds.blur ?? ds.size) * scale,
        offsetX: (ds.offsetX ?? ds.size * 0.5) * scale,
        offsetY: (ds.offsetY ?? ds.size * 0.5) * scale,
    }
}

const resolveGlow = (glow: BitmapFontGlow | undefined, scale: number): ResolvedEffect | undefined => {
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
        borders: props.borders.map(b => ({ ...b, thickness: b.thickness * s })),
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
        return fill.color ?? '#ffffff'
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
const castEffect = (ctx: CanvasRenderingContext2D, char: string, x: number, y: number, fx: ResolvedEffect) => {
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
    const outer = cfg.borders.filter(b => b.align !== 'inner').sort((a, b) => b.thickness - a.thickness)
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
    const inner = cfg.borders.filter(b => b.align === 'inner')
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
            chars: glyphs.map(g => ({ id: g.char.charCodeAt(0), ...g })),
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
    const xml = buildXml(cfg.fontFamily, cfg.fontSize, lineHeight, ascent, canvas.width, canvas.height, glyphData)
    const text =
        opts.exportFormat === 'json'
            ? buildJson(cfg.fontFamily, cfg.fontSize, lineHeight, ascent, canvas.width, canvas.height, glyphData)
            : opts.exportFormat === 'fnt'
                ? buildFnt(cfg.fontFamily, cfg.fontSize, lineHeight, ascent, canvas.width, canvas.height, glyphData)
                : xml

    return { canvas, glyphs: glyphData, xml, text }
}

// ── Custom element ─────────────────────────────────────────────────────────────

export class BitmapFontGenerator extends HTMLElement {
    private _initialised = false
    private _idPrefix: string
    private _internalUpdate = false
    private _generating = false
    private _lastOutput: BitmapFontOutput | null = null
    private _canvas: HTMLCanvasElement | null = null
    private _resizeHandler: (() => void) | null = null
    private _copyTimer: ReturnType<typeof setTimeout> | null = null

    // Complex object props — JS properties (no attribute), with sensible defaults.
    private _fill: BitmapFontFill = { type: 'solid', color: '#ffffff' }
    private _border: BitmapFontBorder | null = null
    private _borders: BitmapFontBorder[] = []
    private _dropShadow: BitmapFontDropShadow | null = null
    private _glow: BitmapFontGlow | null = null

    /** Optional callback mirroring the `tc-generate` event. */
    onGenerate: ((output: BitmapFontOutput) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-bfg-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return [
            'font-family',
            'font-size',
            'glyphs',
            'text',
            'letter-spacing',
            'padding',
            'glyphs-per-row',
            'line-height',
            'power-of-two',
            'scale',
            'background',
            'export-format',
            'disabled',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        if (this._copyTimer !== null) {
            clearTimeout(this._copyTimer)
            this._copyTimer = null
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        // Changes that originate from our own controls already updated the DOM +
        // preview; skip the structural rebuild to keep input focus.
        if (this._internalUpdate) return
        this.render()
    }

    // ── Scalar attributes (reflected) ──────────────────────────────────────────

    get fontFamily(): string {
        return this.getAttribute('font-family') ?? DEFAULT_FONT
    }
    set fontFamily(v: string) {
        this.setAttribute('font-family', v)
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
        this.setAttribute('glyphs', v)
    }

    get text(): string {
        return this.getAttribute('text') ?? DEFAULT_TEXT
    }
    set text(v: string) {
        this.setAttribute('text', v)
    }

    get letterSpacing(): number {
        return parseFloat(this.getAttribute('letter-spacing') ?? '') || 0
    }
    set letterSpacing(v: number) {
        this.setAttribute('letter-spacing', String(v))
    }

    get padding(): number {
        const v = parseFloat(this.getAttribute('padding') ?? '')
        return Number.isFinite(v) ? Math.max(0, v) : 2
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
        return parseFloat(this.getAttribute('line-height') ?? '') || 0
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
        this.setAttribute('export-format', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ── Complex object properties (no attribute) ────────────────────────────────

    get fill(): BitmapFontFill {
        return this._fill
    }
    set fill(v: BitmapFontFill) {
        this._fill = v && typeof v === 'object' ? v : { type: 'solid', color: '#ffffff' }
        if (this._initialised) this.render()
    }

    get border(): BitmapFontBorder | null {
        return this._border
    }
    set border(v: BitmapFontBorder | null) {
        this._border = v && typeof v === 'object' ? v : null
        if (this._initialised) this.render()
    }

    get borders(): BitmapFontBorder[] {
        return this._borders
    }
    set borders(v: BitmapFontBorder[]) {
        this._borders = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get dropShadow(): BitmapFontDropShadow | null {
        return this._dropShadow
    }
    set dropShadow(v: BitmapFontDropShadow | null) {
        this._dropShadow = v && typeof v === 'object' ? v : null
        if (this._initialised) this.render()
    }

    get glow(): BitmapFontGlow | null {
        return this._glow
    }
    set glow(v: BitmapFontGlow | null) {
        this._glow = v && typeof v === 'object' ? v : null
        if (this._initialised) this.render()
    }

    /** Stacked outlines, drawn thickest-first; `borders` overrides `border`. */
    private _resolveBorders(): BitmapFontBorder[] {
        return this._borders.length ? this._borders : this._border ? [this._border] : []
    }

    // ── Lifecycle helpers ───────────────────────────────────────────────────────

    private _attachHandlers(): void {
        this._detachHandlers()
        this._resizeHandler = () => this._drawPreview()
        window.addEventListener('resize', this._resizeHandler, { passive: true })
    }

    private _detachHandlers(): void {
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler)
            this._resizeHandler = null
        }
    }

    // ── Public API (parity with the React imperative handle) ────────────────────

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
                fill: this._fill,
                padding: this.padding,
                letterSpacing: this.letterSpacing,
                borders: this._resolveBorders(),
                dropShadow: this._dropShadow ?? undefined,
                glow: this._glow ?? undefined,
                scale: this.scale,
            })

            const lh = this.lineHeight
            const { canvas, glyphs: glyphData, xml, text: descriptor } = generateBitmapFont(cfg, this.glyphs, {
                glyphsPerRow: this.glyphsPerRow,
                lineHeight: lh > 0 ? lh : undefined,
                powerOfTwo: this.powerOfTwo,
                background: this.background ?? undefined,
                exportFormat: this.exportFormat,
            })

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob(b => {
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
            this._renderOutput()

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

    // ── Control wiring ──────────────────────────────────────────────────────────

    private _ctl<T extends HTMLElement = HTMLInputElement>(field: string): T | null {
        return this.querySelector<T>(`#${this._idPrefix}-${field}`)
    }

    private _num(field: string, def: number): number {
        const el = this._ctl<HTMLInputElement>(field)
        if (!el) return def
        const v = parseFloat(el.value)
        return Number.isFinite(v) ? v : def
    }

    private _str(field: string): string {
        return this._ctl<HTMLInputElement>(field)?.value ?? ''
    }

    private _checked(field: string): boolean {
        return this._ctl<HTMLInputElement>(field)?.checked ?? false
    }

    private _reflectAttr(name: string, value: string | null): void {
        this._internalUpdate = true
        if (value === null) this.removeAttribute(name)
        else this.setAttribute(name, value)
        this._internalUpdate = false
    }

    /** Reads every control's current value back into attributes + private fields. */
    private _collectState(): void {
        // Scalar attributes
        this._reflectAttr('font-family', this._str('font-family') || DEFAULT_FONT)
        this._reflectAttr('font-size', String(this._num('font-size', 32)))
        this._reflectAttr('text', this._str('text'))
        this._reflectAttr('glyphs', this._str('glyphs'))
        this._reflectAttr('letter-spacing', String(this._num('letter-spacing', 0)))
        this._reflectAttr('padding', String(this._num('padding', 2)))
        this._reflectAttr('glyphs-per-row', String(this._num('glyphs-per-row', 16)))
        this._reflectAttr('line-height', String(this._num('line-height', 0)))
        this._reflectAttr('power-of-two', this._checked('power-of-two') ? '' : null)
        this._reflectAttr('scale', String(this._num('scale', 1)))
        this._reflectAttr('export-format', this._ctl<HTMLSelectElement>('export-format')?.value ?? 'xml')
        this._reflectAttr('background', this._checked('bg-enabled') ? this._str('bg-color') : null)

        // Fill
        const fillType = (this._ctl<HTMLSelectElement>('fill-type')?.value as 'solid' | 'gradient') ?? 'solid'
        if (fillType === 'solid') {
            this._fill = { type: 'solid', color: this._str('fill-color') || '#ffffff' }
        } else {
            const third = this._checked('grad-third')
            const colors = [this._str('grad-color1'), this._str('grad-color2')]
            if (third) colors.push(this._str('grad-color3'))
            this._fill = {
                type: 'gradient',
                gradientType: (this._ctl<HTMLSelectElement>('grad-type')?.value as 'linear' | 'radial') ?? 'linear',
                gradientColors: colors,
                gradientAngle: this._num('grad-angle', 90),
            }
        }

        // Borders (canonical list; clears the single-border convenience field)
        const borders: BitmapFontBorder[] = []
        if (this._checked('border-enabled')) {
            borders.push({
                color: this._str('border-color') || '#000000',
                thickness: this._num('border-thickness', 2),
                align: (this._ctl<HTMLSelectElement>('border-align')?.value as BitmapFontBorder['align']) ?? 'center',
            })
            if (this._checked('border2-enabled')) {
                borders.push({
                    color: this._str('border2-color') || '#ffffff',
                    thickness: this._num('border2-thickness', 5),
                })
            }
        }
        this._border = null
        this._borders = borders

        // Drop shadow
        this._dropShadow = this._checked('shadow-enabled')
            ? {
                  color: this._str('shadow-color') || '#000000',
                  size: this._num('shadow-size', 4),
                  offsetX: this._num('shadow-offset-x', 2),
                  offsetY: this._num('shadow-offset-y', 2),
                  blur: this._num('shadow-blur', 4),
              }
            : null

        // Glow
        this._glow = this._checked('glow-enabled')
            ? { color: this._str('glow-color') || '#00e5ff', size: this._num('glow-size', 8) }
            : null
    }

    private _onInput = (e: Event): void => {
        if (this.disabled) return
        const target = e.target as HTMLElement
        if (!target.hasAttribute('data-field')) return
        this._collectState()
        this._drawPreview()
    }

    private _onClick = (e: Event): void => {
        const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.getAttribute('data-action')
        if (!action || this.disabled) return
        if (action === 'generate') void this.generate()
        else if (action === 'copy') void this._handleCopy()
        else if (action === 'download') this._handleDownload()
    }

    private async _handleCopy(): Promise<void> {
        if (!this._lastOutput) return
        try {
            await navigator.clipboard.writeText(this._lastOutput.text)
        } catch {
            return
        }
        const btn = this._ctl<HTMLButtonElement>('copy-btn')
        if (!btn) return
        btn.innerHTML = `${checkIconHtml}<span>Copied</span>`
        if (this._copyTimer !== null) clearTimeout(this._copyTimer)
        this._copyTimer = setTimeout(() => {
            btn.innerHTML = `${copyIconHtml}<span>Copy</span>`
            this._copyTimer = null
        }, 1500)
    }

    private _handleDownload(): void {
        const out = this._lastOutput
        if (!out) return
        const base = `${this.fontFamily.replace(/\s/g, '_')}_${this.fontSize}`
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
    }

    // ── Rendering ───────────────────────────────────────────────────────────────

    private _drawPreview(): void {
        const canvas = this._canvas
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const dpr = window.devicePixelRatio || 1
        const displayW = canvas.clientWidth
        const displayH = canvas.clientHeight
        if (displayW <= 0 || displayH <= 0) return
        canvas.width = displayW * dpr
        canvas.height = displayH * dpr
        ctx.scale(dpr, dpr)

        ctx.clearRect(0, 0, displayW, displayH)
        ctx.fillStyle = this.background ?? '#1a1a2e'
        ctx.fillRect(0, 0, displayW, displayH)

        // Preview renders at scale 1 (display size), ignoring export `scale`.
        const cfg = resolveConfig({
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fill: this._fill,
            padding: this.padding,
            letterSpacing: this.letterSpacing,
            borders: this._resolveBorders(),
            dropShadow: this._dropShadow ?? undefined,
            glow: this._glow ?? undefined,
            scale: 1,
        })

        ctx.font = `${cfg.fontSize}px "${cfg.fontFamily}"`
        ctx.textBaseline = 'top'

        const pad = maxBorderThickness(cfg.borders) + cfg.padding
        const advance = effectExtent(cfg)
        let x = 16
        let y = 16

        for (const ch of this.text) {
            const m = ctx.measureText(ch)
            const charW = m.width + pad * 2 + cfg.letterSpacing

            if (x + charW > displayW - 16) {
                x = 16
                y += cfg.fontSize + pad * 2 + advance + 8
            }

            renderGlyph(ctx, ch, x, y, cfg, cfg.fontSize + 4)
            x += charW
        }
    }

    private _renderOutput(): void {
        const out = this._lastOutput
        const wrap = this._ctl<HTMLElement>('output')
        if (!wrap) return
        if (!out) {
            wrap.hidden = true
            return
        }
        wrap.hidden = false
        const code = this._ctl<HTMLElement>('code')
        if (code) code.textContent = out.text
        const meta = this._ctl<HTMLElement>('meta')
        if (meta) {
            meta.textContent = `${out.format.toUpperCase()} · ${out.width}×${out.height}px · ${out.glyphs.length} glyphs`
        }
    }

    private _row(field: string, label: string, control: string): string {
        const id = `${this._idPrefix}-${field}`
        return `<div class="tc-bfg-row"><label class="tc-bfg-label" for="${id}">${label}</label>${control}</div>`
    }

    private _input(field: string, type: string, extra = ''): string {
        const id = `${this._idPrefix}-${field}`
        const cls = type === 'color' ? 'tc-bfg-color' : 'tc-bfg-input tc-bfg-input--mono'
        return `<input class="${cls}" type="${type}" id="${id}" data-field="${field}" ${extra}>`
    }

    private _select(field: string, options: Array<[string, string]>): string {
        const id = `${this._idPrefix}-${field}`
        const opts = options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')
        return `<select class="tc-bfg-select tc-bfg-input--mono" id="${id}" data-field="${field}">${opts}</select>`
    }

    private _check(field: string, label: string): string {
        const id = `${this._idPrefix}-${field}`
        return `<div class="tc-bfg-check"><input type="checkbox" id="${id}" data-field="${field}"><label class="tc-bfg-label" for="${id}">${label}</label></div>`
    }

    private render(): void {
        const disabled = this.disabled

        const fontGroup =
            `<div class="tc-bfg-group"><div class="tc-bfg-group-title">Font &amp; Fill</div>` +
            this._row('font-family', 'Font family', this._input('font-family', 'text')) +
            this._row('font-size', 'Font size', this._input('font-size', 'number', 'min="8" max="256" step="1"')) +
            this._row('fill-type', 'Fill type', this._select('fill-type', [['solid', 'Solid'], ['gradient', 'Gradient']])) +
            this._row('fill-color', 'Fill colour', this._input('fill-color', 'color')) +
            this._row('grad-type', 'Gradient type', this._select('grad-type', [['linear', 'Linear'], ['radial', 'Radial']])) +
            this._row('grad-color1', 'Gradient 1', this._input('grad-color1', 'color')) +
            this._row('grad-color2', 'Gradient 2', this._input('grad-color2', 'color')) +
            this._check('grad-third', 'Third gradient stop') +
            this._row('grad-color3', 'Gradient 3', this._input('grad-color3', 'color')) +
            this._row('grad-angle', 'Gradient angle', this._input('grad-angle', 'number', 'min="0" max="360" step="1"')) +
            `</div>`

        const effectsGroup =
            `<div class="tc-bfg-group"><div class="tc-bfg-group-title">Outline &amp; Effects</div>` +
            this._check('border-enabled', 'Border') +
            this._row('border-color', 'Border colour', this._input('border-color', 'color')) +
            this._row('border-thickness', 'Border thickness', this._input('border-thickness', 'number', 'min="0" max="32" step="1"')) +
            this._row('border-align', 'Stroke align', this._select('border-align', [['center', 'Center'], ['outer', 'Outer'], ['inner', 'Inner']])) +
            this._check('border2-enabled', 'Second outline') +
            this._row('border2-color', 'Outer colour', this._input('border2-color', 'color')) +
            this._row('border2-thickness', 'Outer thickness', this._input('border2-thickness', 'number', 'min="0" max="40" step="1"')) +
            this._check('shadow-enabled', 'Drop shadow') +
            this._row('shadow-color', 'Shadow colour', this._input('shadow-color', 'color')) +
            this._row('shadow-size', 'Shadow size', this._input('shadow-size', 'number', 'min="0" max="40" step="1"')) +
            this._row('shadow-offset-x', 'Offset X', this._input('shadow-offset-x', 'number', 'min="-40" max="40" step="1"')) +
            this._row('shadow-offset-y', 'Offset Y', this._input('shadow-offset-y', 'number', 'min="-40" max="40" step="1"')) +
            this._row('shadow-blur', 'Blur', this._input('shadow-blur', 'number', 'min="0" max="60" step="1"')) +
            this._check('glow-enabled', 'Glow') +
            this._row('glow-color', 'Glow colour', this._input('glow-color', 'color')) +
            this._row('glow-size', 'Glow size', this._input('glow-size', 'number', 'min="0" max="60" step="1"')) +
            `</div>`

        const layoutGroup =
            `<div class="tc-bfg-group"><div class="tc-bfg-group-title">Layout &amp; Export</div>` +
            this._row('letter-spacing', 'Letter spacing', this._input('letter-spacing', 'number', 'min="-20" max="40" step="1"')) +
            this._row('padding', 'Padding', this._input('padding', 'number', 'min="0" max="32" step="1"')) +
            this._row('glyphs-per-row', 'Glyphs / row', this._input('glyphs-per-row', 'number', 'min="1" max="64" step="1"')) +
            this._row('line-height', 'Line height (0 = auto)', this._input('line-height', 'number', 'min="0" max="400" step="1"')) +
            this._check('power-of-two', 'Power-of-two atlas') +
            this._row('scale', 'Export scale', this._select('scale', [['1', '1×'], ['2', '2×'], ['3', '3×'], ['4', '4×']])) +
            this._row('export-format', 'Export format', this._select('export-format', [['xml', 'BMFont XML'], ['json', 'JSON'], ['fnt', 'BMFont .fnt']])) +
            this._check('bg-enabled', 'Atlas background') +
            this._row('bg-color', 'Background', this._input('bg-color', 'color')) +
            `</div>`

        const contentGroup =
            `<div class="tc-bfg-group"><div class="tc-bfg-group-title">Content</div>` +
            this._row('text', 'Preview text', this._input('text', 'text')) +
            this._row('glyphs', 'Glyphs', `<textarea class="tc-bfg-input tc-bfg-input--mono tc-bfg-textarea" id="${this._idPrefix}-glyphs" data-field="glyphs" rows="3"></textarea>`) +
            `</div>`

        this.innerHTML =
            `<div class="tc-bfg${disabled ? ' tc-bfg--disabled' : ''}">` +
            `<div class="tc-bfg-controls"${disabled ? ' aria-disabled="true"' : ''}>` +
            fontGroup +
            effectsGroup +
            layoutGroup +
            contentGroup +
            `</div>` +
            `<div class="tc-bfg-stage">` +
            `<canvas class="tc-bfg-canvas" id="${this._idPrefix}-canvas" aria-label="Bitmap font live preview"></canvas>` +
            `<div class="tc-bfg-toolbar">` +
            `<button type="button" class="tc-bfg-btn tc-bfg-btn--primary" data-action="generate"${disabled ? ' disabled' : ''}>${sparklesIconHtml}<span>Generate</span></button>` +
            `<span class="tc-bfg-meta" id="${this._idPrefix}-meta" role="status" aria-live="polite"></span>` +
            `</div>` +
            `<div class="tc-bfg-output" id="${this._idPrefix}-output" hidden>` +
            `<div class="tc-bfg-output-head">` +
            `<span class="tc-bfg-output-title">Descriptor</span>` +
            `<button type="button" class="tc-bfg-btn" id="${this._idPrefix}-copy-btn" data-action="copy" aria-label="Copy descriptor">${copyIconHtml}<span>Copy</span></button>` +
            `<button type="button" class="tc-bfg-btn" data-action="download" aria-label="Download PNG and descriptor">${downloadIconHtml}<span>Download</span></button>` +
            `</div>` +
            `<pre class="tc-bfg-pre"><code class="tc-bfg-code" id="${this._idPrefix}-code"></code></pre>` +
            `</div>` +
            `</div>` +
            `</div>`

        this._canvas = this._ctl<HTMLCanvasElement>('canvas')

        // Delegated listeners live on the fresh container; replaced wholesale on
        // every render so old listeners are garbage-collected with the old DOM.
        const root = this.querySelector('.tc-bfg')
        if (root) {
            root.addEventListener('input', this._onInput)
            root.addEventListener('change', this._onInput)
            root.addEventListener('click', this._onClick)
        }

        this._syncControlValues()
        this._renderOutput()
        this._drawPreview()
    }

    /** Pushes current state into the freshly-rendered controls (avoids escaping). */
    private _syncControlValues(): void {
        const setVal = (field: string, value: string) => {
            const el = this._ctl<HTMLInputElement>(field)
            if (el) el.value = value
        }
        const setChk = (field: string, value: boolean) => {
            const el = this._ctl<HTMLInputElement>(field)
            if (el) el.checked = value
        }

        setVal('font-family', this.fontFamily)
        setVal('font-size', String(this.fontSize))
        setVal('text', this.text)
        setVal('glyphs', this.glyphs)
        setVal('letter-spacing', String(this.letterSpacing))
        setVal('padding', String(this.padding))
        setVal('glyphs-per-row', String(this.glyphsPerRow))
        setVal('line-height', String(this.lineHeight))
        setChk('power-of-two', this.powerOfTwo)
        setVal('scale', String(this.scale))
        setVal('export-format', this.exportFormat)
        setChk('bg-enabled', this.background != null)
        setVal('bg-color', this.background ?? '#1a1a2e')

        // Fill
        const fill = this._fill
        setVal('fill-type', fill.type)
        setVal('fill-color', fill.color ?? '#ffffff')
        setVal('grad-type', fill.gradientType ?? 'linear')
        const gc = fill.gradientColors ?? []
        setVal('grad-color1', gc[0] ?? '#ff6b6b')
        setVal('grad-color2', gc[1] ?? '#ffd93d')
        setVal('grad-color3', gc[2] ?? '#6bccff')
        setChk('grad-third', gc.length >= 3)
        setVal('grad-angle', String(fill.gradientAngle ?? 90))

        // Borders
        const rb = this._resolveBorders()
        setChk('border-enabled', rb.length > 0)
        setVal('border-color', rb[0]?.color ?? '#000000')
        setVal('border-thickness', String(rb[0]?.thickness ?? 2))
        setVal('border-align', rb[0]?.align ?? 'center')
        setChk('border2-enabled', rb.length > 1)
        setVal('border2-color', rb[1]?.color ?? '#ffffff')
        setVal('border2-thickness', String(rb[1]?.thickness ?? 5))

        // Drop shadow
        const ds = this._dropShadow
        setChk('shadow-enabled', ds != null)
        setVal('shadow-color', ds?.color ?? '#000000')
        setVal('shadow-size', String(ds?.size ?? 4))
        setVal('shadow-offset-x', String(ds?.offsetX ?? 2))
        setVal('shadow-offset-y', String(ds?.offsetY ?? 2))
        setVal('shadow-blur', String(ds?.blur ?? 4))

        // Glow
        const glow = this._glow
        setChk('glow-enabled', glow != null)
        setVal('glow-color', glow?.color ?? '#00e5ff')
        setVal('glow-size', String(glow?.size ?? 8))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BitmapFontGenerator
    }
}

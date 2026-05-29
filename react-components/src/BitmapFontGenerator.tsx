import React, { useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'

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

export interface BitmapFontGeneratorProps {
	fontFamily?: string
	fill?: BitmapFontFill
	/** Single border. Ignored when `borders` is provided. */
	border?: BitmapFontBorder
	/** Stacked outlines, drawn thickest-first (concentric). Overrides `border`. */
	borders?: BitmapFontBorder[]
	fontSize?: number
	dropShadow?: BitmapFontDropShadow
	glow?: BitmapFontGlow
	glyphs?: string
	text?: string
	// ── Spacing & layout ──
	/** Extra px added to each glyph's advance/cell width. */
	letterSpacing?: number
	/** Px padding baked around each glyph cell. Defaults to 2. */
	padding?: number
	/** Glyphs packed per atlas row. Defaults to 16. */
	glyphsPerRow?: number
	/** Override the reported BMFont lineHeight. Defaults to the cell height. */
	lineHeight?: number
	/** Round the atlas dimensions up to the next power of two. */
	powerOfTwo?: boolean
	// ── Export ──
	/** Multiplies all geometry for a hi-res atlas. Defaults to 1. */
	scale?: number
	/** Atlas background. Defaults to transparent. */
	background?: string
	/** Descriptor format returned in `output.text`. Defaults to `xml`. */
	exportFormat?: BitmapFontExportFormat
	onGenerate?: (output: BitmapFontOutput) => void
	disabled?: boolean
	className?: string
}

export interface BitmapFontGeneratorHandle {
	/**
	 * Renders the atlas, fires `onGenerate`, and resolves with the output.
	 * Resolves `null` if `disabled` or a generation is already in flight.
	 */
	generate: () => Promise<BitmapFontOutput | null>
}

const DEFAULT_GLYPHS =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?-+:;\'\"()[]{}/@#$%^&*~`<>=_\\|'

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
const resolveConfig = (
	props: Required<
		Pick<BitmapFontGeneratorProps, 'fontFamily' | 'fontSize' | 'fill' | 'padding' | 'letterSpacing'>
	> & {
		borders: BitmapFontBorder[]
		dropShadow?: BitmapFontDropShadow
		glow?: BitmapFontGlow
		scale: number
	},
): RenderConfig => {
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
	const outer = cfg.borders.filter((b) => b.align !== 'inner').sort((a, b) => b.thickness - a.thickness)
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
	const xml = buildXml(cfg.fontFamily, cfg.fontSize, lineHeight, ascent, canvas.width, canvas.height, glyphData)
	const text =
		opts.exportFormat === 'json'
			? buildJson(cfg.fontFamily, cfg.fontSize, lineHeight, ascent, canvas.width, canvas.height, glyphData)
			: opts.exportFormat === 'fnt'
				? buildFnt(cfg.fontFamily, cfg.fontSize, lineHeight, ascent, canvas.width, canvas.height, glyphData)
				: xml

	return { canvas, glyphs: glyphData, xml, text }
}

export const BitmapFontGenerator = forwardRef<BitmapFontGeneratorHandle, BitmapFontGeneratorProps>(
	(
		{
			fontFamily = 'Arial',
			fill = { type: 'solid', color: '#ffffff' },
			border,
			borders,
			fontSize = 32,
			dropShadow,
			glow,
			glyphs = DEFAULT_GLYPHS,
			text = 'Hello World!',
			letterSpacing = 0,
			padding = 2,
			glyphsPerRow = 16,
			lineHeight,
			powerOfTwo = false,
			scale = 1,
			background,
			exportFormat = 'xml',
			onGenerate,
			disabled = false,
			className = '',
		},
		ref,
	) => {
		const previewRef = useRef<HTMLCanvasElement>(null)
		const generatingRef = useRef(false)

	const resolvedBorders = useMemo(() => borders ?? (border ? [border] : []), [borders, border])

	const drawPreview = useCallback(() => {
		const canvas = previewRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const dpr = window.devicePixelRatio || 1
		const displayW = canvas.clientWidth
		const displayH = canvas.clientHeight
		canvas.width = displayW * dpr
		canvas.height = displayH * dpr
		ctx.scale(dpr, dpr)

		ctx.clearRect(0, 0, displayW, displayH)
		ctx.fillStyle = background ?? '#1a1a2e'
		ctx.fillRect(0, 0, displayW, displayH)

		// Preview renders at scale 1 (display size), ignoring export `scale`.
		const cfg = resolveConfig({
			fontFamily,
			fontSize,
			fill,
			borders: resolvedBorders,
			dropShadow,
			glow,
			padding,
			letterSpacing,
			scale: 1,
		})

		ctx.font = `${cfg.fontSize}px "${cfg.fontFamily}"`
		ctx.textBaseline = 'top'

		const pad = maxBorderThickness(cfg.borders) + cfg.padding
		const advance = effectExtent(cfg)
		let x = 16
		let y = 16

		for (const ch of text) {
			const m = ctx.measureText(ch)
			const charW = m.width + pad * 2 + cfg.letterSpacing

			if (x + charW > displayW - 16) {
				x = 16
				y += cfg.fontSize + pad * 2 + advance + 8
			}

			renderGlyph(ctx, ch, x, y, cfg, cfg.fontSize + 4)
			x += charW
		}
	}, [fontFamily, fill, resolvedBorders, fontSize, dropShadow, glow, padding, letterSpacing, background, text])

	useEffect(() => {
		drawPreview()
	}, [drawPreview])

	const handleGenerate = useCallback(async (): Promise<BitmapFontOutput | null> => {
		if (disabled || generatingRef.current) return null
		generatingRef.current = true

		try {
			const cfg = resolveConfig({
				fontFamily,
				fontSize,
				fill,
				borders: resolvedBorders,
				dropShadow,
				glow,
				padding,
				letterSpacing,
				scale,
			})

			const { canvas, glyphs: glyphData, xml, text: descriptor } = generateBitmapFont(cfg, glyphs, {
				glyphsPerRow,
				lineHeight,
				powerOfTwo,
				background,
				exportFormat,
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
				format: exportFormat,
				glyphs: glyphData,
				width: canvas.width,
				height: canvas.height,
			}
			onGenerate?.(output)
			return output
		} finally {
			generatingRef.current = false
		}
	}, [
		fontFamily,
		fontSize,
		fill,
		resolvedBorders,
		dropShadow,
		glow,
		glyphs,
		letterSpacing,
		padding,
		glyphsPerRow,
		lineHeight,
		powerOfTwo,
		scale,
		background,
		exportFormat,
		onGenerate,
		disabled,
	])

	useImperativeHandle(ref, () => ({ generate: handleGenerate }), [handleGenerate])

	return (
		<div className={`component component-bitmap-font-generator${className ? ` ${className}` : ''}`}>
			<canvas ref={previewRef} className="component-bitmap-font-generator__preview" />
		</div>
	)
	},
)

BitmapFontGenerator.displayName = 'BitmapFontGenerator'

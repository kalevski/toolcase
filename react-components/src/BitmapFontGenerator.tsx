import React, { useRef, useEffect, useCallback, useState } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

export interface BitmapFontFill {
	type: 'solid' | 'gradient'
	color?: string
	gradientColors?: string[]
	gradientAngle?: number
}

export interface BitmapFontBorder {
	color: string
	thickness: number
}

export interface BitmapFontDropShadow {
	color: string
	size: number
}

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
	xml: string
	glyphs: BitmapFontGlyph[]
}

export interface BitmapFontGeneratorProps {
	fontFamily?: string
	fill?: BitmapFontFill
	border?: BitmapFontBorder
	fontSize?: number
	dropShadow?: BitmapFontDropShadow
	glyphs?: string
	text?: string
	onGenerate?: (output: BitmapFontOutput) => void
	disabled?: boolean
	className?: string
}

const DEFAULT_GLYPHS =
	'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?-+:;\'\"()[]{}/@#$%^&*~`<>=_\\|'

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
	const angle = fill.gradientAngle ?? 0
	const rad = (angle * Math.PI) / 180
	const cx = gx + gw / 2
	const cy = gy + gh / 2
	const len = Math.max(gw, gh) / 2
	const x0 = cx - Math.cos(rad) * len
	const y0 = cy - Math.sin(rad) * len
	const x1 = cx + Math.cos(rad) * len
	const y1 = cy + Math.sin(rad) * len
	const gradient = ctx.createLinearGradient(x0, y0, x1, y1)
	const colors = fill.gradientColors
	colors.forEach((c, i) => gradient.addColorStop(i / Math.max(colors.length - 1, 1), c))
	return gradient
}

const measureGlyphs = (
	ctx: CanvasRenderingContext2D,
	chars: string,
	fontSize: number,
	border: BitmapFontBorder | undefined,
	dropShadow: BitmapFontDropShadow | undefined,
): { widths: number[]; maxHeight: number; ascent: number } => {
	ctx.font = `${fontSize}px ${ctx.font.split(' ').slice(1).join(' ')}`
	const metrics = ctx.measureText('M')
	const ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.8
	const descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.2
	const baseHeight = Math.ceil(ascent + descent)

	const extra =
		(border?.thickness ?? 0) * 2 + (dropShadow?.size ?? 0)
	const maxHeight = baseHeight + extra + 2

	const widths: number[] = []
	for (const ch of chars) {
		const m = ctx.measureText(ch)
		widths.push(Math.ceil(m.width) + extra + 2)
	}

	return { widths, maxHeight, ascent: Math.ceil(ascent) }
}

const renderGlyph = (
	ctx: CanvasRenderingContext2D,
	char: string,
	x: number,
	y: number,
	fontSize: number,
	fontFamily: string,
	fill: BitmapFontFill,
	border: BitmapFontBorder | undefined,
	dropShadow: BitmapFontDropShadow | undefined,
	cellHeight: number,
	_ascent: number,
) => {
	ctx.font = `${fontSize}px "${fontFamily}"`
	ctx.textBaseline = 'top'

	const pad = (border?.thickness ?? 0) + 1
	const drawX = x + pad
	const drawY = y + pad

	if (dropShadow && dropShadow.size > 0) {
		ctx.shadowColor = dropShadow.color
		ctx.shadowBlur = dropShadow.size
		ctx.shadowOffsetX = dropShadow.size * 0.5
		ctx.shadowOffsetY = dropShadow.size * 0.5
	}

	if (border && border.thickness > 0) {
		ctx.strokeStyle = border.color
		ctx.lineWidth = border.thickness
		ctx.lineJoin = 'round'
		ctx.strokeText(char, drawX, drawY)
	}

	ctx.shadowColor = 'transparent'
	ctx.shadowBlur = 0
	ctx.shadowOffsetX = 0
	ctx.shadowOffsetY = 0

	const charW = ctx.measureText(char).width
	ctx.fillStyle = createFillStyle(ctx, fill, drawX, drawY, charW, cellHeight)
	ctx.fillText(char, drawX, drawY)
}

const generateBitmapFont = (
	fontFamily: string,
	fontSize: number,
	fill: BitmapFontFill,
	border: BitmapFontBorder | undefined,
	dropShadow: BitmapFontDropShadow | undefined,
	glyphString: string,
): { canvas: HTMLCanvasElement; glyphs: BitmapFontGlyph[]; xml: string } => {
	const chars = uniqueChars(glyphString)
	const measure = document.createElement('canvas')
	const mCtx = measure.getContext('2d')!
	mCtx.font = `${fontSize}px "${fontFamily}"`

	const { widths, maxHeight, ascent } = measureGlyphs(mCtx, chars, fontSize, border, dropShadow)

	const maxPerRow = 16
	const rows = Math.ceil(chars.length / maxPerRow)
	const maxRowWidth = Math.max(
		...Array.from({ length: rows }, (_, r) => {
			let w = 0
			for (let i = r * maxPerRow; i < Math.min((r + 1) * maxPerRow, chars.length); i++) {
				w += widths[i]
			}
			return w
		}),
	)

	const canvas = document.createElement('canvas')
	canvas.width = maxRowWidth
	canvas.height = rows * maxHeight
	const ctx = canvas.getContext('2d')!
	ctx.clearRect(0, 0, canvas.width, canvas.height)

	const glyphData: BitmapFontGlyph[] = []
	let cx = 0
	let cy = 0
	let col = 0

	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i]
		const w = widths[i]

		renderGlyph(ctx, ch, cx, cy, fontSize, fontFamily, fill, border, dropShadow, maxHeight, ascent)

		const pad = (border?.thickness ?? 0) + 1
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
		if (col >= maxPerRow) {
			col = 0
			cx = 0
			cy += maxHeight
		}
	}

	const xmlLines = [
		'<?xml version="1.0"?>',
		`<font>`,
		`  <info face="${fontFamily}" size="${fontSize}" />`,
		`  <common lineHeight="${maxHeight}" base="${ascent}" scaleW="${canvas.width}" scaleH="${canvas.height}" pages="1" />`,
		`  <pages>`,
		`    <page id="0" file="${fontFamily.replace(/\s/g, '_')}_${fontSize}.png" />`,
		`  </pages>`,
		`  <chars count="${glyphData.length}">`,
	]
	for (const g of glyphData) {
		xmlLines.push(
			`    <char id="${g.char.charCodeAt(0)}" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" xoffset="${g.xOffset}" yoffset="${g.yOffset}" xadvance="${g.xAdvance}" page="0" />`,
		)
	}
	xmlLines.push(`  </chars>`, `</font>`)

	return { canvas, glyphs: glyphData, xml: xmlLines.join('\n') }
}

export const BitmapFontGenerator: React.FC<BitmapFontGeneratorProps> = ({
	fontFamily = 'Arial',
	fill = { type: 'solid', color: '#ffffff' },
	border,
	fontSize = 32,
	dropShadow,
	glyphs = DEFAULT_GLYPHS,
	text = 'Hello World!',
	onGenerate,
	disabled = false,
	className = '',
}) => {
	const previewRef = useRef<HTMLCanvasElement>(null)
	const [generating, setGenerating] = useState(false)

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

		ctx.fillStyle = '#1a1a2e'
		ctx.fillRect(0, 0, displayW, displayH)

		ctx.font = `${fontSize}px "${fontFamily}"`
		ctx.textBaseline = 'top'

		const pad = (border?.thickness ?? 0) + 1
		let x = 16
		let y = 16

		for (const ch of text) {
			const m = ctx.measureText(ch)
			const charW = m.width + pad * 2

			if (x + charW > displayW - 16) {
				x = 16
				y += fontSize + (border?.thickness ?? 0) * 2 + (dropShadow?.size ?? 0) + 8
			}

			renderGlyph(ctx, ch, x, y, fontSize, fontFamily, fill, border, dropShadow, fontSize + 4, fontSize * 0.8)

			x += charW
		}
	}, [fontFamily, fill, border, fontSize, dropShadow, text])

	useEffect(() => {
		drawPreview()
	}, [drawPreview])

	const handleGenerate = useCallback(async () => {
		if (disabled || generating) return
		setGenerating(true)

		try {
			const { canvas, glyphs: glyphData, xml } = generateBitmapFont(
				fontFamily,
				fontSize,
				fill,
				border,
				dropShadow,
				glyphs,
			)

			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => {
					if (b) resolve(b)
					else reject(new Error('Failed to generate PNG'))
				}, 'image/png')
			})

			onGenerate?.({ png: blob, xml, glyphs: glyphData })
		} finally {
			setGenerating(false)
		}
	}, [fontFamily, fontSize, fill, border, dropShadow, glyphs, onGenerate, disabled, generating])

	return (
		<div className={`component component-bitmap-font-generator${className ? ` ${className}` : ''}`}>
			<div className="component-bitmap-font-generator__toolbar">
				<Button
					variant="primary"
					size="small"
					className="component-bitmap-font-generator__generate-btn"
					disabled={disabled || generating}
					onClick={handleGenerate}
				>
					<Icon name="download" /> {generating ? 'Generating…' : 'Generate'}
				</Button>
				<span className="component-bitmap-font-generator__info">
					{uniqueChars(glyphs).length} glyphs &middot; {fontSize}px &middot; {fontFamily}
				</span>
			</div>
			<canvas
				ref={previewRef}
				className="component-bitmap-font-generator__preview"
			/>
		</div>
	)
}

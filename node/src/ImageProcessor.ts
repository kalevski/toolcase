import type { Sharp } from 'sharp'
import { promises as fs } from 'node:fs'
import { ImageProcessorError } from './errors'
import { loadSharp } from './internal/lazySharp'

/** Maximum allowed value for resize width or height. */
export const MAX_DIMENSION = 65535

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'avif'

export interface ResizeOptions {
	width?: number
	height?: number
	fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
	withoutEnlargement?: boolean
	background?: string
}

export interface CropOptions {
	left: number
	top: number
	width: number
	height: number
}

export interface FormatOptions {
	format: ImageFormat
	quality?: number
	lossless?: boolean
	progressive?: boolean
}

export interface OptimizeOptions {
	/**
	 * Format to optimize for. If omitted, every encoder is configured (legacy
	 * behavior; wasteful when only one output format is used).
	 */
	format?: ImageFormat
	quality?: number
	palette?: boolean
	effort?: number
	stripMetadata?: boolean
}

export interface ImageProcessorOptions {
	/** Maximum allowed input pixels (width × height). Defaults to 50 000 000. */
	maxInputPixels?: number
}

export interface ImageMetadata {
	format: string
	width: number
	height: number
	channels: number
	hasAlpha: boolean
	size: number
}

type ImageSource =
	| { kind: 'buffer'; data: Buffer }
	| { kind: 'path'; path: string }

type PipelineOp = (pipeline: Sharp) => Sharp

export class ImageProcessor {

	private readonly source: ImageSource
	private readonly ops: ReadonlyArray<PipelineOp>
	private readonly sourcePath: string | null
	private readonly maxInputPixels: number | undefined

	private constructor(source: ImageSource, ops: ReadonlyArray<PipelineOp>, sourcePath: string | null, maxInputPixels: number | undefined) {
		this.source = source
		this.ops = ops
		this.sourcePath = sourcePath
		this.maxInputPixels = maxInputPixels
	}

	static fromBuffer(buffer: Buffer, options?: ImageProcessorOptions): ImageProcessor {
		if (!Buffer.isBuffer(buffer)) {
			throw new ImageProcessorError('invalid-buffer', 'fromBuffer requires a Buffer')
		}
		return new ImageProcessor({ kind: 'buffer', data: buffer }, [], null, options?.maxInputPixels)
	}

	static fromPath(path: string, options?: ImageProcessorOptions): ImageProcessor {
		if (typeof path !== 'string' || path.length === 0) {
			throw new ImageProcessorError('invalid-path', 'fromPath requires a non-empty string')
		}
		return new ImageProcessor({ kind: 'path', path }, [], path, options?.maxInputPixels)
	}

	resize(options: ResizeOptions): ImageProcessor {
		for (const dim of [options.width, options.height]) {
			if (dim !== undefined && (!Number.isInteger(dim) || dim <= 0 || dim > MAX_DIMENSION)) {
				throw new ImageProcessorError('resize-invalid', 'resize width/height must be positive integers within bounds', this.sourcePath ?? undefined)
			}
		}
		return this.append(pipeline => pipeline.resize({
			width: options.width,
			height: options.height,
			fit: options.fit,
			withoutEnlargement: options.withoutEnlargement,
			background: options.background
		}))
	}

	crop(options: CropOptions): ImageProcessor {
		if (options.width <= 0 || options.height <= 0 || options.left < 0 || options.top < 0) {
			throw new ImageProcessorError('crop-invalid', 'crop bounds must be non-negative with positive size', this.sourcePath ?? undefined)
		}
		return this.append(pipeline => pipeline.extract({
			left: options.left,
			top: options.top,
			width: options.width,
			height: options.height
		}))
	}

	format(options: FormatOptions): ImageProcessor {
		return this.append(pipeline => {
			ImageProcessor.applyEncoder(pipeline, options.format, {
				quality: options.quality,
				lossless: options.lossless,
				progressive: options.progressive
			})
			return pipeline
		})
	}

	optimize(options: OptimizeOptions = {}): ImageProcessor {
		const quality = options.quality ?? 80
		const effort = options.effort ?? 6
		const stripMetadata = options.stripMetadata ?? true
		const palette = options.palette ?? true
		const format = options.format
		return this.append(pipeline => {
			switch (format) {
				case 'jpeg':
					pipeline.jpeg({ mozjpeg: true, quality, progressive: true })
					break
				case 'png':
					pipeline.png({ palette, compressionLevel: 9, quality })
					break
				case 'webp':
					pipeline.webp({ quality, effort })
					break
				case 'avif':
					pipeline.avif({ quality, effort })
					break
				case undefined:
					// No encoder — sharp will use the input format unchanged.
					break
			}
			if (!stripMetadata) {
				pipeline.withMetadata()
			}
			return pipeline
		})
	}

	async metadata(): Promise<ImageMetadata> {
		try {
			const pipeline = await this.materialize()
			const meta = await pipeline.metadata()
			return {
				format: meta.format ?? 'unknown',
				width: meta.width ?? 0,
				height: meta.height ?? 0,
				channels: meta.channels ?? 0,
				hasAlpha: meta.hasAlpha ?? false,
				size: meta.size ?? 0
			}
		} catch (error) {
			throw ImageProcessor.wrapError(error, 'metadata-failed', this.sourcePath)
		}
	}

	async toBuffer(): Promise<Buffer> {
		try {
			const pipeline = await this.materialize()
			return await pipeline.toBuffer()
		} catch (error) {
			throw ImageProcessor.wrapError(error, 'encode-failed', this.sourcePath)
		}
	}

	async toFile(path: string): Promise<ImageMetadata> {
		if (typeof path !== 'string' || path.length === 0) {
			throw new ImageProcessorError('invalid-path', 'toFile requires a non-empty string')
		}
		const tmp = `${path}.${process.pid}.tmp`
		try {
			const pipeline = await this.materialize()
			const info = await pipeline.toFile(tmp)
			await fs.rename(tmp, path)
			return {
				format: info.format ?? 'unknown',
				width: info.width,
				height: info.height,
				channels: info.channels,
				hasAlpha: info.channels === 4 || info.channels === 2,
				size: info.size
			}
		} catch (error) {
			await fs.unlink(tmp).catch(() => undefined)
			throw ImageProcessor.wrapError(error, 'write-failed', path)
		}
	}

	private append(op: PipelineOp): ImageProcessor {
		const next = this.ops.length === 0 ? [op] : [...this.ops, op]
		return new ImageProcessor(this.source, next, this.sourcePath, this.maxInputPixels)
	}

	private async materialize(): Promise<Sharp> {
		const sharp = await loadSharp()
		const input = this.source.kind === 'buffer' ? this.source.data : this.source.path
		let pipeline: Sharp = sharp(input, { limitInputPixels: this.maxInputPixels ?? 50_000_000, failOn: 'error' })
		for (const op of this.ops) {
			pipeline = op(pipeline)
		}
		return pipeline
	}

	private static applyEncoder(pipeline: Sharp, format: ImageFormat, opts: { quality?: number; lossless?: boolean; progressive?: boolean }): void {
		const quality = opts.quality ?? 80
		switch (format) {
			case 'png':
				pipeline.png({ progressive: opts.progressive ?? false, quality })
				break
			case 'jpeg':
				pipeline.jpeg({ progressive: opts.progressive ?? false, quality, mozjpeg: true })
				break
			case 'webp':
				pipeline.webp({ quality, lossless: opts.lossless ?? false })
				break
			case 'avif':
				pipeline.avif({ quality, lossless: opts.lossless ?? false })
				break
		}
	}

	private static wrapError(error: unknown, fallbackReason: string, path: string | null): ImageProcessorError {
		if (error instanceof ImageProcessorError) return error
		const message = error instanceof Error ? error.message : String(error)
		const reason = ImageProcessor.classify(message, fallbackReason)
		return new ImageProcessorError(reason, message, path ?? undefined)
	}

	private static classify(message: string, fallback: string): string {
		if (message.includes('extract_area')) return 'crop-out-of-bounds'
		if (message.includes('Input file is missing') || message.includes('Input file contains unsupported image format')) return 'decode-failed'
		return fallback
	}
}

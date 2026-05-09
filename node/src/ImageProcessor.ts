import sharp, { Sharp } from 'sharp'
import { ImageProcessorError } from './errors'

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

export interface ImageMetadata {
	format: string
	width: number
	height: number
	channels: number
	hasAlpha: boolean
	size: number
}

export class ImageProcessor {

	private readonly pipeline: Sharp
	private readonly sourcePath: string | null

	private constructor(pipeline: Sharp, sourcePath: string | null) {
		this.pipeline = pipeline
		this.sourcePath = sourcePath
	}

	static fromBuffer(buffer: Buffer): ImageProcessor {
		if (!Buffer.isBuffer(buffer)) {
			throw new ImageProcessorError('invalid-buffer', 'fromBuffer requires a Buffer')
		}
		return new ImageProcessor(sharp(buffer), null)
	}

	static fromPath(path: string): ImageProcessor {
		if (typeof path !== 'string' || path.length === 0) {
			throw new ImageProcessorError('invalid-path', 'fromPath requires a non-empty string')
		}
		return new ImageProcessor(sharp(path), path)
	}

	resize(options: ResizeOptions): ImageProcessor {
		const next = this.pipeline.clone().resize({
			width: options.width,
			height: options.height,
			fit: options.fit,
			withoutEnlargement: options.withoutEnlargement,
			background: options.background
		})
		return new ImageProcessor(next, this.sourcePath)
	}

	crop(options: CropOptions): ImageProcessor {
		if (options.width <= 0 || options.height <= 0 || options.left < 0 || options.top < 0) {
			throw new ImageProcessorError('crop-invalid', 'crop bounds must be non-negative with positive size', this.sourcePath ?? undefined)
		}
		const next = this.pipeline.clone().extract({
			left: options.left,
			top: options.top,
			width: options.width,
			height: options.height
		})
		return new ImageProcessor(next, this.sourcePath)
	}

	format(options: FormatOptions): ImageProcessor {
		const next = this.pipeline.clone()
		ImageProcessor.applyEncoder(next, options.format, {
			quality: options.quality,
			lossless: options.lossless,
			progressive: options.progressive
		})
		return new ImageProcessor(next, this.sourcePath)
	}

	optimize(options: OptimizeOptions = {}): ImageProcessor {
		const next = this.pipeline.clone()
		const quality = options.quality ?? 80
		const effort = options.effort ?? 6
		const stripMetadata = options.stripMetadata ?? true
		const palette = options.palette ?? true
		switch (options.format) {
			case 'jpeg':
				next.jpeg({ mozjpeg: true, quality, progressive: true })
				break
			case 'png':
				next.png({ palette, compressionLevel: 9, quality })
				break
			case 'webp':
				next.webp({ quality, effort })
				break
			case 'avif':
				next.avif({ quality, effort })
				break
			case undefined:
				next.jpeg({ mozjpeg: true, quality, progressive: true })
				next.png({ palette, compressionLevel: 9, quality })
				next.webp({ quality, effort })
				next.avif({ quality, effort })
				break
		}
		if (!stripMetadata) {
			next.withMetadata()
		}
		return new ImageProcessor(next, this.sourcePath)
	}

	async metadata(): Promise<ImageMetadata> {
		try {
			const meta = await this.pipeline.clone().metadata()
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
			return await this.pipeline.clone().toBuffer()
		} catch (error) {
			throw ImageProcessor.wrapError(error, 'encode-failed', this.sourcePath)
		}
	}

	async toFile(path: string): Promise<ImageMetadata> {
		if (typeof path !== 'string' || path.length === 0) {
			throw new ImageProcessorError('invalid-path', 'toFile requires a non-empty string')
		}
		try {
			const info = await this.pipeline.clone().toFile(path)
			return {
				format: info.format ?? 'unknown',
				width: info.width,
				height: info.height,
				channels: info.channels,
				hasAlpha: info.premultiplied ?? false,
				size: info.size
			}
		} catch (error) {
			throw ImageProcessor.wrapError(error, 'write-failed', path)
		}
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

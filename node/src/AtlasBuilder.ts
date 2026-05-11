import { Packing, type PackingPackerOptions, type PackingResult, type PackingSprite } from '@toolcase/base'
import type SharpDefault from 'sharp'
import type { OverlayOptions } from 'sharp'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { AtlasBuildError } from './errors'
import { ImageProcessor, type ImageFormat } from './ImageProcessor'
import { loadSharp } from './internal/lazySharp'

type SharpFactory = typeof SharpDefault

export type AtlasBuildStage = 'decode' | 'pack' | 'compose' | 'write'

export interface AtlasInput {
	id: string
	path: string
}

export interface AtlasOutputOptions {
	directory: string
	baseName?: string
	format?: ImageFormat
	quality?: number
}

export interface AtlasBuilderOptions {
	output: AtlasOutputOptions
	packer?: Partial<PackingPackerOptions>
	background?: string
	writeManifest?: boolean
	optimize?: boolean
	useAlphaTrimming?: boolean
	/**
	 * Skip inputs that fail at the `decode` stage and surface them in
	 * `result.failures`. Pack/compose/write errors still throw — they are
	 * whole-atlas concerns, not per-input.
	 */
	continueOnError?: boolean
}

export interface AtlasBuildFailure {
	input: AtlasInput
	stage: AtlasBuildStage
	error: Error
}

export interface AtlasFrameRect {
	x: number
	y: number
	width: number
	height: number
}

export interface AtlasFrameSource {
	path: string
	width: number
	height: number
	offsetX: number
	offsetY: number
}

export interface AtlasFrame {
	id: string
	page: number
	file: string
	rect: AtlasFrameRect
	rotated: boolean
	source: AtlasFrameSource
}

export interface AtlasPageFile {
	page: number
	file: string
	width: number
	height: number
	occupancy: number
	frames: AtlasFrame[]
}

export interface AtlasUnpacked {
	id: string
	sourcePath: string
	width: number
	height: number
}

export interface AtlasResult {
	pages: AtlasPageFile[]
	unpacked: AtlasUnpacked[]
	manifestPath: string | null
	pack: PackingResult
	failures: AtlasBuildFailure[]
}

interface DecodedImage {
	id: string
	sourcePath: string
	originalWidth: number
	originalHeight: number
	trimmedBuffer: Buffer
	trimmedWidth: number
	trimmedHeight: number
	trimOffsetX: number
	trimOffsetY: number
}

const DEFAULT_PACKER_OPTIONS: PackingPackerOptions = {
	algorithm: 'max-rects',
	sort: 'max-side-desc',
	trim: false,
	alphaThreshold: 1,
	maxWidth: 2048,
	maxHeight: 2048,
	allowRotation: false,
	padding: 2,
	extrude: 0,
	pot: 'page',
	budget: { maxPagePixels: 2048 * 2048, maxPages: 16 }
}

const MANIFEST_VERSION = 1

export class AtlasBuilder {

	private readonly options: AtlasBuilderOptions

	constructor(options: AtlasBuilderOptions) {
		if (!options || !options.output || typeof options.output.directory !== 'string' || options.output.directory.length === 0) {
			throw new AtlasBuildError('write', 'output.directory is required')
		}
		this.options = options
	}

	async build(inputs: AtlasInput[]): Promise<AtlasResult> {
		if (!Array.isArray(inputs) || inputs.length === 0) {
			throw new AtlasBuildError('decode', 'inputs must be a non-empty array')
		}

		const sharp = await loadSharp()
		const cache = new Map<string, DecodedImage>()
		const failures: AtlasBuildFailure[] = []
		const continueOnError = this.options.continueOnError === true
		for (const input of inputs) {
			try {
				const decoded = await this.decode(sharp, input)
				cache.set(decoded.id, decoded)
			} catch (error) {
				if (!continueOnError) throw error
				const stage = error instanceof AtlasBuildError ? error.stage : 'decode'
				const wrapped = error instanceof Error ? error : new Error(String(error))
				failures.push({ input, stage, error: wrapped })
			}
		}
		if (cache.size === 0) {
			throw new AtlasBuildError('decode', 'no inputs decoded successfully')
		}

		const sprites: PackingSprite[] = []
		for (const decoded of cache.values()) {
			sprites.push({
				id: decoded.id,
				width: decoded.trimmedWidth,
				height: decoded.trimmedHeight
			})
		}

		const packerOptions: PackingPackerOptions = {
			...DEFAULT_PACKER_OPTIONS,
			...(this.options.packer ?? {}),
			trim: false,
			budget: {
				...DEFAULT_PACKER_OPTIONS.budget,
				...((this.options.packer ?? {}).budget ?? {})
			}
		}

		let pack: PackingResult
		try {
			const packer = new Packing.Packer(packerOptions)
			pack = packer.pack(sprites)
		} catch (error) {
			throw new AtlasBuildError('pack', error instanceof Error ? error.message : String(error))
		}

		const outputDir = path.resolve(this.options.output.directory)
		await fs.mkdir(outputDir, { recursive: true })

		const baseName = this.options.output.baseName ?? 'atlas'
		const format: ImageFormat = this.options.output.format ?? 'png'
		const ext = AtlasBuilder.extensionFor(format)
		const pageFiles: AtlasPageFile[] = []

		for (let pageIndex = 0; pageIndex < pack.pages.length; pageIndex++) {
			const page = pack.pages[pageIndex]
			const fileName = pack.pages.length === 1 ? `${baseName}.${ext}` : `${baseName}-${pageIndex}.${ext}`
			const filePath = path.join(outputDir, fileName)
			const composedFrames: AtlasFrame[] = []

			const composites: OverlayOptions[] = []
			for (const placed of page.sprites) {
				const decoded = cache.get(placed.id)
				if (!decoded) continue
				if (placed.rect.width <= 0 || placed.rect.height <= 0) continue

				const overlayBuffer = await this.prepareOverlay(sharp, decoded, placed.rotated)
				composites.push({
					input: overlayBuffer,
					left: placed.rect.x,
					top: placed.rect.y
				})

				composedFrames.push({
					id: placed.id,
					page: pageIndex,
					file: filePath,
					rect: {
						x: placed.rect.x,
						y: placed.rect.y,
						width: placed.rect.width,
						height: placed.rect.height
					},
					rotated: placed.rotated,
					source: {
						path: decoded.sourcePath,
						width: decoded.originalWidth,
						height: decoded.originalHeight,
						offsetX: decoded.trimOffsetX,
						offsetY: decoded.trimOffsetY
					}
				})
			}

			try {
				const canvas = sharp({
					create: {
						width: page.width,
						height: page.height,
						channels: 4,
						background: this.options.background ?? { r: 0, g: 0, b: 0, alpha: 0 }
					}
				}).composite(composites)

				const composedBuffer = await canvas.png().toBuffer()
				let writer = ImageProcessor.fromBuffer(composedBuffer).format({
					format,
					quality: this.options.output.quality
				})
				if (this.options.optimize) {
					writer = writer.optimize({ format, quality: this.options.output.quality })
				}
				await writer.toFile(filePath)
			} catch (error) {
				throw new AtlasBuildError('compose', error instanceof Error ? error.message : String(error), filePath)
			}

			pageFiles.push({
				page: pageIndex,
				file: filePath,
				width: page.width,
				height: page.height,
				occupancy: page.occupancy,
				frames: composedFrames
			})
		}

		const unpacked: AtlasUnpacked[] = pack.unpacked.map(sprite => {
			const decoded = cache.get(sprite.id)
			return {
				id: sprite.id,
				sourcePath: decoded ? decoded.sourcePath : '',
				width: sprite.width,
				height: sprite.height
			}
		})

		let manifestPath: string | null = null
		if (this.options.writeManifest !== false) {
			manifestPath = path.join(outputDir, `${baseName}.json`)
			try {
				await fs.writeFile(manifestPath, AtlasBuilder.serializeManifest(format, pageFiles, unpacked, outputDir))
			} catch (error) {
				throw new AtlasBuildError('write', error instanceof Error ? error.message : String(error), manifestPath)
			}
		}

		return {
			pages: pageFiles,
			unpacked,
			manifestPath,
			pack,
			failures
		}
	}

	private async decode(sharp: SharpFactory, input: AtlasInput): Promise<DecodedImage> {
		if (typeof input.path !== 'string' || input.path.length === 0) {
			throw new AtlasBuildError('decode', 'input.path is required')
		}
		const id = typeof input.id === 'string' && input.id.length > 0 ? input.id : path.basename(input.path, path.extname(input.path))
		try {
			const { data, info } = await sharp(input.path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
			const useTrim = this.options.useAlphaTrimming !== false
			const bounds = useTrim
				? AtlasBuilder.computeAlphaBounds(data, info.width, info.height, this.options.packer?.alphaThreshold ?? 1)
				: { left: 0, top: 0, width: info.width, height: info.height }
			const trimmedBuffer = AtlasBuilder.cropRaw(data, info.width, bounds)
			return {
				id,
				sourcePath: path.resolve(input.path),
				originalWidth: info.width,
				originalHeight: info.height,
				trimmedBuffer,
				trimmedWidth: bounds.width,
				trimmedHeight: bounds.height,
				trimOffsetX: bounds.left,
				trimOffsetY: bounds.top
			}
		} catch (error) {
			if (error instanceof AtlasBuildError) throw error
			throw new AtlasBuildError('decode', error instanceof Error ? error.message : String(error), input.path)
		}
	}

	private async prepareOverlay(sharp: SharpFactory, decoded: DecodedImage, rotated: boolean): Promise<Buffer> {
		const raw = sharp(decoded.trimmedBuffer, {
			raw: {
				width: decoded.trimmedWidth,
				height: decoded.trimmedHeight,
				channels: 4
			}
		})
		const withRotation = rotated ? raw.rotate(-90) : raw
		return await withRotation.png().toBuffer()
	}

	private static computeAlphaBounds(data: Buffer, width: number, height: number, threshold: number): { left: number; top: number; width: number; height: number } {
		const t = Math.max(0, threshold)
		let top = 0
		outerTop: for (; top < height; top++) {
			for (let x = 0; x < width; x++) {
				if (data[(top * width + x) * 4 + 3] > t) break outerTop
			}
		}
		if (top === height) {
			return { left: 0, top: 0, width, height }
		}
		let bottom = height - 1
		outerBottom: for (; bottom >= top; bottom--) {
			for (let x = 0; x < width; x++) {
				if (data[(bottom * width + x) * 4 + 3] > t) break outerBottom
			}
		}
		let left = 0
		outerLeft: for (; left < width; left++) {
			for (let y = top; y <= bottom; y++) {
				if (data[(y * width + left) * 4 + 3] > t) break outerLeft
			}
		}
		let right = width - 1
		outerRight: for (; right >= left; right--) {
			for (let y = top; y <= bottom; y++) {
				if (data[(y * width + right) * 4 + 3] > t) break outerRight
			}
		}
		return {
			left,
			top,
			width: right - left + 1,
			height: bottom - top + 1
		}
	}

	private static cropRaw(data: Buffer, sourceWidth: number, bounds: { left: number; top: number; width: number; height: number }): Buffer {
		const out = Buffer.allocUnsafe(bounds.width * bounds.height * 4)
		for (let row = 0; row < bounds.height; row++) {
			const srcStart = ((bounds.top + row) * sourceWidth + bounds.left) * 4
			const dstStart = row * bounds.width * 4
			data.copy(out, dstStart, srcStart, srcStart + bounds.width * 4)
		}
		return out
	}

	private static extensionFor(format: ImageFormat): string {
		switch (format) {
			case 'jpeg': return 'jpg'
			default: return format
		}
	}

	private static serializeManifest(format: ImageFormat, pages: AtlasPageFile[], unpacked: AtlasUnpacked[], outputDir: string): string {
		return JSON.stringify({
			version: MANIFEST_VERSION,
			format,
			pages: pages.map(page => ({
				page: page.page,
				file: path.basename(page.file),
				width: page.width,
				height: page.height,
				occupancy: page.occupancy,
				frames: page.frames.map(frame => ({
					id: frame.id,
					rect: frame.rect,
					rotated: frame.rotated,
					source: {
						path: path.relative(outputDir, frame.source.path),
						width: frame.source.width,
						height: frame.source.height,
						offsetX: frame.source.offsetX,
						offsetY: frame.source.offsetY
					}
				}))
			})),
			unpacked: unpacked.map(u => ({
				id: u.id,
				width: u.width,
				height: u.height
			}))
		}, null, 2)
	}
}

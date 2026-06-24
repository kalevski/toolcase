import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { ImageProcessor, MAX_DIMENSION } from '../src/ImageProcessor'
import { ImageProcessorError } from '../src/errors'

async function makeRedPng(width = 4, height = 4): Promise<Buffer> {
    return await sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 255, g: 0, b: 0, alpha: 1 }
        }
    }).png().toBuffer()
}

describe('ImageProcessor', () => {

    let tmpDir: string

    beforeAll(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'image-processor-'))
    })

    afterAll(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('throws on invalid buffer input', () => {
        expect(() => ImageProcessor.fromBuffer(null as any)).toThrow(ImageProcessorError)
    })

    it('throws on empty path', () => {
        expect(() => ImageProcessor.fromPath('')).toThrow(ImageProcessorError)
    })

    it('reads metadata of a 4x4 red PNG', async () => {
        const buf = await makeRedPng()
        const meta = await ImageProcessor.fromBuffer(buf).metadata()
        expect(meta.width).toBe(4)
        expect(meta.height).toBe(4)
        expect(meta.format).toBe('png')
        expect(meta.hasAlpha).toBe(true)
    })

    it('resize doubles width', async () => {
        const buf = await makeRedPng(4, 4)
        const out = await ImageProcessor.fromBuffer(buf).resize({ width: 8, height: 8 }).toBuffer()
        const meta = await sharp(out).metadata()
        expect(meta.width).toBe(8)
        expect(meta.height).toBe(8)
    })

    it('crop happy path', async () => {
        const buf = await makeRedPng(10, 10)
        const out = await ImageProcessor.fromBuffer(buf).crop({ left: 2, top: 2, width: 4, height: 4 }).toBuffer()
        const meta = await sharp(out).metadata()
        expect(meta.width).toBe(4)
        expect(meta.height).toBe(4)
    })

    it('crop out-of-bounds throws crop-out-of-bounds', async () => {
        const buf = await makeRedPng(4, 4)
        const proc = ImageProcessor.fromBuffer(buf).crop({ left: 0, top: 0, width: 999, height: 999 })
        await expect(proc.toBuffer()).rejects.toMatchObject({
            name: 'ImageProcessorError',
            reason: 'crop-out-of-bounds'
        })
    })

    it('crop with negative offset rejects synchronously', () => {
        const proc = ImageProcessor.fromBuffer(Buffer.alloc(8))
        expect(() => proc.crop({ left: -1, top: 0, width: 2, height: 2 })).toThrow(ImageProcessorError)
    })

    it('format webp produces RIFF/WEBP magic bytes', async () => {
        const buf = await makeRedPng(8, 8)
        const out = await ImageProcessor.fromBuffer(buf).format({ format: 'webp', quality: 50 }).toBuffer()
        expect(out.subarray(0, 4).toString('ascii')).toBe('RIFF')
        expect(out.subarray(8, 12).toString('ascii')).toBe('WEBP')
    })

    it('format jpeg produces JPEG SOI marker', async () => {
        const buf = await makeRedPng(8, 8)
        const out = await ImageProcessor.fromBuffer(buf).format({ format: 'jpeg', quality: 70 }).toBuffer()
        expect(out[0]).toBe(0xff)
        expect(out[1]).toBe(0xd8)
    })

    it('optimize keeps output decodable', async () => {
        const buf = await makeRedPng(16, 16)
        const out = await ImageProcessor.fromBuffer(buf).optimize({ stripMetadata: true }).toBuffer()
        const meta = await sharp(out).metadata()
        expect(meta.width).toBe(16)
        expect(meta.height).toBe(16)
    })

    it('optimize() with no format preserves png input format', async () => {
        const buf = await makeRedPng(16, 16)
        const out = await ImageProcessor.fromBuffer(buf).optimize().toBuffer()
        const meta = await sharp(out).metadata()
        expect(meta.format).toBe('png')
    })

    it('optimize() with no format preserves jpeg input format', async () => {
        const jpegBuf = await sharp({
            create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 100, b: 50 } }
        }).jpeg({ quality: 80 }).toBuffer()
        const out = await ImageProcessor.fromBuffer(jpegBuf).optimize().toBuffer()
        const meta = await sharp(out).metadata()
        expect(meta.format).toBe('jpeg')
    })

    it('optimize() with explicit format applies that encoder', async () => {
        const buf = await makeRedPng(16, 16)
        const out = await ImageProcessor.fromBuffer(buf).optimize({ format: 'webp' }).toBuffer()
        const meta = await sharp(out).metadata()
        expect(meta.format).toBe('webp')
    })

    it('toFile writes to disk and returns metadata', async () => {
        const buf = await makeRedPng(12, 12)
        const dest = path.join(tmpDir, 'out.png')
        const meta = await ImageProcessor.fromBuffer(buf).resize({ width: 24, height: 24 }).toFile(dest)
        expect(meta.width).toBe(24)
        expect(meta.height).toBe(24)
        const stat = await fs.stat(dest)
        expect(stat.size).toBeGreaterThan(0)
    })

    it('toFile leaves no partial or temp file on write failure', async () => {
        const buf = await makeRedPng(4, 4)
        // Target a non-existent subdirectory so sharp.toFile(tmp) fails before writing
        const dest = path.join(tmpDir, 'no-such-subdir', 'fail.png')
        await expect(ImageProcessor.fromBuffer(buf).toFile(dest)).rejects.toThrow(ImageProcessorError)
        // Final destination must not exist
        await expect(fs.stat(dest)).rejects.toThrow()
        // No .tmp sibling files should linger in tmpDir
        const files = await fs.readdir(tmpDir)
        expect(files.filter(f => f.endsWith('.tmp'))).toHaveLength(0)
    })

    it('toFile leaves no temp file when rename fails (destination is a directory)', async () => {
        const buf = await makeRedPng(4, 4)
        // Create a directory at the destination path so rename(tmp, dest) fails
        const dest = path.join(tmpDir, 'dest-as-dir')
        await fs.mkdir(dest, { recursive: true })
        await expect(ImageProcessor.fromBuffer(buf).toFile(dest)).rejects.toThrow(ImageProcessorError)
        // No .tmp files should remain in tmpDir after cleanup
        const files = await fs.readdir(tmpDir)
        expect(files.filter(f => f.endsWith('.tmp'))).toHaveLength(0)
    })

    it('toFile sets hasAlpha true for 4-channel (RGBA) PNG output', async () => {
        const buf = await makeRedPng(4, 4)
        const dest = path.join(tmpDir, 'rgba.png')
        const meta = await ImageProcessor.fromBuffer(buf).toFile(dest)
        expect(meta.hasAlpha).toBe(true)
    })

    it('toFile sets hasAlpha false for 3-channel (RGB) JPEG output', async () => {
        const buf = await sharp({
            create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 100, b: 50 } }
        }).jpeg().toBuffer()
        const dest = path.join(tmpDir, 'rgb.jpg')
        const meta = await ImageProcessor.fromBuffer(buf).toFile(dest)
        expect(meta.hasAlpha).toBe(false)
    })

    describe('resize() dimension validation', () => {
        const proc = () => ImageProcessor.fromBuffer(Buffer.alloc(8))

        it.each([
            ['negative width', { width: -1, height: 8 }],
            ['zero width', { width: 0, height: 8 }],
            ['negative height', { width: 8, height: -5 }],
            ['zero height', { width: 8, height: 0 }],
            ['NaN width', { width: NaN, height: 8 }],
            ['NaN height', { width: 8, height: NaN }],
            ['fractional width', { width: 1.5, height: 8 }],
            ['fractional height', { width: 8, height: 4.9 }],
            ['oversized width', { width: MAX_DIMENSION + 1, height: 8 }],
            ['oversized height', { width: 8, height: MAX_DIMENSION + 1 }],
        ])('throws synchronously on %s', (_, options) => {
            expect(() => proc().resize(options)).toThrow(ImageProcessorError)
        })

        it('accepts valid width and height', () => {
            expect(() => proc().resize({ width: 100, height: 200 })).not.toThrow()
        })

        it('accepts width-only (aspect-preserving)', () => {
            expect(() => proc().resize({ width: 100 })).not.toThrow()
        })

        it('accepts height-only (aspect-preserving)', () => {
            expect(() => proc().resize({ height: 200 })).not.toThrow()
        })

        it('accepts MAX_DIMENSION as a valid bound', () => {
            expect(() => proc().resize({ width: MAX_DIMENSION, height: MAX_DIMENSION })).not.toThrow()
        })

        it('includes resize-invalid reason', () => {
            let err: ImageProcessorError | undefined
            try {
                proc().resize({ width: -1 })
            } catch (e) {
                err = e as ImageProcessorError
            }
            expect(err?.reason).toBe('resize-invalid')
        })
    })

    it('chained transforms fork independently', async () => {
        const buf = await makeRedPng(20, 20)
        const base = ImageProcessor.fromBuffer(buf)
        const a = await base.resize({ width: 10, height: 10 }).toBuffer()
        const b = await base.resize({ width: 40, height: 40 }).toBuffer()
        const ma = await sharp(a).metadata()
        const mb = await sharp(b).metadata()
        expect(ma.width).toBe(10)
        expect(mb.width).toBe(40)
    })

    it('rejects image exceeding maxInputPixels', async () => {
        // 10x10 = 100 pixels; limit of 50 means it should be rejected
        const buf = await makeRedPng(10, 10)
        const proc = ImageProcessor.fromBuffer(buf, { maxInputPixels: 50 })
        await expect(proc.toBuffer()).rejects.toThrow(ImageProcessorError)
    })

    it('accepts image within maxInputPixels', async () => {
        const buf = await makeRedPng(4, 4)
        // 4x4 = 16 pixels; limit of 50 is fine
        const out = await ImageProcessor.fromBuffer(buf, { maxInputPixels: 50 }).toBuffer()
        const meta = await sharp(out).metadata()
        expect(meta.width).toBe(4)
    })
})

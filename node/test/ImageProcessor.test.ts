import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { ImageProcessor } from '../src/ImageProcessor'
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

    it('toFile writes to disk and returns metadata', async () => {
        const buf = await makeRedPng(12, 12)
        const dest = path.join(tmpDir, 'out.png')
        const meta = await ImageProcessor.fromBuffer(buf).resize({ width: 24, height: 24 }).toFile(dest)
        expect(meta.width).toBe(24)
        expect(meta.height).toBe(24)
        const stat = await fs.stat(dest)
        expect(stat.size).toBeGreaterThan(0)
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
})

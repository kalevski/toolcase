import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { AtlasBuilder } from '../src/AtlasBuilder'
import { AtlasBuildError } from '../src/errors'

interface ColorRGB {
    r: number
    g: number
    b: number
}

async function writeSolidPng(filePath: string, width: number, height: number, color: ColorRGB): Promise<void> {
    await sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: color.r, g: color.g, b: color.b, alpha: 1 }
        }
    }).png().toFile(filePath)
}

async function readPixel(filePath: string, x: number, y: number): Promise<{ r: number; g: number; b: number; a: number }> {
    const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const idx = (y * info.width + x) * 4
    return {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3]
    }
}

describe('AtlasBuilder', () => {

    let workDir: string
    let inputDir: string
    let outputDir: string

    beforeAll(async () => {
        workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atlas-builder-'))
        inputDir = path.join(workDir, 'in')
        outputDir = path.join(workDir, 'out')
        await fs.mkdir(inputDir, { recursive: true })
        await fs.mkdir(outputDir, { recursive: true })
    })

    afterAll(async () => {
        await fs.rm(workDir, { recursive: true, force: true })
    })

    it('throws when output.directory missing', () => {
        expect(() => new AtlasBuilder({ output: {} as any })).toThrow(AtlasBuildError)
    })

    it('throws when inputs empty', async () => {
        const builder = new AtlasBuilder({ output: { directory: outputDir } })
        await expect(builder.build([])).rejects.toThrow(AtlasBuildError)
    })

    it('builds atlas with three frames on a single page', async () => {
        const dir = path.join(workDir, 'three')
        await fs.mkdir(dir, { recursive: true })
        const a = path.join(dir, 'a.png')
        const b = path.join(dir, 'b.png')
        const c = path.join(dir, 'c.png')
        await writeSolidPng(a, 16, 16, { r: 255, g: 0, b: 0 })
        await writeSolidPng(b, 16, 16, { r: 0, g: 255, b: 0 })
        await writeSolidPng(c, 16, 16, { r: 0, g: 0, b: 255 })

        const out = path.join(workDir, 'out-three')
        const result = await new AtlasBuilder({
            output: { directory: out, baseName: 'sprites', format: 'png' },
            packer: { padding: 0, allowRotation: false, pot: 'none' },
            useAlphaTrimming: false
        }).build([
            { id: 'red', path: a },
            { id: 'green', path: b },
            { id: 'blue', path: c }
        ])

        expect(result.pages.length).toBe(1)
        expect(result.unpacked.length).toBe(0)
        expect(result.pages[0].frames.length).toBe(3)
        const ids = result.pages[0].frames.map(f => f.id).sort()
        expect(ids).toEqual(['blue', 'green', 'red'])
        expect(result.manifestPath).not.toBeNull()
        const manifestRaw = await fs.readFile(result.manifestPath!, 'utf8')
        const manifest = JSON.parse(manifestRaw)
        expect(manifest.version).toBe(1)
        expect(manifest.format).toBe('png')
        expect(manifest.pages).toHaveLength(1)
        expect(manifest.pages[0].file).toBe('sprites.png')
        expect(manifest.pages[0].frames).toHaveLength(3)
    })

    it('places frame pixels matching source colors', async () => {
        const dir = path.join(workDir, 'pixel')
        await fs.mkdir(dir, { recursive: true })
        const red = path.join(dir, 'red.png')
        const green = path.join(dir, 'green.png')
        await writeSolidPng(red, 32, 32, { r: 255, g: 0, b: 0 })
        await writeSolidPng(green, 32, 32, { r: 0, g: 255, b: 0 })

        const out = path.join(workDir, 'out-pixel')
        const result = await new AtlasBuilder({
            output: { directory: out, baseName: 'pixel', format: 'png' },
            packer: { padding: 0, allowRotation: false, pot: 'none' },
            useAlphaTrimming: false
        }).build([
            { id: 'red', path: red },
            { id: 'green', path: green }
        ])

        for (const frame of result.pages[0].frames) {
            const cx = frame.rect.x + Math.floor(frame.rect.width / 2)
            const cy = frame.rect.y + Math.floor(frame.rect.height / 2)
            const pixel = await readPixel(result.pages[0].file, cx, cy)
            if (frame.id === 'red') {
                expect(pixel.r).toBeGreaterThan(200)
                expect(pixel.g).toBeLessThan(50)
            } else {
                expect(pixel.g).toBeGreaterThan(200)
                expect(pixel.r).toBeLessThan(50)
            }
        }
    })

    it('produces multiple pages when bounds force overflow', async () => {
        const dir = path.join(workDir, 'multi')
        await fs.mkdir(dir, { recursive: true })
        const inputs = []
        for (let i = 0; i < 6; i++) {
            const file = path.join(dir, `s${i}.png`)
            await writeSolidPng(file, 200, 200, { r: i * 40, g: 50, b: 50 })
            inputs.push({ id: `s${i}`, path: file })
        }
        const out = path.join(workDir, 'out-multi')
        const result = await new AtlasBuilder({
            output: { directory: out, baseName: 'multi', format: 'png' },
            packer: { padding: 0, maxWidth: 256, maxHeight: 256, pot: 'none' },
            useAlphaTrimming: false
        }).build(inputs)

        expect(result.pages.length).toBeGreaterThan(1)
        const totalFrames = result.pages.reduce((sum, p) => sum + p.frames.length, 0)
        expect(totalFrames).toBe(6)
    })

    it('reports unpacked sprites without throwing', async () => {
        const dir = path.join(workDir, 'unpacked')
        await fs.mkdir(dir, { recursive: true })
        const big = path.join(dir, 'big.png')
        const small = path.join(dir, 'small.png')
        await writeSolidPng(big, 600, 600, { r: 100, g: 100, b: 100 })
        await writeSolidPng(small, 32, 32, { r: 0, g: 0, b: 200 })

        const out = path.join(workDir, 'out-unpacked')
        const result = await new AtlasBuilder({
            output: { directory: out, baseName: 'unp', format: 'png' },
            packer: { padding: 0, maxWidth: 256, maxHeight: 256, pot: 'none' },
            useAlphaTrimming: false
        }).build([
            { id: 'big', path: big },
            { id: 'small', path: small }
        ])

        expect(result.unpacked.length).toBe(1)
        expect(result.unpacked[0].id).toBe('big')
        expect(result.pages.flatMap(p => p.frames.map(f => f.id))).toContain('small')
    })

    it('throws AtlasBuildError(decode) on missing input file', async () => {
        const out = path.join(workDir, 'out-missing')
        const builder = new AtlasBuilder({ output: { directory: out } })
        await expect(builder.build([{ id: 'x', path: '/no/such/file.png' }])).rejects.toMatchObject({
            name: 'AtlasBuildError',
            stage: 'decode'
        })
    })

    it('skips manifest when writeManifest is false', async () => {
        const dir = path.join(workDir, 'no-manifest')
        await fs.mkdir(dir, { recursive: true })
        const a = path.join(dir, 'a.png')
        await writeSolidPng(a, 8, 8, { r: 200, g: 200, b: 0 })
        const out = path.join(workDir, 'out-no-manifest')
        const result = await new AtlasBuilder({
            output: { directory: out, baseName: 'silent', format: 'png' },
            packer: { padding: 0, allowRotation: false, pot: 'none' },
            useAlphaTrimming: false,
            writeManifest: false
        }).build([{ id: 'a', path: a }])
        expect(result.manifestPath).toBeNull()
    })

    it('writes webp output when requested', async () => {
        const dir = path.join(workDir, 'webp')
        await fs.mkdir(dir, { recursive: true })
        const a = path.join(dir, 'a.png')
        await writeSolidPng(a, 8, 8, { r: 0, g: 200, b: 200 })
        const out = path.join(workDir, 'out-webp')
        const result = await new AtlasBuilder({
            output: { directory: out, baseName: 'webp-atlas', format: 'webp' },
            packer: { padding: 0, allowRotation: false, pot: 'none' },
            useAlphaTrimming: false
        }).build([{ id: 'a', path: a }])
        expect(result.pages[0].file.endsWith('.webp')).toBe(true)
        const stat = await fs.stat(result.pages[0].file)
        expect(stat.size).toBeGreaterThan(0)
    })
})

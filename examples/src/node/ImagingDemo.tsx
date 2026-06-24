import { NodeDemoCard } from './_demo/NodeDemo'

const processorCode = `// Everything below runs on the server — requires Node.js + the optional 'sharp' peer.
// sharp is loaded lazily on the first terminal call (metadata / toBuffer / toFile).

import { ImageProcessor, ImageProcessorError } from '@toolcase/node'

// ── 1. Inspect — metadata() is a terminal call that decodes the header only ──
const meta = await ImageProcessor.fromPath('./uploads/avatar.png').metadata()
// → { format: 'png', width: 1024, height: 1024, channels: 4, hasAlpha: true, size: 248_513 }

// ── 2. Transform — resize / crop queue ops on an immutable ImageProcessor ────
// Each builder method returns a NEW instance, so a base pipeline forks safely.
const base = ImageProcessor.fromPath('./uploads/avatar.png')
    .crop({ left: 112, top: 112, width: 800, height: 800 })   // square out the centre
    .resize({ width: 256, height: 256, fit: 'cover', withoutEnlargement: true })

// ── 3. Encode + optimise — fork the base into two output formats ─────────────
// format() picks the encoder; optimize() tunes it (mozjpeg / palette / effort)
// and strips metadata by default. The sharp pipeline is rebuilt fresh per chain.
const webp = await base
    .format({ format: 'webp', quality: 80 })
    .optimize({ format: 'webp', quality: 80, effort: 6, stripMetadata: true })
    .toFile('./public/avatar.webp')
// → { format: 'webp', width: 256, height: 256, channels: 4, hasAlpha: true, size: 9_204 }

const avif: Buffer = await base
    .format({ format: 'avif', quality: 50 })
    .optimize({ format: 'avif', quality: 50 })
    .toBuffer()

// ── 4. Errors funnel through ImageProcessorError ─────────────────────────────
// invalid-buffer / invalid-path / crop-invalid throw eagerly from the builder;
// decode-failed / crop-out-of-bounds / metadata-failed / encode-failed /
// write-failed surface lazily on the terminal call (with the offending path).
try {
    await ImageProcessor.fromPath('./uploads/avatar.png')
        .crop({ left: 9000, top: 9000, width: 64, height: 64 })   // outside the image
        .toBuffer()
} catch (error) {
    if (error instanceof ImageProcessorError) {
        console.error(error.reason, error.path)   // 'crop-out-of-bounds' './uploads/avatar.png'
    }
}`

const atlasCode = `// Server-side only — sharp + node:fs. Composes the Packer from @toolcase/base
// with sharp compositing to produce atlas page images plus a JSON manifest.

import { AtlasBuilder, type AtlasResult } from '@toolcase/node'

const result: AtlasResult = await new AtlasBuilder({
    output: { directory: './dist/atlases', baseName: 'characters', format: 'webp', quality: 80 },
    packer: { algorithm: 'max-rects', allowRotation: true, padding: 2, pot: 'page' },
    optimize: true,             // run ImageProcessor.optimize on each composed page
    useAlphaTrimming: true,     // trim transparent borders before packing (default)
    continueOnError: true,      // skip undecodable inputs → result.failures (don't throw)
}).build([
    { id: 'hero-idle-0', path: './sprites/hero-idle-0.png' },
    { id: 'hero-idle-1', path: './sprites/hero-idle-1.png' },
    { id: 'hero-run-0',  path: './sprites/hero-run-0.png' },
    { id: 'hero-run-1',  path: './sprites/hero-run-1.png' },
])

// One page (small set), packed into a single power-of-two atlas image.
const page = result.pages[0]
console.log(page.file)                 // absolute path → .../characters.webp
console.log(page.width, page.height)   // e.g. 256 128
console.log(page.occupancy)            // packing efficiency, 0..1

// Per-sprite frames carry the atlas rect + original source geometry (offset from
// alpha trimming), so a loader can re-expand each frame to its untrimmed size.
for (const frame of page.frames) {
    console.log(frame.id, frame.rect, 'trim:', frame.source.offsetX, frame.source.offsetY)
    // hero-idle-0 { x: 2, y: 2, width: 60, height: 92 } trim: 2 2
}

// Sprites the packer couldn't place (over budget / too large) are reported, not dropped.
for (const u of result.unpacked) console.warn('unpacked:', u.id, u.width, u.height)

// Inputs that failed to decode when continueOnError is set (e.g. a corrupt file).
for (const f of result.failures) console.warn('failed:', f.input.id, f.stage, f.error.message)

console.log(result.manifestPath)   // absolute path → .../characters.json (null if writeManifest:false)`

export const ImagingDemo = () => (
    <div className="vstack gap-3">
        <NodeDemoCard
            title="ImageProcessor Pipeline"
            description="Chainable, immutable wrapper around sharp: metadata() inspects, resize()/crop() queue transforms, format() picks an encoder, and optimize() tunes it (mozjpeg / palette / effort, metadata stripped by default). Builder methods fork safely; the sharp pipeline is rebuilt fresh on each terminal call (metadata / toBuffer / toFile), and sharp is import()-ed lazily on first use. Errors funnel through ImageProcessorError. Server-side only — needs Node.js + the optional 'sharp' peer."
            code={processorCode}
        />
        <NodeDemoCard
            title="AtlasBuilder Pack"
            description="Reads sprite images from disk, packs them with the Packer from @toolcase/base (max-rects, alpha-trimming, optional rotation, power-of-two pages), composites each page into a single atlas image via sharp, and writes the pages plus a JSON manifest. Returns per-frame atlas rects with original source geometry, unplaced sprites, and decode failures (when continueOnError is set). Server-side only — needs Node.js + the optional 'sharp' peer."
            code={atlasCode}
        />
    </div>
)

export default ImagingDemo

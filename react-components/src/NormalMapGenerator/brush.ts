import { normalsFromHeight, HeightRect } from './generate'
import { NormalBrush, NormalMapGenOptions, StructurePattern } from './types'

type Vec3 = [number, number, number]

// ── Vector-space pack/unpack (shared with task 001's packing convention) ──

/** RGB byte → unit-ish normal in [-1, 1]. */
export const unpack = (r: number, g: number, b: number): Vec3 => [r / 127.5 - 1, g / 127.5 - 1, b / 127.5 - 1]

/** Normal → RGB byte, renormalizing first. */
export const pack = (n: Vec3): Vec3 => {
    const l = Math.hypot(n[0], n[1], n[2]) || 1
    return [(n[0] / l) * 127.5 + 127.5, (n[1] / l) * 127.5 + 127.5, (n[2] / l) * 127.5 + 127.5]
}

export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
]

const normalize3 = (n: Vec3): Vec3 => {
    const l = Math.hypot(n[0], n[1], n[2]) || 1
    return [n[0] / l, n[1] / l, n[2] / l]
}

const smoothstep = (edge0: number, edge1: number, x: number): number => {
    let t = (x - edge0) / (edge1 - edge0)
    t = t < 0 ? 0 : t > 1 ? 1 : t
    return t * t * (3 - 2 * t)
}

// ── Baked structure tiles (procedural, deterministic — built once) ──

const TILE = 32
const TILE_GAIN = 2.5

const hash2 = (x: number, y: number): number => {
    let n = (x * 374761393 + y * 668265263) | 0
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) >>> 0) / 4294967295
}

/** Toroidal jittered feature points on a G×G grid (seamless across tile edges). */
const featurePoints = (g: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = []
    const cell = TILE / g
    for (let gy = 0; gy < g; gy++) {
        for (let gx = 0; gx < g; gx++) {
            const jx = (gx + hash2(gx, gy)) * cell
            const jy = (gy + hash2(gx + 17, gy + 31)) * cell
            pts.push([jx, jy])
        }
    }
    return pts
}

/** Toroidal distance² between (x,y) and a feature point. */
const toroidalD2 = (x: number, y: number, px: number, py: number): number => {
    let dx = Math.abs(x - px)
    let dy = Math.abs(y - py)
    if (dx > TILE / 2) dx = TILE - dx
    if (dy > TILE / 2) dy = TILE - dy
    return dx * dx + dy * dy
}

const nearestTwo = (pts: Array<[number, number]>, x: number, y: number): [number, number] => {
    let d1 = Infinity
    let d2 = Infinity
    for (const [px, py] of pts) {
        const d = toroidalD2(x, y, px, py)
        if (d < d1) {
            d2 = d1
            d1 = d
        } else if (d < d2) {
            d2 = d
        }
    }
    return [Math.sqrt(d1), Math.sqrt(d2)]
}

const heightFns: Record<StructurePattern, (x: number, y: number) => number> = {
    // Scaly domes — bright at each jittered cell center.
    reptile: (() => {
        const pts = featurePoints(4)
        const cell = TILE / 4
        return (x, y) => {
            const [d1] = nearestTwo(pts, x, y)
            return Math.max(0, 1 - d1 / cell)
        }
    })(),
    // Vertical fibers — wavy streaks along Y.
    furry: (x, y) => {
        const band = Math.floor(x)
        const phase = hash2(band, 0) * Math.PI * 2
        return 0.5 + 0.5 * Math.sin(y * 0.6 + phase) * (0.4 + 0.6 * hash2(band, 7))
    },
    // Voronoi crack ridges — valleys along cell borders.
    cracked: (() => {
        const pts = featurePoints(3)
        return (x, y) => {
            const [d1, d2] = nearestTwo(pts, x, y)
            const edge = d2 - d1 // small near borders
            return Math.min(1, edge / 4)
        }
    })(),
}

const sampleWrap = (h: Float32Array, x: number, y: number): number =>
    h[(((y % TILE) + TILE) % TILE) * TILE + (((x % TILE) + TILE) % TILE)]

const buildTile = (fn: (x: number, y: number) => number): { w: number; h: number; normals: Float32Array } => {
    const hmap = new Float32Array(TILE * TILE)
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) hmap[y * TILE + x] = fn(x, y)
    }
    const normals = new Float32Array(TILE * TILE * 3)
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const tl = sampleWrap(hmap, x - 1, y - 1)
            const t = sampleWrap(hmap, x, y - 1)
            const tr = sampleWrap(hmap, x + 1, y - 1)
            const l = sampleWrap(hmap, x - 1, y)
            const r = sampleWrap(hmap, x + 1, y)
            const bl = sampleWrap(hmap, x - 1, y + 1)
            const bo = sampleWrap(hmap, x, y + 1)
            const br = sampleWrap(hmap, x + 1, y + 1)
            const dx = tr + 2 * r + br - (tl + 2 * l + bl)
            const dy = bl + 2 * bo + br - (tl + 2 * t + tr)
            const n = normalize3([-dx * TILE_GAIN, -dy * TILE_GAIN, 1])
            const o = (y * TILE + x) * 3
            normals[o] = n[0]
            normals[o + 1] = n[1]
            normals[o + 2] = n[2]
        }
    }
    return { w: TILE, h: TILE, normals }
}

export const STRUCTURE_TILES: Record<StructurePattern, { w: number; h: number; normals: Float32Array }> = {
    reptile: buildTile(heightFns.reptile),
    furry: buildTile(heightFns.furry),
    cracked: buildTile(heightFns.cracked),
}

// ── Brush application ──

/** Per-stamp height-delta gain so a `strength` 0..1 reads as visible bump accumulation. */
const HEIGHT_GAIN = 1.5

export interface ApplyBrushParams {
    working: Uint8ClampedArray
    source: Uint8ClampedArray
    /** Immutable auto-generated normals — the `eraseTarget: 'auto'` target. */
    auto: Uint8ClampedArray
    w: number
    h: number
    cx: number
    cy: number
    brush: NormalBrush
    maskToAlpha: boolean
    /** Live combined height (base + accumulated height-delta) — height brush reads/writes this. */
    combinedHeight: Float32Array
    /** Accumulated height-brush edits (for undo/reset bookkeeping). */
    heightDelta: Float32Array
    genOpts: Pick<NormalMapGenOptions, 'strength' | 'invertX' | 'invertY'> & { flatColor: [number, number, number] }
    /** Optional selection mask (task 004) — multiplies brush falloff by `mask[idx]/255`. */
    selection?: Uint8Array | null
}

/** Stamps the brush once at (cx, cy). Mutates `working` (and height buffers for the height brush). Returns the dirty rect. */
export const applyBrush = (p: ApplyBrushParams): HeightRect => {
    const { working, source, auto, w, h, cx, cy, brush, maskToAlpha, combinedHeight, heightDelta, genOpts, selection } = p
    const size = Math.max(1, brush.size)
    const inner = size * (1 - brush.hardness)

    const x0 = Math.max(0, Math.floor(cx - size))
    const y0 = Math.max(0, Math.floor(cy - size))
    const x1 = Math.min(w - 1, Math.ceil(cx + size))
    const y1 = Math.min(h - 1, Math.ceil(cy + size))

    const falloff = (d: number): number => (brush.hardness >= 1 ? 1 : smoothstep(size, inner, d))

    // Height brush — accumulate a dome into the height buffers, then re-derive the padded rect.
    if (brush.mode === 'height') {
        const sign = brush.heightSign ?? 1
        for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
                const d = Math.hypot(x - cx, y - cy)
                if (d > size) continue
                const idx = y * w + x
                if (maskToAlpha && source[idx * 4 + 3] === 0) continue
                const cov = selection ? selection[idx] / 255 : 1
                if (cov <= 0) continue
                const dome = falloff(d) * cov
                const add = sign * brush.strength * dome * HEIGHT_GAIN
                heightDelta[idx] += add
                combinedHeight[idx] += add
            }
        }
        const rect: HeightRect = { x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1 }
        normalsFromHeight(combinedHeight, source, w, h, genOpts, working, rect)
        return rect
    }

    const dir = brush.direction ? normalize3(brush.direction) : ([0, 0, 1] as Vec3)
    const tile = STRUCTURE_TILES[brush.pattern ?? 'reptile']

    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const d = Math.hypot(x - cx, y - cy)
            if (d > size) continue
            const idx = y * w + x
            const o = idx * 4
            if (maskToAlpha && source[o + 3] === 0) continue
            const cov = selection ? selection[idx] / 255 : 1
            if (cov <= 0) continue

            const f = falloff(d) * brush.strength * cov
            if (f <= 0) continue

            const cur = unpack(working[o], working[o + 1], working[o + 2])
            let target: Vec3

            switch (brush.mode) {
                case 'direction':
                    target = dir
                    break
                case 'smooth': {
                    // Bounds-check x like y below — otherwise the flat-buffer
                    // index wraps onto the adjacent row at column edges.
                    const lI = (idx - 1) * 4
                    const rI = (idx + 1) * 4
                    const left = x > 0 ? unpack(working[lI], working[lI + 1], working[lI + 2]) : cur
                    const right = x < w - 1 ? unpack(working[rI], working[rI + 1], working[rI + 2]) : cur
                    const upI = (idx - w) * 4
                    const dnI = (idx + w) * 4
                    const up = y > 0 ? unpack(working[upI], working[upI + 1], working[upI + 2]) : cur
                    const dn = y < h - 1 ? unpack(working[dnI], working[dnI + 1], working[dnI + 2]) : cur
                    target = normalize3([
                        (left[0] + right[0] + up[0] + dn[0]) / 4,
                        (left[1] + right[1] + up[1] + dn[1]) / 4,
                        (left[2] + right[2] + up[2] + dn[2]) / 4,
                    ])
                    break
                }
                case 'structure': {
                    const to = ((y % tile.h) * tile.w + (x % tile.w)) * 3
                    target = [tile.normals[to], tile.normals[to + 1], tile.normals[to + 2]]
                    break
                }
                case 'erase':
                default:
                    target =
                        brush.eraseTarget === 'auto'
                            ? unpack(auto[o], auto[o + 1], auto[o + 2])
                            : ([0, 0, 1] as Vec3)
                    break
            }

            const out = pack(lerp3(cur, target, Math.min(1, f)))
            working[o] = out[0]
            working[o + 1] = out[1]
            working[o + 2] = out[2]
        }
    }

    return { x0, y0, x1, y1 }
}

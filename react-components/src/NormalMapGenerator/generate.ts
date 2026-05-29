import { BevelDirection, NormalMapGenOptions } from './types'

// Rec. 601 luminance weights.
const LUMA_R = 0.299
const LUMA_G = 0.587
const LUMA_B = 0.114

// Chamfer distance weights (orthogonal / diagonal).
const D_ORTHO = 1
const D_DIAG = Math.SQRT2

/** Reads a distance sample, wrapping when `tileMode`, else treating out-of-bounds as a transparent edge (dist 0). */
const sampleDist = (dist: Float32Array, w: number, h: number, x: number, y: number, tileMode: boolean): number => {
    if (x < 0 || x >= w || y < 0 || y >= h) {
        if (!tileMode) return 0
        const wx = ((x % w) + w) % w
        const wy = ((y % h) + h) % h
        return dist[wy * w + wx]
    }
    return dist[y * w + x]
}

/** Clamps a sample coordinate to the heightmap bounds (edge replication). */
const clampSample = (height: Float32Array, w: number, h: number, x: number, y: number): number => {
    const cx = x < 0 ? 0 : x >= w ? w - 1 : x
    const cy = y < 0 ? 0 : y >= h ? h - 1 : y
    return height[cy * w + cx]
}

/** Luminance heightmap from RGBA (Rec. 601 weights), scaled by `embossHeight`. */
export const toHeightmap = (rgba: Uint8ClampedArray, w: number, h: number, embossHeight: number): Float32Array => {
    const out = new Float32Array(w * h)
    if (embossHeight === 0) return out
    for (let i = 0; i < out.length; i++) {
        const o = i * 4
        const lum = (LUMA_R * rgba[o] + LUMA_G * rgba[o + 1] + LUMA_B * rgba[o + 2]) / 255
        out[i] = lum * embossHeight
    }
    return out
}

/**
 * Two-pass chamfer distance transform: px distance from the nearest transparent
 * (`alpha === 0`) pixel. `tileMode=false` treats the canvas border as a
 * transparent edge; `tileMode=true` wraps (no edge).
 */
export const alphaToDistance = (rgba: Uint8ClampedArray, w: number, h: number, tileMode: boolean): Float32Array => {
    const dist = new Float32Array(w * h)
    for (let i = 0; i < dist.length; i++) {
        dist[i] = rgba[i * 4 + 3] === 0 ? 0 : Infinity
    }

    // Forward pass — top-left → bottom-right.
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x
            if (dist[i] === 0) continue
            let d = dist[i]
            d = Math.min(d, sampleDist(dist, w, h, x - 1, y, tileMode) + D_ORTHO)
            d = Math.min(d, sampleDist(dist, w, h, x, y - 1, tileMode) + D_ORTHO)
            d = Math.min(d, sampleDist(dist, w, h, x - 1, y - 1, tileMode) + D_DIAG)
            d = Math.min(d, sampleDist(dist, w, h, x + 1, y - 1, tileMode) + D_DIAG)
            dist[i] = d
        }
    }

    // Backward pass — bottom-right → top-left.
    for (let y = h - 1; y >= 0; y--) {
        for (let x = w - 1; x >= 0; x--) {
            const i = y * w + x
            if (dist[i] === 0) continue
            let d = dist[i]
            d = Math.min(d, sampleDist(dist, w, h, x + 1, y, tileMode) + D_ORTHO)
            d = Math.min(d, sampleDist(dist, w, h, x, y + 1, tileMode) + D_ORTHO)
            d = Math.min(d, sampleDist(dist, w, h, x + 1, y + 1, tileMode) + D_DIAG)
            d = Math.min(d, sampleDist(dist, w, h, x - 1, y + 1, tileMode) + D_DIAG)
            dist[i] = d
        }
    }

    return dist
}

/** Alpha-bevel heightmap: clamp distance to `bevelWidth`, ramp to `bevelHeight`, flip for `recessed`. */
export const bevelHeightmap = (
    dist: Float32Array,
    w: number,
    h: number,
    bevelWidth: number,
    bevelHeight: number,
    direction: BevelDirection,
): Float32Array => {
    const out = new Float32Array(w * h)
    if (bevelWidth <= 0) return out
    const sign = direction === 'recessed' ? -1 : 1
    for (let i = 0; i < out.length; i++) {
        const d = Math.min(dist[i], bevelWidth)
        out[i] = (d / bevelWidth) * bevelHeight * sign
    }
    return out
}

/** In-place separable box blur, `radius` px (skips when `radius <= 0`). */
export const blurHeightmap = (height: Float32Array, w: number, h: number, radius: number): Float32Array => {
    const r = Math.floor(radius)
    if (r <= 0) return height
    const win = r * 2 + 1
    const tmp = new Float32Array(w * h)

    // Horizontal.
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0
            for (let k = -r; k <= r; k++) {
                let sx = x + k
                if (sx < 0) sx = 0
                else if (sx >= w) sx = w - 1
                sum += height[y * w + sx]
            }
            tmp[y * w + x] = sum / win
        }
    }

    // Vertical.
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0
            for (let k = -r; k <= r; k++) {
                let sy = y + k
                if (sy < 0) sy = 0
                else if (sy >= h) sy = h - 1
                sum += tmp[sy * w + x]
            }
            height[y * w + x] = sum / win
        }
    }

    return height
}

/** Rectangle (inclusive bounds) for limiting a normal re-derive to a dirty region. */
export interface HeightRect {
    x0: number
    y0: number
    x1: number
    y1: number
}

/** Combined emboss + bevel heightmap (blurred). The height-brush base — task 002 caches this. */
export const buildHeightmap = (
    rgba: Uint8ClampedArray,
    w: number,
    h: number,
    opts: Pick<NormalMapGenOptions, 'embossHeight' | 'bevelWidth' | 'bevelHeight' | 'bevelDirection' | 'tileMode' | 'blur'>,
): Float32Array => {
    const height = new Float32Array(w * h)

    if (opts.embossHeight !== 0) {
        const emboss = toHeightmap(rgba, w, h, opts.embossHeight)
        for (let i = 0; i < height.length; i++) height[i] += emboss[i]
    }

    if (opts.bevelWidth > 0) {
        const bevel = bevelHeightmap(
            alphaToDistance(rgba, w, h, opts.tileMode),
            w,
            h,
            opts.bevelWidth,
            opts.bevelHeight,
            opts.bevelDirection,
        )
        for (let i = 0; i < height.length; i++) height[i] += bevel[i]
    }

    blurHeightmap(height, w, h, opts.blur)
    return height
}

/**
 * Sobel → normal → pack over `height`. Writes into `out` (allocated if omitted).
 * When `rect` is given, only that inclusive region is recomputed (task 002 height brush).
 * Transparent source pixels (`alpha === 0`) get `flatColor` RGB with `a = 0`.
 */
export const normalsFromHeight = (
    height: Float32Array,
    rgba: Uint8ClampedArray,
    w: number,
    h: number,
    opts: Pick<NormalMapGenOptions, 'strength' | 'invertX' | 'invertY'> & { flatColor: [number, number, number] },
    out: Uint8ClampedArray = new Uint8ClampedArray(w * h * 4),
    rect?: HeightRect,
): Uint8ClampedArray => {
    const { strength, invertX, invertY, flatColor } = opts
    const sx = invertX ? -1 : 1
    const sy = invertY ? -1 : 1

    const x0 = rect ? Math.max(0, rect.x0) : 0
    const y0 = rect ? Math.max(0, rect.y0) : 0
    const x1 = rect ? Math.min(w - 1, rect.x1) : w - 1
    const y1 = rect ? Math.min(h - 1, rect.y1) : h - 1

    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const idx = y * w + x
            const o = idx * 4
            const srcA = rgba[o + 3]

            if (srcA === 0) {
                out[o] = flatColor[0]
                out[o + 1] = flatColor[1]
                out[o + 2] = flatColor[2]
                out[o + 3] = 0
                continue
            }

            // Sobel on the combined heightmap.
            const tl = clampSample(height, w, h, x - 1, y - 1)
            const t = clampSample(height, w, h, x, y - 1)
            const tr = clampSample(height, w, h, x + 1, y - 1)
            const l = clampSample(height, w, h, x - 1, y)
            const rr = clampSample(height, w, h, x + 1, y)
            const bl = clampSample(height, w, h, x - 1, y + 1)
            const bo = clampSample(height, w, h, x, y + 1)
            const br = clampSample(height, w, h, x + 1, y + 1)

            const dx = tr + 2 * rr + br - (tl + 2 * l + bl)
            const dy = bl + 2 * bo + br - (tl + 2 * t + tr)

            let nx = -dx * strength * sx
            let ny = -dy * strength * sy
            let nz = 1
            const len = Math.hypot(nx, ny, nz) || 1
            nx /= len
            ny /= len
            nz /= len

            out[o] = (nx * 0.5 + 0.5) * 255
            out[o + 1] = (ny * 0.5 + 0.5) * 255
            out[o + 2] = (nz * 0.5 + 0.5) * 255
            out[o + 3] = srcA
        }
    }

    return out
}

/**
 * The core — combine emboss + bevel → blur → Sobel → normal → pack. Pure, no DOM.
 * Transparent source pixels (`alpha === 0`) get `flatColor` RGB with `a = 0`.
 */
export const generateNormalMap = (
    rgba: Uint8ClampedArray,
    w: number,
    h: number,
    opts: NormalMapGenOptions & { flatColor: [number, number, number] },
): Uint8ClampedArray => {
    const height = buildHeightmap(rgba, w, h, opts)
    return normalsFromHeight(height, rgba, w, h, opts)
}

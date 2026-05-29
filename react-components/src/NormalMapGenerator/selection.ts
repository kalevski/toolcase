// Selection mask helpers (task 004). A single-channel Uint8 coverage mask
// (0..255) gates generation and brush painting. `null` = whole sprite.

/** Rasterize a polygon (lasso) to a 0/255 mask via even-odd scanline fill. */
export const polygonToMask = (pts: [number, number][], w: number, h: number): Uint8Array => {
    const mask = new Uint8Array(w * h)
    if (pts.length < 3) return mask

    for (let y = 0; y < h; y++) {
        const yc = y + 0.5
        const xs: number[] = []
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i]
            const [xj, yj] = pts[j]
            if (yi > yc !== yj > yc) {
                xs.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi))
            }
        }
        xs.sort((a, b) => a - b)
        for (let k = 0; k + 1 < xs.length; k += 2) {
            const x0 = Math.max(0, Math.ceil(xs[k] - 0.5))
            const x1 = Math.min(w - 1, Math.floor(xs[k + 1] - 0.5))
            for (let x = x0; x <= x1; x++) mask[y * w + x] = 255
        }
    }
    return mask
}

/** Flood fill from a seed by alpha + normal similarity. `tol` 0..1 over normalized distance. */
export const wandSelect = (
    rgba: Uint8ClampedArray,
    normal: Uint8ClampedArray,
    w: number,
    h: number,
    sx: number,
    sy: number,
    tol: number,
): Uint8Array => {
    const mask = new Uint8Array(w * h)
    const px = Math.max(0, Math.min(w - 1, Math.round(sx)))
    const py = Math.max(0, Math.min(h - 1, Math.round(sy)))
    const seed = py * w + px

    const sa = rgba[seed * 4 + 3]
    const snx = normal[seed * 4] / 127.5 - 1
    const sny = normal[seed * 4 + 1] / 127.5 - 1
    const snz = normal[seed * 4 + 2] / 127.5 - 1

    const visited = new Uint8Array(w * h)
    const stack = [seed]
    visited[seed] = 1

    while (stack.length) {
        const idx = stack.pop()!
        const o = idx * 4
        const ad = Math.abs(rgba[o + 3] - sa) / 255
        const dx = normal[o] / 127.5 - 1 - snx
        const dy = normal[o + 1] / 127.5 - 1 - sny
        const dz = normal[o + 2] / 127.5 - 1 - snz
        const nd = Math.hypot(dx, dy, dz) / 2 // max euclidean ≈ 2 → 0..1
        if (Math.max(ad, nd) > tol) continue

        mask[idx] = 255
        const x = idx % w
        const y = (idx - x) / w
        if (x > 0 && !visited[idx - 1]) {
            visited[idx - 1] = 1
            stack.push(idx - 1)
        }
        if (x < w - 1 && !visited[idx + 1]) {
            visited[idx + 1] = 1
            stack.push(idx + 1)
        }
        if (y > 0 && !visited[idx - w]) {
            visited[idx - w] = 1
            stack.push(idx - w)
        }
        if (y < h - 1 && !visited[idx + w]) {
            visited[idx + w] = 1
            stack.push(idx + w)
        }
    }
    return mask
}

/** In-place separable box-blur feather on a Uint8 mask channel (skips when `radius <= 0`). */
export const featherMask = (mask: Uint8Array, w: number, h: number, radius: number): Uint8Array => {
    const r = Math.floor(radius)
    if (r <= 0) return mask
    const win = r * 2 + 1
    const tmp = new Float32Array(w * h)

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0
            for (let k = -r; k <= r; k++) {
                let sxp = x + k
                if (sxp < 0) sxp = 0
                else if (sxp >= w) sxp = w - 1
                sum += mask[y * w + sxp]
            }
            tmp[y * w + x] = sum / win
        }
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0
            for (let k = -r; k <= r; k++) {
                let syp = y + k
                if (syp < 0) syp = 0
                else if (syp >= h) syp = h - 1
                sum += tmp[syp * w + x]
            }
            mask[y * w + x] = Math.min(255, Math.round(sum / win))
        }
    }
    return mask
}

/**
 * Combine a freshly-painted selection into the existing mask.
 * Shift = add (max), Alt = subtract, neither = replace. Returns null when empty.
 */
export const combineSelection = (
    existing: Uint8Array | null,
    next: Uint8Array,
    mode: 'replace' | 'add' | 'subtract',
): Uint8Array | null => {
    const out = new Uint8Array(next.length)
    let any = false
    for (let i = 0; i < next.length; i++) {
        let v: number
        if (mode === 'add') v = Math.max(existing ? existing[i] : 0, next[i])
        else if (mode === 'subtract') v = Math.round((existing ? existing[i] : 0) * (1 - next[i] / 255))
        else v = next[i]
        out[i] = v
        if (v > 0) any = true
    }
    return any ? out : null
}

/** Rectangle (inclusive px bounds) → 0/255 mask. */
export const rectToMask = (x0: number, y0: number, x1: number, y1: number, w: number, h: number): Uint8Array => {
    const mask = new Uint8Array(w * h)
    const ax = Math.max(0, Math.min(w - 1, Math.round(Math.min(x0, x1))))
    const bx = Math.max(0, Math.min(w - 1, Math.round(Math.max(x0, x1))))
    const ay = Math.max(0, Math.min(h - 1, Math.round(Math.min(y0, y1))))
    const by = Math.max(0, Math.min(h - 1, Math.round(Math.max(y0, y1))))
    for (let y = ay; y <= by; y++) {
        for (let x = ax; x <= bx; x++) mask[y * w + x] = 255
    }
    return mask
}

/** Boundary edge segments (source-px coords) for the marching-ants overlay. */
export const maskEdges = (mask: Uint8Array, w: number, h: number): number[] => {
    const seg: number[] = []
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] > 127
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!inside(x, y)) continue
            if (!inside(x - 1, y)) seg.push(x, y, x, y + 1)
            if (!inside(x + 1, y)) seg.push(x + 1, y, x + 1, y + 1)
            if (!inside(x, y - 1)) seg.push(x, y, x + 1, y)
            if (!inside(x, y + 1)) seg.push(x, y + 1, x + 1, y + 1)
        }
    }
    return seg
}

// Auto-trace: alpha silhouette → simplified polygon. All pure / DOM-free so the
// math is unit-testable. Pipeline: alphaMask → traceContour (Moore-neighbor
// boundary follow) → simplify (Douglas-Peucker, optionally to a target count).

export type Point = [number, number]

/** Binary opaque mask from RGBA alpha, `1` where `alpha >= threshold`. */
export const alphaMask = (rgba: Uint8ClampedArray, w: number, h: number, threshold: number): Uint8Array => {
    const mask = new Uint8Array(w * h)
    const t = Math.max(0, Math.min(255, threshold))
    for (let i = 0; i < w * h; i++) mask[i] = rgba[i * 4 + 3] >= t ? 1 : 0
    return mask
}

/**
 * Trace the outer boundary of the first opaque blob (in row-major order) via
 * Moore-neighbor tracing. Returns a closed ring of pixel points (no duplicated
 * closing vertex), or `[]` for an empty mask.
 */
export const traceContour = (mask: Uint8Array, w: number, h: number): Point[] => {
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x])

    // Find the start pixel: first opaque pixel in row-major order.
    let start = -1
    for (let i = 0; i < w * h; i++) {
        if (mask[i]) {
            start = i
            break
        }
    }
    if (start < 0) return []

    const sx = start % w
    const sy = (start - sx) / w

    // 8-neighborhood offsets, clockwise starting from west.
    const N = [
        [-1, 0],
        [-1, -1],
        [0, -1],
        [1, -1],
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
    ]

    const contour: Point[] = []
    let px = sx
    let py = sy
    // Backtrack direction: we entered the start from the west (outside).
    let backDir = 0
    let guard = 0
    const maxSteps = w * h * 8 + 16

    while (guard++ < maxSteps) {
        contour.push([px, py])
        // Search clockwise from the cell after the backtrack.
        let found = -1
        for (let k = 1; k <= 8; k++) {
            const dir = (backDir + k) % 8
            const nx = px + N[dir][0]
            const ny = py + N[dir][1]
            if (at(nx, ny)) {
                found = dir
                px = nx
                py = ny
                // New backtrack points back toward the cell we left.
                backDir = (dir + 4) % 8
                break
            }
        }
        if (found < 0) break // isolated pixel
        // Stop on the first return to the start pixel. The start is the
        // top-left-most opaque pixel — a convex corner — so the ring re-enters
        // it exactly once, when it closes. (The old two-pass guard walked the
        // whole boundary twice, producing a doubled polygon.)
        if (px === sx && py === sy) break
    }

    return contour
}

/** Perpendicular distance from `p` to the line through `a`,`b`. */
const perpDist = (p: Point, a: Point, b: Point): number => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1])
    return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len
}

/** Douglas-Peucker on an open polyline. */
const dpReduce = (pts: Point[], tolerance: number): Point[] => {
    if (pts.length < 3) return pts.slice()
    let maxD = 0
    let idx = 0
    const a = pts[0]
    const b = pts[pts.length - 1]
    for (let i = 1; i < pts.length - 1; i++) {
        const d = perpDist(pts[i], a, b)
        if (d > maxD) {
            maxD = d
            idx = i
        }
    }
    if (maxD > tolerance) {
        const left = dpReduce(pts.slice(0, idx + 1), tolerance)
        const right = dpReduce(pts.slice(idx), tolerance)
        return left.slice(0, -1).concat(right)
    }
    return [a, b]
}

/**
 * Simplify a closed ring (Douglas-Peucker). Splits at the two farthest points
 * so the closure isn't biased by the arbitrary start vertex.
 */
export const simplify = (ring: Point[], tolerance: number): Point[] => {
    if (ring.length <= 3 || tolerance <= 0) return ring.slice()

    // Farthest pair from ring[0] to anchor the split.
    let far = 0
    let farD = -1
    for (let i = 1; i < ring.length; i++) {
        const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
        if (d > farD) {
            farD = d
            far = i
        }
    }
    const first = dpReduce(ring.slice(0, far + 1), tolerance)
    const second = dpReduce(ring.slice(far).concat([ring[0]]), tolerance)
    // Drop shared endpoints to keep the ring unclosed.
    const out = first.slice(0, -1).concat(second.slice(0, -1))
    return out.length >= 3 ? out : ring.slice()
}

/** Simplify until the vertex count is <= `target`, via a bisection tolerance search. */
export const simplifyToCount = (ring: Point[], target: number): Point[] => {
    if (target < 3 || ring.length <= target) return ring.slice()
    let lo = 0
    let hi = 1
    // Grow hi until it undershoots the target.
    while (simplify(ring, hi).length > target && hi < 1e6) hi *= 2
    let best = simplify(ring, hi)
    for (let iter = 0; iter < 24; iter++) {
        const mid = (lo + hi) / 2
        const r = simplify(ring, mid)
        if (r.length > target) {
            lo = mid
        } else {
            best = r
            hi = mid
        }
    }
    return best
}

export interface AutoTraceOptions {
    alphaThreshold: number
    simplifyTolerance: number
    targetVertexCount: number
}

/**
 * Full auto-trace: alpha mask → contour → simplify. Returns a single closed ring
 * (caller wraps it in a PolygonShape and optionally decomposes). Empty when the
 * sprite is fully transparent.
 */
export const autoTrace = (
    rgba: Uint8ClampedArray,
    w: number,
    h: number,
    opts: AutoTraceOptions,
): Point[] => {
    const mask = alphaMask(rgba, w, h, opts.alphaThreshold)
    const contour = traceContour(mask, w, h)
    if (contour.length < 3) return []
    if (opts.targetVertexCount && opts.targetVertexCount >= 3) {
        return simplifyToCount(contour, opts.targetVertexCount)
    }
    return simplify(contour, opts.simplifyTolerance)
}

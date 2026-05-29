// Convex decomposition (FR-4) and convexity validation (FR-9). Bayazit's
// algorithm (the same approach as `poly-decomp`'s quickDecomp), ported to plain
// [x, y] arrays — pure, DOM-free, testable. Splits a simple polygon into convex
// sub-polygons by cutting from each reflex vertex.

export type Point = [number, number]

const area = (a: Point, b: Point, c: Point): number => (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
const isLeft = (a: Point, b: Point, c: Point) => area(a, b, c) > 0
const isLeftOn = (a: Point, b: Point, c: Point) => area(a, b, c) >= 0
const isRight = (a: Point, b: Point, c: Point) => area(a, b, c) < 0
const isRightOn = (a: Point, b: Point, c: Point) => area(a, b, c) <= 0
const sqdist = (a: Point, b: Point): number => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    return dx * dx + dy * dy
}

const at = (poly: Point[], i: number): Point => {
    const s = poly.length
    return poly[i < 0 ? (i % s) + s : i % s]
}

/** Signed area; > 0 for counter-clockwise winding. */
export const signedArea = (poly: Point[]): number => {
    let s = 0
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        s += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1])
    }
    return -s / 2
}

/** Reorder a ring counter-clockwise in place. */
export const makeCCW = (poly: Point[]): Point[] => {
    if (signedArea(poly) < 0) poly.reverse()
    return poly
}

const isReflex = (poly: Point[], i: number) => isRight(at(poly, i - 1), at(poly, i), at(poly, i + 1))

/** True when no interior angle is reflex (the ring is a convex polygon). */
export const isConvex = (poly: Point[]): boolean => {
    if (poly.length < 3) return false
    for (let i = 0; i < poly.length; i++) {
        if (isReflex(poly, i)) return false
    }
    return true
}

const lineInt = (a1: Point, a2: Point, b1: Point, b2: Point): Point => {
    const out: Point = [0, 0]
    const a = a2[1] - a1[1]
    const b = a1[0] - a2[0]
    const c = a * a1[0] + b * a1[1]
    const a3 = b2[1] - b1[1]
    const b3 = b1[0] - b2[0]
    const c3 = a3 * b1[0] + b3 * b1[1]
    const det = a * b3 - a3 * b
    if (Math.abs(det) > 1e-10) {
        out[0] = (b3 * c - b * c3) / det
        out[1] = (a * c3 - a3 * c) / det
    }
    return out
}

const quickDecomp = (polygon: Point[], result: Point[][], level: number): Point[][] => {
    if (polygon.length < 3) return result
    if (level > 100) {
        result.push(polygon)
        return result
    }

    for (let i = 0; i < polygon.length; i++) {
        if (!isReflex(polygon, i)) continue

        let upperInt: Point = [0, 0]
        let lowerInt: Point = [0, 0]
        let upperDist = Number.MAX_VALUE
        let lowerDist = Number.MAX_VALUE
        let upperIndex = 0
        let lowerIndex = 0

        for (let j = 0; j < polygon.length; j++) {
            if (
                isLeft(at(polygon, i - 1), at(polygon, i), at(polygon, j)) &&
                isRightOn(at(polygon, i - 1), at(polygon, i), at(polygon, j - 1))
            ) {
                const p = lineInt(at(polygon, i - 1), at(polygon, i), at(polygon, j), at(polygon, j - 1))
                if (isRight(at(polygon, i + 1), at(polygon, i), p)) {
                    const d = sqdist(polygon[i], p)
                    if (d < lowerDist) {
                        lowerDist = d
                        lowerInt = p
                        lowerIndex = j
                    }
                }
            }
            if (
                isLeft(at(polygon, i + 1), at(polygon, i), at(polygon, j + 1)) &&
                isRightOn(at(polygon, i + 1), at(polygon, i), at(polygon, j))
            ) {
                const p = lineInt(at(polygon, i + 1), at(polygon, i), at(polygon, j), at(polygon, j + 1))
                if (isLeft(at(polygon, i - 1), at(polygon, i), p)) {
                    const d = sqdist(polygon[i], p)
                    if (d < upperDist) {
                        upperDist = d
                        upperInt = p
                        upperIndex = j
                    }
                }
            }
        }

        let lowerPoly: Point[] = []
        let upperPoly: Point[] = []

        if (lowerIndex === (upperIndex + 1) % polygon.length) {
            // No vertex to connect to — add a Steiner point at the midpoint.
            const p: Point = [(lowerInt[0] + upperInt[0]) / 2, (lowerInt[1] + upperInt[1]) / 2]
            if (i < upperIndex) {
                lowerPoly = lowerPoly.concat(polygon.slice(i, upperIndex + 1))
                lowerPoly.push(p)
                upperPoly.push(p)
                if (lowerIndex !== 0) upperPoly = upperPoly.concat(polygon.slice(lowerIndex))
                upperPoly = upperPoly.concat(polygon.slice(0, i + 1))
            } else {
                if (i !== 0) lowerPoly = lowerPoly.concat(polygon.slice(i))
                lowerPoly = lowerPoly.concat(polygon.slice(0, upperIndex + 1))
                lowerPoly.push(p)
                upperPoly.push(p)
                upperPoly = upperPoly.concat(polygon.slice(lowerIndex, i + 1))
            }
        } else {
            // Connect to the closest visible vertex inside the candidate range.
            if (lowerIndex > upperIndex) upperIndex += polygon.length
            let closestDist = Number.MAX_VALUE
            let closestIndex = 0
            for (let j = lowerIndex; j <= upperIndex; j++) {
                if (
                    isLeftOn(at(polygon, i - 1), at(polygon, i), at(polygon, j)) &&
                    isRightOn(at(polygon, i + 1), at(polygon, i), at(polygon, j))
                ) {
                    const d = sqdist(at(polygon, i), at(polygon, j))
                    if (d < closestDist) {
                        closestDist = d
                        closestIndex = j % polygon.length
                    }
                }
            }
            if (i < closestIndex) {
                lowerPoly = lowerPoly.concat(polygon.slice(i, closestIndex + 1))
                if (closestIndex !== 0) upperPoly = upperPoly.concat(polygon.slice(closestIndex))
                upperPoly = upperPoly.concat(polygon.slice(0, i + 1))
            } else {
                if (i !== 0) lowerPoly = lowerPoly.concat(polygon.slice(i))
                lowerPoly = lowerPoly.concat(polygon.slice(0, closestIndex + 1))
                upperPoly = upperPoly.concat(polygon.slice(closestIndex, i + 1))
            }
        }

        // Recurse on the smaller piece first for shallower stacks.
        if (lowerPoly.length < upperPoly.length) {
            quickDecomp(lowerPoly, result, level + 1)
            quickDecomp(upperPoly, result, level + 1)
        } else {
            quickDecomp(upperPoly, result, level + 1)
            quickDecomp(lowerPoly, result, level + 1)
        }
        return result
    }

    // Already convex.
    result.push(polygon)
    return result
}

/**
 * Decompose a simple polygon into convex sub-polygons. Returns `[poly]` when the
 * input is already convex. The input is copied and forced CCW first.
 */
export const decomposePolygon = (points: Point[]): Point[][] => {
    if (points.length < 3) return [points.slice() as Point[]]
    const poly = points.map((p) => [p[0], p[1]] as Point)
    makeCCW(poly)
    if (isConvex(poly)) return [poly]
    return quickDecomp(poly, [], 0)
}

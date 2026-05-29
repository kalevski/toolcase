// Editing geometry helpers — snapping, hit-testing, bounds. Pure & DOM-free.

import { BoxShape, PhysicsShape, PolygonShape, SnapSettings } from './types'

export type Point = [number, number]

/** Apply pixel / grid snapping to a point (grid takes precedence when both on). */
export const snapPoint = (x: number, y: number, snap: SnapSettings): Point => {
    if (snap.grid && snap.gridSize > 0) {
        return [Math.round(x / snap.gridSize) * snap.gridSize, Math.round(y / snap.gridSize) * snap.gridSize]
    }
    if (snap.pixel) return [Math.round(x), Math.round(y)]
    return [x, y]
}

/** Squared distance from point `p` to segment `a`-`b`. */
export const distToSegmentSq = (p: Point, a: Point, b: Point): number => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len2 = dx * dx + dy * dy
    let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const cx = a[0] + t * dx
    const cy = a[1] + t * dy
    return (p[0] - cx) ** 2 + (p[1] - cy) ** 2
}

/** Even-odd point-in-polygon test. */
export const pointInPolygon = (p: Point, ring: Point[]): boolean => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
}

/** Editable vertex/handle points for a shape, in source px (for drawing + drag hit-testing). */
export const shapeVertices = (shape: PhysicsShape): Point[] => {
    if (shape.type === 'polygon') return shape.points
    if (shape.type === 'circle') return [shape.center, [shape.center[0] + shape.radius, shape.center[1]]]
    const { x, y, w, h } = shape.rect
    return [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
    ]
}

/** Hit-test a shape's vertices/handles; returns the vertex index within `tol` px or `-1`. */
export const hitVertex = (shape: PhysicsShape, p: Point, tol: number): number => {
    const verts = shapeVertices(shape)
    let best = -1
    let bestD = tol * tol
    for (let i = 0; i < verts.length; i++) {
        const d = (verts[i][0] - p[0]) ** 2 + (verts[i][1] - p[1]) ** 2
        if (d <= bestD) {
            bestD = d
            best = i
        }
    }
    return best
}

/** Hit-test the body of a shape (inside fill / radius). */
export const hitShape = (shape: PhysicsShape, p: Point): boolean => {
    if (shape.type === 'circle') {
        return (p[0] - shape.center[0]) ** 2 + (p[1] - shape.center[1]) ** 2 <= shape.radius ** 2
    }
    if (shape.type === 'box') {
        const { x, y, w, h } = shape.rect
        return p[0] >= x && p[0] <= x + w && p[1] >= y && p[1] <= y + h
    }
    return pointInPolygon(p, shape.points)
}

/** Nearest polygon edge (segment start index) to `p` within `tol`, else `-1`. For inserting vertices. */
export const nearestEdge = (poly: PolygonShape, p: Point, tol: number): number => {
    const pts = poly.points
    let best = -1
    let bestD = tol * tol
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i]
        const b = pts[(i + 1) % pts.length]
        const d = distToSegmentSq(p, a, b)
        if (d <= bestD) {
            bestD = d
            best = i
        }
    }
    return best
}

/** Translate a shape by `(dx, dy)`, returning a new shape. */
export const translateShape = (shape: PhysicsShape, dx: number, dy: number): PhysicsShape => {
    if (shape.type === 'polygon') {
        return { ...shape, points: shape.points.map(([x, y]) => [x + dx, y + dy] as Point) }
    }
    if (shape.type === 'circle') {
        return { ...shape, center: [shape.center[0] + dx, shape.center[1] + dy] }
    }
    return { ...shape, rect: { ...shape.rect, x: shape.rect.x + dx, y: shape.rect.y + dy } }
}

/** Move a single vertex/handle of a shape to `p`, returning a new shape. */
export const moveVertex = (shape: PhysicsShape, index: number, p: Point): PhysicsShape => {
    if (shape.type === 'polygon') {
        const points = shape.points.slice()
        points[index] = p
        return { ...shape, points }
    }
    if (shape.type === 'circle') {
        if (index === 0) {
            // Move center, keep radius.
            return { ...shape, center: p }
        }
        // Radius handle.
        return { ...shape, radius: Math.max(1, Math.hypot(p[0] - shape.center[0], p[1] - shape.center[1])) }
    }
    // Box: resize from the dragged corner, opposite corner fixed.
    const c = boxCorners(shape)
    const opp = c[(index + 2) % 4]
    const x = Math.min(p[0], opp[0])
    const y = Math.min(p[1], opp[1])
    const w = Math.abs(p[0] - opp[0])
    const h = Math.abs(p[1] - opp[1])
    return { ...shape, rect: { x, y, w: Math.max(1, w), h: Math.max(1, h) } }
}

const boxCorners = (shape: BoxShape): Point[] => {
    const { x, y, w, h } = shape.rect
    return [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
    ]
}

/** Axis-aligned bounds of a shape. */
export const shapeBounds = (shape: PhysicsShape): { minX: number; minY: number; maxX: number; maxY: number } => {
    if (shape.type === 'circle') {
        return {
            minX: shape.center[0] - shape.radius,
            minY: shape.center[1] - shape.radius,
            maxX: shape.center[0] + shape.radius,
            maxY: shape.center[1] + shape.radius,
        }
    }
    if (shape.type === 'box') {
        const { x, y, w, h } = shape.rect
        return { minX: x, minY: y, maxX: x + w, maxY: y + h }
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [x, y] of shape.points) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
    }
    return { minX, minY, maxX, maxY }
}

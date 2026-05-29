import { describe, it, expect } from 'vitest'
import { alphaMask, autoTrace, simplify, simplifyToCount, traceContour, Point } from '../src/PhysicsEditor/trace'
import { decomposePolygon, isConvex, makeCCW, signedArea } from '../src/PhysicsEditor/decompose'
import { exportShapes, validateShapes, ENGINE_CAPABILITIES } from '../src/PhysicsEditor/export'
import {
    hitShape,
    hitVertex,
    moveVertex,
    nearestEdge,
    pointInPolygon,
    snapPoint,
    translateShape,
} from '../src/PhysicsEditor/geometry'
import { BoxShape, CircleShape, PhysicsShape, PolygonShape, DEFAULT_SHAPE_PROPS } from '../src/PhysicsEditor/types'

/** Opaque RGBA rectangle inside a transparent canvas. */
const rectSprite = (w: number, h: number, rx: number, ry: number, rw: number, rh: number): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4
            const inside = x >= rx && x < rx + rw && y >= ry && y < ry + rh
            out[o] = out[o + 1] = out[o + 2] = 255
            out[o + 3] = inside ? 255 : 0
        }
    }
    return out
}

const props = () => ({ ...DEFAULT_SHAPE_PROPS })

describe('trace — alphaMask', () => {
    it('classifies opaque vs transparent by threshold', () => {
        const rgba = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 255])
        const m = alphaMask(rgba, 3, 1, 1)
        expect(Array.from(m)).toEqual([0, 1, 1])
    })
})

describe('trace — contour + simplify', () => {
    it('traces a closed loop around an opaque rectangle', () => {
        const w = 16
        const h = 16
        const mask = alphaMask(rectSprite(w, h, 4, 4, 6, 6), w, h, 1)
        const contour = traceContour(mask, w, h)
        expect(contour.length).toBeGreaterThanOrEqual(4)
        // All contour points lie within the opaque rect bounds.
        for (const [x, y] of contour) {
            expect(x).toBeGreaterThanOrEqual(4)
            expect(x).toBeLessThanOrEqual(9)
            expect(y).toBeGreaterThanOrEqual(4)
            expect(y).toBeLessThanOrEqual(9)
        }
    })

    it('empty mask yields no contour', () => {
        expect(traceContour(new Uint8Array(16), 4, 4)).toEqual([])
    })

    it('traces the boundary exactly once (no doubled ring)', () => {
        const w = 16
        const h = 16
        const mask = alphaMask(rectSprite(w, h, 4, 4, 6, 6), w, h, 1)
        const contour = traceContour(mask, w, h)
        // A 6×6 solid block has a 20-pixel perimeter; the old two-pass tracer
        // returned ~40 points (the ring walked twice).
        expect(contour.length).toBe(20)
        const seen = new Set(contour.map(([x, y]) => `${x},${y}`))
        expect(seen.size).toBe(contour.length)
    })

    it('simplify reduces a near-collinear ring to its corners', () => {
        const ring: Point[] = [
            [0, 0],
            [5, 0],
            [10, 0],
            [10, 10],
            [0, 10],
        ]
        const out = simplify(ring, 1)
        expect(out.length).toBe(4)
    })

    it('simplifyToCount hits the target vertex budget', () => {
        const ring: Point[] = []
        for (let i = 0; i < 64; i++) {
            const a = (i / 64) * Math.PI * 2
            ring.push([50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40])
        }
        const out = simplifyToCount(ring, 8)
        expect(out.length).toBeLessThanOrEqual(8)
        expect(out.length).toBeGreaterThanOrEqual(3)
    })

    it('autoTrace returns [] for a fully transparent sprite', () => {
        const rgba = new Uint8ClampedArray(8 * 8 * 4)
        expect(autoTrace(rgba, 8, 8, { alphaThreshold: 1, simplifyTolerance: 1, targetVertexCount: 0 })).toEqual([])
    })
})

describe('decompose', () => {
    it('signedArea is positive for CCW', () => {
        const ccw: Point[] = [
            [0, 0],
            [10, 0],
            [10, 10],
        ]
        expect(signedArea(ccw)).toBeGreaterThan(0)
    })

    it('makeCCW flips a CW ring', () => {
        const cw: Point[] = [
            [0, 0],
            [0, 10],
            [10, 10],
        ]
        makeCCW(cw)
        expect(signedArea(cw)).toBeGreaterThan(0)
    })

    it('isConvex detects a convex square and a concave arrow', () => {
        expect(
            isConvex([
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
            ]),
        ).toBe(true)
        // Concave "arrow" (notch at the right edge).
        const concave: Point[] = [
            [0, 0],
            [10, 5],
            [0, 10],
            [3, 5],
        ]
        expect(isConvex(concave)).toBe(false)
    })

    it('decomposePolygon leaves a convex polygon as a single piece', () => {
        const square: Point[] = [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
        ]
        expect(decomposePolygon(square)).toHaveLength(1)
    })

    it('decomposePolygon splits a concave polygon into convex pieces', () => {
        // Plus / cross shape — strongly concave.
        const plus: Point[] = [
            [3, 0],
            [6, 0],
            [6, 3],
            [9, 3],
            [9, 6],
            [6, 6],
            [6, 9],
            [3, 9],
            [3, 6],
            [0, 6],
            [0, 3],
            [3, 3],
        ]
        const pieces = decomposePolygon(plus)
        expect(pieces.length).toBeGreaterThan(1)
        for (const piece of pieces) expect(isConvex(piece)).toBe(true)
    })
})

describe('geometry', () => {
    it('snapPoint snaps to pixel then grid', () => {
        expect(snapPoint(3.4, 7.6, { pixel: true, grid: false, gridSize: 16 })).toEqual([3, 8])
        expect(snapPoint(20, 7, { pixel: true, grid: true, gridSize: 16 })).toEqual([16, 0])
        expect(snapPoint(3.4, 7.6, { pixel: false, grid: false, gridSize: 16 })).toEqual([3.4, 7.6])
    })

    it('pointInPolygon', () => {
        const ring: Point[] = [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
        ]
        expect(pointInPolygon([5, 5], ring)).toBe(true)
        expect(pointInPolygon([15, 5], ring)).toBe(false)
    })

    it('hitVertex / hitShape on a box', () => {
        const box: BoxShape = { type: 'box', rect: { x: 0, y: 0, w: 10, h: 10 }, props: props() }
        expect(hitVertex(box, [0, 0], 2)).toBe(0)
        expect(hitVertex(box, [5, 5], 2)).toBe(-1)
        expect(hitShape(box, [5, 5])).toBe(true)
        expect(hitShape(box, [50, 50])).toBe(false)
    })

    it('translateShape moves a circle', () => {
        const c: CircleShape = { type: 'circle', center: [5, 5], radius: 3, props: props() }
        const moved = translateShape(c, 2, -1) as CircleShape
        expect(moved.center).toEqual([7, 4])
        expect(moved.radius).toBe(3)
    })

    it('moveVertex resizes a circle via the radius handle', () => {
        const c: CircleShape = { type: 'circle', center: [0, 0], radius: 1, props: props() }
        const out = moveVertex(c, 1, [5, 0]) as CircleShape
        expect(out.radius).toBeCloseTo(5)
    })

    it('nearestEdge finds the closest polygon segment', () => {
        const poly: PolygonShape = {
            type: 'polygon',
            points: [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
            ],
            props: props(),
        }
        expect(nearestEdge(poly, [5, 0.2], 2)).toBe(0)
        expect(nearestEdge(poly, [5, 5], 2)).toBe(-1)
    })
})

describe('export', () => {
    const shapes: PhysicsShape[] = [
        {
            type: 'box',
            rect: { x: 0, y: 0, w: 32, h: 16 },
            props: { density: 1, friction: 0.3, restitution: 0.2, isSensor: false },
        },
        { type: 'circle', center: [16, 16], radius: 8, props: { density: 1, friction: 0.3, restitution: 0, isSensor: true } },
    ]

    it('box2d export scales pixels to meters', () => {
        const out = exportShapes(shapes, 'box2d', 32)
        expect(out.engine).toBe('box2d')
        expect(out.pixelsPerMeter).toBe(32)
        // Box → polygon with 4 vertices, scaled by 1/32.
        expect(out.body.fixtures[0].shape.type).toBe('polygon')
        expect(out.body.fixtures[0].shape.vertices[1]).toEqual({ x: 1, y: 0 })
        expect(out.body.fixtures[1].shape).toEqual({ type: 'circle', x: 0.5, y: 0.5, radius: 0.25 })
    })

    it('matter export keeps pixels and concave support', () => {
        const out = exportShapes(shapes, 'matter', 32)
        expect(out.body.parts[0].vertices[2]).toEqual({ x: 32, y: 16 })
        expect(out.body.parts[1].circleRadius).toBe(8)
        expect(ENGINE_CAPABILITIES.matter.convexRequired).toBe(false)
    })

    it('json export is a lossless passthrough', () => {
        const out = exportShapes(shapes, 'json')
        expect(out.body.shapes).toEqual(shapes)
    })

    it('export is deterministic (NFR-3)', () => {
        const a = JSON.stringify(exportShapes(shapes, 'box2d', 32))
        const b = JSON.stringify(exportShapes(shapes, 'box2d', 32))
        expect(a).toBe(b)
    })

    it('validateShapes flags a concave polygon for box2d but not matter', () => {
        const concave: PhysicsShape = {
            type: 'polygon',
            points: [
                [0, 0],
                [10, 5],
                [0, 10],
                [3, 5],
            ],
            props: props(),
        }
        expect(validateShapes([concave], 'box2d').valid).toBe(false)
        expect(validateShapes([concave], 'matter').valid).toBe(true)
    })

    it('validateShapes flags polygons over the vertex limit for box2d', () => {
        const points: [number, number][] = []
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2
            points.push([Math.cos(a) * 10, Math.sin(a) * 10])
        }
        const res = validateShapes([{ type: 'polygon', points, props: props() }], 'box2d')
        expect(res.issues.some((i) => i.kind === 'vertices')).toBe(true)
    })
})

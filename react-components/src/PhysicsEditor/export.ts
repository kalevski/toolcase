// Engine export transforms (FR-11) + capability matrix (FR-9/FR-13). Pure and
// deterministic (NFR-3): fixed float precision and stable key ordering, so the
// same shapes + engine + pixelsPerMeter always produce identical output.

import { isConvex } from './decompose'
import {
    BoxShape,
    EngineCapability,
    ExportEngine,
    ExportResult,
    PhysicsShape,
    ShapeProps,
    ShapeValidationIssue,
    ShapeValidationResult,
} from './types'

/** Export fidelity matrix (mirrors the design spec). */
export const ENGINE_CAPABILITIES: Record<ExportEngine, EngineCapability> = {
    box2d: { units: 'meters', convexRequired: true, maxVertices: 8, restitution: true, isSensor: true },
    planck: { units: 'meters', convexRequired: true, maxVertices: 8, restitution: true, isSensor: true },
    matter: { units: 'pixels', convexRequired: false, maxVertices: Infinity, restitution: true, isSensor: true },
    json: { units: 'pixels', convexRequired: false, maxVertices: Infinity, restitution: true, isSensor: true },
}

/** Round to 6 decimals to keep export bytes stable across runs. */
const r6 = (n: number): number => Math.round(n * 1e6) / 1e6

/** Convert a box to its 4 polygon corners (CW from top-left). */
const boxCorners = (s: BoxShape): [number, number][] => {
    const { x, y, w, h } = s.rect
    return [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
    ]
}

/** Vertex ring for any polygon-like shape (polygon or box), else null. */
const polyPoints = (s: PhysicsShape): [number, number][] | null => {
    if (s.type === 'polygon') return s.points
    if (s.type === 'box') return boxCorners(s)
    return null
}

const dropFor = (caps: EngineCapability, props: ShapeProps): string[] => {
    const dropped: string[] = []
    if (!caps.restitution && props.restitution !== 0) dropped.push('restitution')
    if (!caps.isSensor && props.isSensor) dropped.push('isSensor')
    return dropped
}

/** Emit a Box2D/Planck-style fixture list in meters (origin unchanged, y as stored). */
const exportMeters = (shapes: PhysicsShape[], caps: EngineCapability, ppm: number) => {
    const s = 1 / ppm
    const fixtures = shapes.map((shape) => {
        const base: any = {
            density: r6(shape.props.density),
            friction: r6(shape.props.friction),
        }
        if (caps.restitution) base.restitution = r6(shape.props.restitution)
        if (caps.isSensor) base.isSensor = shape.props.isSensor
        if (shape.type === 'circle') {
            base.shape = {
                type: 'circle',
                x: r6(shape.center[0] * s),
                y: r6(shape.center[1] * s),
                radius: r6(shape.radius * s),
            }
        } else {
            const pts = polyPoints(shape)!
            base.shape = { type: 'polygon', vertices: pts.map(([x, y]) => ({ x: r6(x * s), y: r6(y * s) })) }
        }
        return base
    })
    return { fixtures }
}

/** Emit a Matter.js-style part list in pixels. */
const exportMatter = (shapes: PhysicsShape[]) => {
    const parts = shapes.map((shape) => {
        const part: any = {
            density: r6(shape.props.density),
            friction: r6(shape.props.friction),
            restitution: r6(shape.props.restitution),
            isSensor: shape.props.isSensor,
        }
        if (shape.type === 'circle') {
            part.circleRadius = r6(shape.radius)
            part.position = { x: r6(shape.center[0]), y: r6(shape.center[1]) }
        } else {
            const pts = polyPoints(shape)!
            part.vertices = pts.map(([x, y]) => ({ x: r6(x), y: r6(y) }))
        }
        return part
    })
    return { parts }
}

/** Engine-neutral JSON passthrough (lossless). */
const exportJson = (shapes: PhysicsShape[]) => ({ shapes: JSON.parse(JSON.stringify(shapes)) })

/**
 * Render the engine-specific body definition. `pixelsPerMeter` is applied for
 * meter engines (box2d/planck); pixel engines ignore it. Dropped properties are
 * reported per the capability matrix.
 */
export const exportShapes = (
    shapes: PhysicsShape[],
    engine: ExportEngine,
    pixelsPerMeter = 32,
): ExportResult => {
    const caps = ENGINE_CAPABILITIES[engine]
    const ppm = pixelsPerMeter > 0 ? pixelsPerMeter : 32

    let body: any
    if (engine === 'matter') body = exportMatter(shapes)
    else if (engine === 'json') body = exportJson(shapes)
    else body = exportMeters(shapes, caps, ppm)

    const dropped = new Set<string>()
    for (const shape of shapes) for (const d of dropFor(caps, shape.props)) dropped.add(d)

    return {
        engine,
        pixelsPerMeter: caps.units === 'meters' ? ppm : pixelsPerMeter,
        body,
        droppedProperties: [...dropped].sort(),
    }
}

/** Validate shapes against an engine's convex / max-vertex rules (FR-9). */
export const validateShapes = (shapes: PhysicsShape[], engine: ExportEngine): ShapeValidationResult => {
    const caps = ENGINE_CAPABILITIES[engine]
    const issues: ShapeValidationIssue[] = []
    if (!caps.convexRequired) return { valid: true, issues }

    shapes.forEach((shape, shapeIndex) => {
        const pts = polyPoints(shape)
        if (!pts) return // circles are always valid
        if (pts.length > caps.maxVertices) {
            issues.push({
                shapeIndex,
                kind: 'vertices',
                message: `${engine} allows at most ${caps.maxVertices} vertices per fixture (shape ${shapeIndex} has ${pts.length}).`,
            })
        }
        if (shape.type === 'polygon' && !isConvex(shape.points as [number, number][])) {
            issues.push({
                shapeIndex,
                kind: 'concave',
                message: `${engine} requires convex fixtures; shape ${shapeIndex} is concave — decompose it first.`,
            })
        }
    })
    return { valid: issues.length === 0, issues }
}

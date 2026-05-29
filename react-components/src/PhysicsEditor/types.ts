// Public types for the PhysicsEditor — a canvas tool that derives a collision
// shape from a sprite (auto-trace) or by manual drawing, and exports it to the
// format a 2D physics engine expects. Geometry is stored engine-neutral, in
// source pixels; units convert only at export via `pixelsPerMeter`.

export type PhysicsEditorSource = ArrayBuffer | Uint8Array | Blob

/** Physical properties carried by every fixture. */
export interface ShapeProps {
    /** Mass density. Default 1.0. */
    density: number
    /** Surface friction 0..1+. Default 0.3. */
    friction: number
    /** Bounciness 0..1. Default 0.0. */
    restitution: number
    /** Sensor (collision events, no physical response). Default false. */
    isSensor: boolean
}

export interface PolygonShape {
    type: 'polygon'
    /** Closed ring of [x, y] vertices in source px (no duplicated closing point). */
    points: [number, number][]
    props: ShapeProps
}

export interface CircleShape {
    type: 'circle'
    center: [number, number]
    radius: number
    props: ShapeProps
}

export interface BoxShape {
    type: 'box'
    rect: { x: number; y: number; w: number; h: number }
    props: ShapeProps
}

export type PhysicsShape = PolygonShape | CircleShape | BoxShape

export type ShapeType = PhysicsShape['type']

/** Active editor tool. `select` edits/moves; the rest draw a new primitive. */
export type PhysicsTool = 'select' | 'polygon' | 'circle' | 'box'

export type ExportEngine = 'box2d' | 'matter' | 'planck' | 'json'

/** Auto-trace controls (FR-1..FR-4). */
export interface TraceOptions {
    /** Opaque-vs-transparent alpha cutoff 0..255. Default 1. */
    alphaThreshold: number
    /** Douglas-Peucker tolerance in px. Default 1.5. */
    simplifyTolerance: number
    /** Optional target vertex count; overrides tolerance via a tolerance search when > 0. Default 0 (off). */
    targetVertexCount: number
    /** Decompose a concave trace into convex pieces. Default false. */
    decomposeConcave: boolean
}

/** Editing snap settings (FR-6). */
export interface SnapSettings {
    /** Snap placed points to integer pixels. Default true. */
    pixel: boolean
    /** Snap placed points to a grid of `gridSize` px. Default false. */
    grid: boolean
    /** Grid size in px when `grid` is on. Default 16. */
    gridSize: number
}

/** A per-engine capability row from the export fidelity matrix. */
export interface EngineCapability {
    units: 'meters' | 'pixels'
    convexRequired: boolean
    maxVertices: number
    restitution: boolean
    isSensor: boolean
}

/** Result of an export transform (FR-11, FR-13). */
export interface ExportResult {
    engine: ExportEngine
    pixelsPerMeter: number
    /** Engine-specific body definition (shape varies by engine). */
    body: any
    /** Property names dropped because the target engine cannot represent them. */
    droppedProperties: string[]
}

/** A convexity / max-vertex validation problem for one shape. */
export interface ShapeValidationIssue {
    shapeIndex: number
    /** `'concave'` polygon, or `'vertices'` over the engine limit. */
    kind: 'concave' | 'vertices'
    message: string
}

export interface ShapeValidationResult {
    valid: boolean
    issues: ShapeValidationIssue[]
}

export interface PhysicsEditorProps {
    /** Encoded sprite bytes (PNG/etc.), decoded via `createImageBitmap`. */
    source?: PhysicsEditorSource
    /** Initial shape list. Loaded into the editor; subsequent edits fire `onChange`. */
    shapes?: PhysicsShape[]
    /** Fired after any edit (draw / move / vertex / delete / trace / decompose / reset / undo / redo). */
    onChange?: (shapes: PhysicsShape[]) => void

    /** Active tool. Default `'select'`. */
    tool?: PhysicsTool

    // ── Auto-trace (FR-1..FR-4) ──
    /** Opaque alpha cutoff 0..255. Default 1. */
    alphaThreshold?: number
    /** Simplify tolerance in px. Default 1.5. */
    simplifyTolerance?: number
    /** Target vertex count; > 0 overrides tolerance. Default 0. */
    targetVertexCount?: number
    /** Decompose concave traces into convex pieces. Default false. */
    decomposeConcave?: boolean

    // ── Snap (FR-6) ──
    /** Snap to integer pixels. Default true. */
    snapPixel?: boolean
    /** Snap to grid. Default false. */
    snapGrid?: boolean
    /** Grid size in px. Default 16. */
    gridSize?: number
    /** Draw the grid guide on the canvas. Default false. */
    showGrid?: boolean

    /** Default physical properties for newly drawn/traced shapes. */
    defaultProps?: Partial<ShapeProps>
    /** Meters-per-px scale baked into the default export. Default 32. */
    pixelsPerMeter?: number

    // ── Selection ──
    /** Selected shape index (controlled). `null` = none. */
    selectedIndex?: number | null
    /** Fired when the selected shape changes (click / draw). */
    onSelectShape?: (index: number | null) => void

    /** Preview backdrop. Default `'#1a1a2e'`. */
    background?: string
    /** Fired when decoding `source` fails. */
    onError?: (error: unknown) => void
    disabled?: boolean
    className?: string
}

export interface PhysicsEditorHandle {
    /** Auto-trace the sprite silhouette → polygon(s), replacing the shape list. Resolves the new shapes (empty if fully transparent). */
    autoTrace: () => Promise<PhysicsShape[]>
    /** Decompose the selected polygon (or all polygons if none selected) into convex pieces. */
    decompose: () => void
    /** Append a shape. */
    addShape: (shape: PhysicsShape) => void
    /** Remove the shape at `index`. */
    removeShape: (index: number) => void
    /** Remove every shape. */
    clearShapes: () => void
    /** Undo the last edit. */
    undo: () => void
    /** Redo the last undone edit. */
    redo: () => void
    /** Revert to the last auto-traced (or initial) shape list, discarding edits. */
    reset: () => void
    /** Current engine-neutral shape list (a copy). */
    getShapes: () => PhysicsShape[]
    /** Replace the whole shape list (pushes history). */
    setShapes: (shapes: PhysicsShape[]) => void
    /** Render the engine-specific body definition (FR-11). */
    export: (engine: ExportEngine, pixelsPerMeter?: number) => ExportResult
    /** Validate shapes for an engine's convex / max-vertex rules (FR-9). */
    validate: (engine: ExportEngine) => ShapeValidationResult
}

export const DEFAULT_SHAPE_PROPS: ShapeProps = {
    density: 1.0,
    friction: 0.3,
    restitution: 0.0,
    isSensor: false,
}

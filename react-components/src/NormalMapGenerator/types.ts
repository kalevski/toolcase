export type NormalMapSource = ArrayBuffer | Uint8Array | Blob

export type BevelDirection = 'raised' | 'recessed'

export interface NormalMapGenOptions {
    /** Overall gradient gain. Default 2. */
    strength: number
    /** Luminance-emboss height. 0 disables the emboss pass. Default 2. */
    embossHeight: number
    /** Alpha-bevel reach in px (distance-transform clamp). 0 disables bevel. Default 0. */
    bevelWidth: number
    /** Bevel ramp depth relative to width. Default 1. */
    bevelHeight: number
    /** Raised (outline pops out) vs recessed (sinks in). Default 'raised'. */
    bevelDirection: BevelDirection
    /** Treat sprite border as seamless (no edge) when true. Default false. */
    tileMode: boolean
    /** Box-blur radius (px) applied to the combined heightmap before Sobel. Default 0. */
    blur: number
    /** Flip red channel (handedness). Default false. */
    invertX: boolean
    /** Flip green channel — OpenGL (false) vs DirectX (true). Default false. */
    invertY: boolean
}

export interface NormalMapOutput {
    png: Blob
    rgba: Uint8ClampedArray
    width: number
    height: number
}

export interface NormalMapGeneratorProps {
    source?: NormalMapSource
    /** Overall gradient gain. Default 2. */
    strength?: number
    /** Luminance-emboss height. 0 disables emboss. Default 2. */
    embossHeight?: number
    /** Alpha-bevel reach in px. 0 disables bevel. Default 0. */
    bevelWidth?: number
    /** Bevel ramp depth. Default 1. */
    bevelHeight?: number
    /** Raised vs recessed outline. Default 'raised'. */
    bevelDirection?: BevelDirection
    /** Seamless border when true. Default false. */
    tileMode?: boolean
    /** Post-combine box-blur radius (a.k.a. smoothness). Default 0. */
    blur?: number
    /** Flip red channel (handedness). Default false. */
    invertX?: boolean
    /** Flip green channel — OpenGL (false) vs DirectX (true). Default false. */
    invertY?: boolean
    /** Transparent-pixel fill. Default '#8080ff' (flat up-normal). */
    flatColor?: string
    /** Preview backdrop. Default '#1a1a2e'. */
    background?: string
    onGenerate?: (output: NormalMapOutput) => void
    /** Fired when decoding `source` fails (corrupt/unsupported image). The preview clears to `background`. */
    onError?: (error: unknown) => void
    disabled?: boolean
    className?: string

    // ── Brush editor (task 002) ──
    brush?: NormalBrush
    /** Clamp paint to opaque source pixels. Default true. */
    maskToAlpha?: boolean
    /** Opt-in to pointer editing of the working buffer. Default false. */
    editable?: boolean
    /** Fired after a stroke completes with the edited working buffer. */
    onEdit?: (rgba: Uint8ClampedArray) => void
    /** Fired on `Alt+click` in 'direction' mode with the sampled normal `[x,y,z]` under the cursor. */
    onSampleDirection?: (normal: [number, number, number]) => void

    // ── Light inspector (task 003) ──
    /** Preview display mode. Default 'normal'. */
    previewMode?: PreviewMode
    light?: NormalLight
    /** Ambient level 0..1. Default 0.2. */
    ambient?: number
    /** Ambient light color. Default '#ffffff'. */
    ambientColor?: string
    /** Enable Blinn-Phong specular. Default false. */
    specular?: boolean
    /** Specular exponent. Default 32. */
    shininess?: number
    /** Light tracks the cursor over the preview. Default true. */
    followCursor?: boolean
    /** Auto-rotate the light around the sprite (turntable). Default false. */
    autoRotate?: boolean
    onLightChange?: (light: NormalLight) => void

    // ── Selection tools (task 004) ──
    /** Active editor tool. 'brush' paints; rect/lasso/wand edit the selection mask. Default 'brush'. */
    tool?: EditorTool
    /** Wand flood tolerance 0..1 over normalized alpha+normal distance. Default 0.1. */
    wandTolerance?: number
    /** Mask edge feather in px. Default 0. */
    feather?: number
    onSelectionChange?: (mask: Uint8Array | null) => void
}

// ── Selection tool types (task 004) ──

export type SelectionTool = 'rect' | 'lasso' | 'wand'
export type EditorTool = 'brush' | SelectionTool

// ── Light inspector types (task 003) ──

export type PreviewMode = 'albedo' | 'normal' | 'lit' | 'lit-surface'

export interface NormalLight {
    /** Position in normalized preview space [0..1], z is height. */
    x: number
    y: number
    z: number
    /** Light color. Default '#ffffff'. */
    color?: string
    /** Light intensity. Default 1. */
    intensity?: number
}

// ── Brush editor types (task 002) ──

export type BrushMode = 'direction' | 'height' | 'smooth' | 'structure' | 'erase'
export type StructurePattern = 'reptile' | 'furry' | 'cracked'
export type EraseTarget = 'neutral' | 'auto'

export interface NormalBrush {
    mode: BrushMode
    /** Radius in source px. Default 16. */
    size: number
    /** 0 = hard edge, 1 = full soft falloff. Default 0.5. */
    hardness: number
    /** Per-stamp blend weight 0..1. Default 0.5. */
    strength: number
    /** Target normal for 'direction' mode as [x,y,z] (unnormalized ok). Default [0,0,1]. */
    direction?: [number, number, number]
    /** 'height' mode: positive raises, negative lowers. Default 1. */
    heightSign?: 1 | -1
    /** 'structure' mode pattern. Default 'reptile'. */
    pattern?: StructurePattern
    /** 'erase' mode: reset to flat neutral or to the auto-generated normal. Default 'neutral'. */
    eraseTarget?: EraseTarget
}

export interface NormalMapGeneratorHandle {
    /**
     * Packs the working buffer (auto-generated, plus any brush edits) to PNG,
     * fires `onGenerate`, and resolves with the output. Resolves `null` if
     * `disabled`, no `source`, or a generation is already in flight.
     */
    generate: () => Promise<NormalMapOutput | null>
    /** Undo the last stroke. */
    undo: () => void
    /** Redo the last undone stroke. */
    redo: () => void
    /** Discard all edits, revert the working buffer to the auto-generated normal. */
    reset: () => void
    /** Render the current `lit` shading baked over the albedo at source resolution → PNG. Preview-only; `generate()` is unaffected. */
    exportLit: () => Promise<Blob | null>
    /** Select the whole sprite. */
    selectAll: () => void
    /** Clear the selection (back to whole-sprite behavior). */
    clearSelection: () => void
    /** Replace the current selection mask (null = whole sprite). */
    setSelection: (mask: Uint8Array | null) => void
}

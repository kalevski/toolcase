import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { decodeSource } from './decode'
import { decomposePolygon } from './decompose'
import { exportShapes, validateShapes } from './export'
import {
    hitShape,
    hitVertex,
    moveVertex,
    nearestEdge,
    shapeVertices,
    snapPoint,
    translateShape,
    Point,
} from './geometry'
import { autoTrace } from './trace'
import {
    DEFAULT_SHAPE_PROPS,
    ExportEngine,
    PhysicsEditorHandle,
    PhysicsEditorProps,
    PhysicsShape,
    PolygonShape,
    ShapeProps,
    SnapSettings,
} from './types'

export * from './types'
export { autoTrace, alphaMask, traceContour, simplify, simplifyToCount } from './trace'
export { decomposePolygon, isConvex, makeCCW, signedArea } from './decompose'
export { exportShapes, validateShapes, ENGINE_CAPABILITIES } from './export'
export {
    snapPoint,
    pointInPolygon,
    hitVertex,
    hitShape,
    nearestEdge,
    translateShape,
    moveVertex,
    shapeVertices,
    shapeBounds,
} from './geometry'

const PREVIEW_PAD = 16
const MAX_HISTORY = 40
const HANDLE = 4 // vertex handle half-size in screen px
const HIT_TOL = 7 // pointer hit tolerance in screen px

interface FitLayout {
    scale: number
    offsetX: number
    offsetY: number
}

const computeFit = (width: number, height: number, displayW: number, displayH: number): FitLayout => {
    const availW = Math.max(1, displayW - PREVIEW_PAD * 2)
    const availH = Math.max(1, displayH - PREVIEW_PAD * 2)
    const scale = Math.min(availW / width, availH / height)
    return { scale, offsetX: (displayW - width * scale) / 2, offsetY: (displayH - height * scale) / 2 }
}

type Draft =
    | { kind: 'polygon'; points: Point[] }
    | { kind: 'circle'; center: Point; radius: number }
    | { kind: 'box'; a: Point; b: Point }
    | null

type Drag =
    | { kind: 'vertex'; shapeIdx: number; vertexIdx: number; pushed: boolean }
    | { kind: 'move'; shapeIdx: number; start: Point; pushed: boolean }
    | null

const clonePoint = (p: Point): Point => [p[0], p[1]]
const cloneShape = (s: PhysicsShape): PhysicsShape => JSON.parse(JSON.stringify(s))
const cloneShapes = (s: PhysicsShape[]): PhysicsShape[] => s.map(cloneShape)

export const PhysicsEditor = forwardRef<PhysicsEditorHandle, PhysicsEditorProps>(
    (
        {
            source,
            shapes: shapesProp,
            onChange,
            tool = 'select',
            alphaThreshold = 1,
            simplifyTolerance = 1.5,
            targetVertexCount = 0,
            decomposeConcave = false,
            snapPixel = true,
            snapGrid = false,
            gridSize = 16,
            showGrid = false,
            defaultProps,
            pixelsPerMeter = 32,
            selectedIndex,
            onSelectShape,
            background = '#1a1a2e',
            onError,
            disabled = false,
            className = '',
        },
        ref,
    ) => {
        const previewRef = useRef<HTMLCanvasElement>(null)
        const overlayRef = useRef<HTMLCanvasElement>(null)

        // Decoded source pixels + a cached canvas to blit each frame.
        const rawSourceRef = useRef<{ rgba: Uint8ClampedArray; width: number; height: number } | null>(null)
        const srcCanvasRef = useRef<HTMLCanvasElement | null>(null)
        const decodeTokenRef = useRef(0)

        // Document state — shapes are the source of truth in a ref; a version bump triggers redraw.
        const shapesRef = useRef<PhysicsShape[]>(shapesProp ? cloneShapes(shapesProp) : [])
        const baseShapesRef = useRef<PhysicsShape[]>(cloneShapes(shapesRef.current))
        const undoStack = useRef<PhysicsShape[][]>([])
        const redoStack = useRef<PhysicsShape[][]>([])
        const [, setVersion] = useState(0)
        const bump = useCallback(() => setVersion((v) => v + 1), [])

        // Selection — controlled by `selectedIndex` when provided, else internal.
        const [internalSel, setInternalSel] = useState<number | null>(selectedIndex ?? null)
        const selected = selectedIndex !== undefined ? selectedIndex : internalSel
        const selectedRef = useRef<number | null>(selected)
        selectedRef.current = selected

        // Live interaction state.
        const draftRef = useRef<Draft>(null)
        const dragRef = useRef<Drag>(null)
        const cursorRef = useRef<Point | null>(null)

        // Prop snapshots for dep-free pointer callbacks.
        const toolRef = useRef(tool)
        toolRef.current = tool
        const snapRef = useRef<SnapSettings>({ pixel: snapPixel, grid: snapGrid, gridSize })
        snapRef.current = { pixel: snapPixel, grid: snapGrid, gridSize }
        const traceRef = useRef({ alphaThreshold, simplifyTolerance, targetVertexCount, decomposeConcave })
        traceRef.current = { alphaThreshold, simplifyTolerance, targetVertexCount, decomposeConcave }
        const ppmRef = useRef(pixelsPerMeter)
        ppmRef.current = pixelsPerMeter

        const newProps = useCallback(
            (): ShapeProps => ({ ...DEFAULT_SHAPE_PROPS, ...defaultProps }),
            [defaultProps],
        )
        const newPropsRef = useRef(newProps)
        newPropsRef.current = newProps

        const selectShape = useCallback(
            (idx: number | null) => {
                if (selectedIndex === undefined) setInternalSel(idx)
                onSelectShape?.(idx)
            },
            [selectedIndex, onSelectShape],
        )
        const selectShapeRef = useRef(selectShape)
        selectShapeRef.current = selectShape

        // ── Source decode ──

        useEffect(() => {
            const token = ++decodeTokenRef.current
            if (!source) {
                rawSourceRef.current = null
                srcCanvasRef.current = null
                bump()
                return
            }
            let cancelled = false
            decodeSource(source)
                .then((decoded) => {
                    if (cancelled || token !== decodeTokenRef.current) return
                    rawSourceRef.current = decoded
                    const c = document.createElement('canvas')
                    c.width = decoded.width
                    c.height = decoded.height
                    const ctx = c.getContext('2d')!
                    const img = ctx.createImageData(decoded.width, decoded.height)
                    img.data.set(decoded.rgba)
                    ctx.putImageData(img, 0, 0)
                    srcCanvasRef.current = c
                    bump()
                })
                .catch((err) => {
                    if (cancelled || token !== decodeTokenRef.current) return
                    rawSourceRef.current = null
                    srcCanvasRef.current = null
                    onError?.(err)
                    bump()
                })
            return () => {
                cancelled = true
            }
        }, [source, onError, bump])

        // Load shapes when the `shapes` prop identity changes.
        useEffect(() => {
            shapesRef.current = shapesProp ? cloneShapes(shapesProp) : []
            baseShapesRef.current = cloneShapes(shapesRef.current)
            undoStack.current = []
            redoStack.current = []
            bump()
        }, [shapesProp, bump])

        // ── Layout helpers ──

        const dims = useCallback((): { w: number; h: number } => {
            const raw = rawSourceRef.current
            if (raw) return { w: raw.width, h: raw.height }
            return { w: 256, h: 256 }
        }, [])

        const fit = useCallback(
            (canvas: HTMLCanvasElement): FitLayout => {
                const { w, h } = dims()
                return computeFit(w, h, canvas.clientWidth, canvas.clientHeight)
            },
            [dims],
        )

        const mapToSource = useCallback(
            (clientX: number, clientY: number): Point | null => {
                const canvas = overlayRef.current
                if (!canvas) return null
                const rect = canvas.getBoundingClientRect()
                const { scale, offsetX, offsetY } = fit(canvas)
                return [(clientX - rect.left - offsetX) / scale, (clientY - rect.top - offsetY) / scale]
            },
            [fit],
        )

        const tolSource = useCallback((): number => {
            const canvas = overlayRef.current
            if (!canvas) return HIT_TOL
            return HIT_TOL / fit(canvas).scale
        }, [fit])

        // ── Rendering ──

        const renderPreview = useCallback(() => {
            const canvas = previewRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            const dpr = window.devicePixelRatio || 1
            const dw = canvas.clientWidth
            const dh = canvas.clientHeight
            canvas.width = dw * dpr
            canvas.height = dh * dpr
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, dw, dh)
            ctx.fillStyle = background
            ctx.fillRect(0, 0, dw, dh)

            const { w, h } = dims()
            const { scale, offsetX, offsetY } = computeFit(w, h, dw, dh)
            const src = srcCanvasRef.current
            if (src) {
                ctx.imageSmoothingEnabled = false
                ctx.drawImage(src, offsetX, offsetY, w * scale, h * scale)
            }

            if (showGrid && snapRef.current.gridSize > 0) {
                const g = snapRef.current.gridSize
                ctx.strokeStyle = 'rgba(255,255,255,0.08)'
                ctx.lineWidth = 1
                ctx.beginPath()
                for (let x = 0; x <= w; x += g) {
                    ctx.moveTo(offsetX + x * scale, offsetY)
                    ctx.lineTo(offsetX + x * scale, offsetY + h * scale)
                }
                for (let y = 0; y <= h; y += g) {
                    ctx.moveTo(offsetX, offsetY + y * scale)
                    ctx.lineTo(offsetX + w * scale, offsetY + y * scale)
                }
                ctx.stroke()
            }
        }, [background, showGrid, dims])

        const drawOverlay = useCallback(() => {
            const canvas = overlayRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return
            const dpr = window.devicePixelRatio || 1
            const dw = canvas.clientWidth
            const dh = canvas.clientHeight
            canvas.width = dw * dpr
            canvas.height = dh * dpr
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, dw, dh)

            const { w, h } = dims()
            const { scale, offsetX, offsetY } = computeFit(w, h, dw, dh)
            const tx = (x: number) => offsetX + x * scale
            const ty = (y: number) => offsetY + y * scale

            const drawShape = (shape: PhysicsShape, isSel: boolean) => {
                ctx.lineWidth = isSel ? 2 : 1.5
                ctx.strokeStyle = shape.props.isSensor ? '#ffd166' : isSel ? '#4dd2ff' : '#7fd1ff'
                ctx.fillStyle = isSel ? 'rgba(77,210,255,0.18)' : 'rgba(127,209,255,0.10)'
                ctx.beginPath()
                if (shape.type === 'circle') {
                    ctx.arc(tx(shape.center[0]), ty(shape.center[1]), shape.radius * scale, 0, Math.PI * 2)
                } else if (shape.type === 'box') {
                    const { x, y, w: bw, h: bh } = shape.rect
                    ctx.rect(tx(x), ty(y), bw * scale, bh * scale)
                } else {
                    shape.points.forEach((p, i) => (i ? ctx.lineTo(tx(p[0]), ty(p[1])) : ctx.moveTo(tx(p[0]), ty(p[1]))))
                    ctx.closePath()
                }
                ctx.fill()
                ctx.stroke()

                // Vertex / handle squares.
                ctx.fillStyle = isSel ? '#4dd2ff' : '#cfe9ff'
                for (const v of shapeVertices(shape)) {
                    ctx.fillRect(tx(v[0]) - HANDLE, ty(v[1]) - HANDLE, HANDLE * 2, HANDLE * 2)
                }
            }

            shapesRef.current.forEach((shape, i) => drawShape(shape, i === selectedRef.current))

            // In-progress draft.
            const draft = draftRef.current
            const cur = cursorRef.current
            if (draft) {
                ctx.lineWidth = 1.5
                ctx.strokeStyle = '#ffd166'
                ctx.setLineDash([5, 4])
                ctx.beginPath()
                if (draft.kind === 'polygon') {
                    const pts = draft.points
                    pts.forEach((p, i) => (i ? ctx.lineTo(tx(p[0]), ty(p[1])) : ctx.moveTo(tx(p[0]), ty(p[1]))))
                    if (cur && pts.length) ctx.lineTo(tx(cur[0]), ty(cur[1]))
                    ctx.stroke()
                    ctx.setLineDash([])
                    ctx.fillStyle = '#ffd166'
                    for (const p of pts) ctx.fillRect(tx(p[0]) - HANDLE, ty(p[1]) - HANDLE, HANDLE * 2, HANDLE * 2)
                } else if (draft.kind === 'circle') {
                    ctx.arc(tx(draft.center[0]), ty(draft.center[1]), Math.max(1, draft.radius) * scale, 0, Math.PI * 2)
                    ctx.stroke()
                    ctx.setLineDash([])
                } else {
                    const x = Math.min(draft.a[0], draft.b[0])
                    const y = Math.min(draft.a[1], draft.b[1])
                    ctx.rect(tx(x), ty(y), Math.abs(draft.b[0] - draft.a[0]) * scale, Math.abs(draft.b[1] - draft.a[1]) * scale)
                    ctx.stroke()
                    ctx.setLineDash([])
                }
            }
        }, [dims])

        // Redraw whenever document/visual state changes.
        useEffect(() => {
            renderPreview()
            drawOverlay()
        })

        useEffect(() => {
            const onResize = () => {
                renderPreview()
                drawOverlay()
            }
            window.addEventListener('resize', onResize)
            return () => window.removeEventListener('resize', onResize)
        }, [renderPreview, drawOverlay])

        // ── Mutations ──

        const pushHistory = useCallback(() => {
            undoStack.current.push(cloneShapes(shapesRef.current))
            if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift()
            redoStack.current = []
        }, [])

        const fireChange = useCallback(() => {
            onChange?.(cloneShapes(shapesRef.current))
            bump()
        }, [onChange, bump])

        const commit = useCallback(
            (next: PhysicsShape[], record = true) => {
                if (record) pushHistory()
                shapesRef.current = next
                fireChange()
            },
            [pushHistory, fireChange],
        )

        // ── Pointer interaction ──

        const finishPolygon = useCallback(() => {
            const d = draftRef.current
            if (!d || d.kind !== 'polygon' || d.points.length < 3) return
            const shape: PhysicsShape = { type: 'polygon', points: d.points.map(clonePoint), props: newPropsRef.current() }
            draftRef.current = null
            const next = shapesRef.current.concat(shape)
            commit(next)
            selectShapeRef.current(next.length - 1)
            drawOverlay()
        }, [commit, drawOverlay])

        const onPointerDown = useCallback(
            (e: React.PointerEvent<HTMLCanvasElement>) => {
                if (disabled) return
                const raw = mapToSource(e.clientX, e.clientY)
                if (!raw) return
                const snap = snapRef.current
                const p = snapPoint(raw[0], raw[1], snap)
                const t = toolRef.current
                e.currentTarget.setPointerCapture(e.pointerId)

                if (t === 'select') {
                    const tol = tolSource()
                    const shapes = shapesRef.current
                    // Prefer a vertex hit on any shape (top-most first).
                    for (let i = shapes.length - 1; i >= 0; i--) {
                        const vi = hitVertex(shapes[i], raw, tol)
                        if (vi >= 0) {
                            if (e.altKey && shapes[i].type === 'polygon' && (shapes[i] as PolygonShape).points.length > 3) {
                                // Delete vertex.
                                const poly = shapes[i] as PolygonShape
                                const next = shapes.slice()
                                next[i] = { ...poly, points: poly.points.filter((_, k) => k !== vi) }
                                commit(next)
                                selectShapeRef.current(i)
                                return
                            }
                            selectShapeRef.current(i)
                            dragRef.current = { kind: 'vertex', shapeIdx: i, vertexIdx: vi, pushed: false }
                            return
                        }
                    }
                    // Else a body hit → select + move.
                    for (let i = shapes.length - 1; i >= 0; i--) {
                        if (hitShape(shapes[i], raw)) {
                            selectShapeRef.current(i)
                            dragRef.current = { kind: 'move', shapeIdx: i, start: clonePoint(raw), pushed: false }
                            return
                        }
                    }
                    selectShapeRef.current(null)
                    bump()
                    return
                }

                if (t === 'polygon') {
                    const d = draftRef.current
                    if (d && d.kind === 'polygon') {
                        // Close when clicking near the first vertex.
                        if (d.points.length >= 3) {
                            const f = d.points[0]
                            if (Math.hypot(raw[0] - f[0], raw[1] - f[1]) <= tolSource()) {
                                finishPolygon()
                                return
                            }
                        }
                        d.points.push(p)
                    } else {
                        draftRef.current = { kind: 'polygon', points: [p] }
                    }
                    cursorRef.current = p
                    drawOverlay()
                    return
                }

                if (t === 'circle') {
                    draftRef.current = { kind: 'circle', center: p, radius: 0 }
                    cursorRef.current = p
                    drawOverlay()
                    return
                }

                // box
                draftRef.current = { kind: 'box', a: p, b: p }
                cursorRef.current = p
                drawOverlay()
            },
            [disabled, mapToSource, tolSource, commit, drawOverlay, bump, finishPolygon],
        )

        const onPointerMove = useCallback(
            (e: React.PointerEvent<HTMLCanvasElement>) => {
                if (disabled) return
                const raw = mapToSource(e.clientX, e.clientY)
                if (!raw) return
                const p = snapPoint(raw[0], raw[1], snapRef.current)
                cursorRef.current = p

                const drag = dragRef.current
                if (drag) {
                    // Record history only once the drag actually moves a shape —
                    // a plain select click must not pollute the undo stack.
                    if (!drag.pushed) {
                        pushHistory()
                        drag.pushed = true
                    }
                    const shapes = shapesRef.current.slice()
                    if (drag.kind === 'vertex') {
                        shapes[drag.shapeIdx] = moveVertex(shapes[drag.shapeIdx], drag.vertexIdx, p)
                    } else {
                        const dx = p[0] - drag.start[0]
                        const dy = p[1] - drag.start[1]
                        shapes[drag.shapeIdx] = translateShape(shapes[drag.shapeIdx], dx, dy)
                        drag.start = clonePoint(p)
                    }
                    shapesRef.current = shapes
                    onChange?.(cloneShapes(shapes))
                    drawOverlay()
                    return
                }

                const draft = draftRef.current
                if (!draft) {
                    if (toolRef.current === 'polygon') drawOverlay()
                    return
                }
                if (draft.kind === 'circle') draft.radius = Math.hypot(p[0] - draft.center[0], p[1] - draft.center[1])
                else if (draft.kind === 'box') draft.b = p
                drawOverlay()
            },
            [disabled, mapToSource, onChange, drawOverlay, pushHistory],
        )

        const endDrag = useCallback(
            (e: React.PointerEvent<HTMLCanvasElement>) => {
                try {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                } catch {
                    /* capture already gone */
                }
                if (dragRef.current) {
                    const moved = dragRef.current.pushed
                    dragRef.current = null
                    if (moved) fireChange()
                    return
                }
                const draft = draftRef.current
                if (draft && draft.kind === 'circle') {
                    if (draft.radius >= 1) {
                        const shape: PhysicsShape = { type: 'circle', center: draft.center, radius: draft.radius, props: newPropsRef.current() }
                        const next = shapesRef.current.concat(shape)
                        commit(next)
                        selectShapeRef.current(next.length - 1)
                    }
                    draftRef.current = null
                    drawOverlay()
                } else if (draft && draft.kind === 'box') {
                    const x = Math.min(draft.a[0], draft.b[0])
                    const y = Math.min(draft.a[1], draft.b[1])
                    const bw = Math.abs(draft.b[0] - draft.a[0])
                    const bh = Math.abs(draft.b[1] - draft.a[1])
                    if (bw >= 1 && bh >= 1) {
                        const shape: PhysicsShape = { type: 'box', rect: { x, y, w: bw, h: bh }, props: newPropsRef.current() }
                        const next = shapesRef.current.concat(shape)
                        commit(next)
                        selectShapeRef.current(next.length - 1)
                    }
                    draftRef.current = null
                    drawOverlay()
                }
                // polygon draft persists across clicks; closed via dblclick / Enter / first-vertex click.
            },
            [commit, drawOverlay, fireChange],
        )

        const onDoubleClick = useCallback(
            (e: React.MouseEvent<HTMLCanvasElement>) => {
                if (toolRef.current === 'polygon') {
                    finishPolygon()
                    return
                }
                // Select mode: insert a vertex on the nearest edge of the selected polygon.
                if (toolRef.current !== 'select') return
                const sel = selectedRef.current
                if (sel == null) return
                const shape = shapesRef.current[sel]
                if (!shape || shape.type !== 'polygon') return
                const raw = mapToSource(e.clientX, e.clientY)
                if (!raw) return
                const edge = nearestEdge(shape, raw, tolSource())
                if (edge < 0) return
                const p = snapPoint(raw[0], raw[1], snapRef.current)
                const points = shape.points.slice()
                points.splice(edge + 1, 0, p)
                const next = shapesRef.current.slice()
                next[sel] = { ...shape, points }
                commit(next)
            },
            [finishPolygon, mapToSource, tolSource, commit],
        )

        const onKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLDivElement>) => {
                if (disabled) return
                if (e.key === 'Escape') {
                    draftRef.current = null
                    drawOverlay()
                } else if (e.key === 'Enter') {
                    finishPolygon()
                } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current != null) {
                    const idx = selectedRef.current
                    const next = shapesRef.current.filter((_, i) => i !== idx)
                    commit(next)
                    selectShapeRef.current(null)
                }
            },
            [disabled, finishPolygon, drawOverlay, commit],
        )

        // ── Imperative handle ──

        const handleAutoTrace = useCallback(async (): Promise<PhysicsShape[]> => {
            let raw = rawSourceRef.current
            if (!raw) {
                if (!source) return []
                try {
                    raw = await decodeSource(source)
                    rawSourceRef.current = raw
                } catch (err) {
                    onError?.(err)
                    return []
                }
            }
            const opts = traceRef.current
            const ring = autoTrace(raw.rgba, raw.width, raw.height, opts)
            if (ring.length < 3) {
                commit([])
                baseShapesRef.current = []
                selectShapeRef.current(null)
                return []
            }
            const props = newPropsRef.current()
            let result: PhysicsShape[]
            if (opts.decomposeConcave) {
                result = decomposePolygon(ring).map((pts) => ({ type: 'polygon', points: pts, props: { ...props } }))
            } else {
                result = [{ type: 'polygon', points: ring, props }]
            }
            commit(result)
            baseShapesRef.current = cloneShapes(result)
            selectShapeRef.current(result.length === 1 ? 0 : null)
            return cloneShapes(result)
        }, [source, onError, commit])

        const handleDecompose = useCallback(() => {
            const shapes = shapesRef.current
            const sel = selectedRef.current
            const expand = (idx: number, list: PhysicsShape[]) => {
                const s = list[idx]
                if (s.type !== 'polygon') return [s]
                return decomposePolygon(s.points as Point[]).map(
                    (pts) => ({ type: 'polygon', points: pts, props: { ...s.props } }) as PhysicsShape,
                )
            }
            let next: PhysicsShape[]
            if (sel != null && shapes[sel]?.type === 'polygon') {
                next = shapes.flatMap((s, i) => (i === sel ? expand(i, shapes) : [s]))
            } else {
                next = shapes.flatMap((s, i) => (s.type === 'polygon' ? expand(i, shapes) : [s]))
            }
            commit(next)
            selectShapeRef.current(null)
        }, [commit])

        const handleAddShape = useCallback(
            (shape: PhysicsShape) => {
                const next = shapesRef.current.concat(cloneShape(shape))
                commit(next)
                selectShapeRef.current(next.length - 1)
            },
            [commit],
        )

        const handleRemoveShape = useCallback(
            (index: number) => {
                if (index < 0 || index >= shapesRef.current.length) return
                commit(shapesRef.current.filter((_, i) => i !== index))
                if (selectedRef.current === index) selectShapeRef.current(null)
            },
            [commit],
        )

        const handleUndo = useCallback(() => {
            const entry = undoStack.current.pop()
            if (!entry) return
            redoStack.current.push(cloneShapes(shapesRef.current))
            shapesRef.current = entry
            fireChange()
        }, [fireChange])

        const handleRedo = useCallback(() => {
            const entry = redoStack.current.pop()
            if (!entry) return
            undoStack.current.push(cloneShapes(shapesRef.current))
            shapesRef.current = entry
            fireChange()
        }, [fireChange])

        useImperativeHandle(
            ref,
            (): PhysicsEditorHandle => ({
                autoTrace: handleAutoTrace,
                decompose: handleDecompose,
                addShape: handleAddShape,
                removeShape: handleRemoveShape,
                clearShapes: () => {
                    commit([])
                    selectShapeRef.current(null)
                },
                undo: handleUndo,
                redo: handleRedo,
                reset: () => {
                    commit(cloneShapes(baseShapesRef.current))
                    selectShapeRef.current(null)
                },
                getShapes: () => cloneShapes(shapesRef.current),
                setShapes: (next: PhysicsShape[]) => {
                    commit(cloneShapes(next))
                },
                export: (engine: ExportEngine, ppm?: number) => exportShapes(shapesRef.current, engine, ppm ?? ppmRef.current),
                validate: (engine: ExportEngine) => validateShapes(shapesRef.current, engine),
            }),
            [handleAutoTrace, handleDecompose, handleAddShape, handleRemoveShape, handleUndo, handleRedo, commit],
        )

        const rootClass = ['component', 'component-physics-editor', `component-physics-editor--${tool}`, className]
            .filter(Boolean)
            .join(' ')

        return (
            <div className={rootClass} tabIndex={0} onKeyDown={onKeyDown} role="application" aria-label="Physics shape editor">
                <canvas ref={previewRef} className="component-physics-editor__preview" aria-hidden={true} />
                <canvas
                    ref={overlayRef}
                    className="component-physics-editor__overlay"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onDoubleClick={onDoubleClick}
                />
            </div>
        )
    },
)

PhysicsEditor.displayName = 'PhysicsEditor'

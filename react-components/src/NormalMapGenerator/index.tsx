import React, { useRef, useEffect, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'
import { applyBrush, unpack } from './brush'
import { decodeSource, hexToRgb } from './decode'
import { buildHeightmap, generateNormalMap, normalsFromHeight } from './generate'
import { LitRenderer, ResolvedLight } from './light'
import { combineSelection, featherMask, maskEdges, polygonToMask, rectToMask, wandSelect } from './selection'
import {
    EditorTool,
    NormalBrush,
    NormalLight,
    NormalMapGenOptions,
    NormalMapGeneratorHandle,
    NormalMapGeneratorProps,
    NormalMapOutput,
} from './types'

export * from './types'
export {
    toHeightmap,
    alphaToDistance,
    bevelHeightmap,
    blurHeightmap,
    buildHeightmap,
    normalsFromHeight,
    generateNormalMap,
} from './generate'
export { decodeSource, hexToRgb } from './decode'
export { unpack, pack, lerp3, applyBrush, STRUCTURE_TILES } from './brush'
export { LitRenderer } from './light'
export { polygonToMask, wandSelect, featherMask, combineSelection, rectToMask, maskEdges } from './selection'

const PREVIEW_PAD = 16
const MAX_HISTORY = 20
const ROTATE_SPEED = 0.0015 // radians per ms

const DEFAULT_BRUSH: NormalBrush = { mode: 'direction', size: 16, hardness: 0.5, strength: 0.5, direction: [0, 0, 1] }
const DEFAULT_LIGHT: NormalLight = { x: 0.5, y: 0.5, z: 0.5 }

type GenOptions = NormalMapGenOptions & { flatColor: [number, number, number] }

interface WorkingBuffer {
    rgba: Uint8ClampedArray
    width: number
    height: number
}

interface HistoryEntry {
    working: Uint8ClampedArray
    combined: Float32Array
    heightDelta: Float32Array
}

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

const norm255 = (hex: string): [number, number, number] => {
    const [r, g, b] = hexToRgb(hex)
    return [r / 255, g / 255, b / 255]
}

const rgbaToCanvas = (rgba: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement => {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(width, height)
    img.data.set(rgba)
    ctx.putImageData(img, 0, 0)
    return c
}

export const NormalMapGenerator = forwardRef<NormalMapGeneratorHandle, NormalMapGeneratorProps>(
    (
        {
            source,
            strength = 2,
            embossHeight = 2,
            bevelWidth = 0,
            bevelHeight = 1,
            bevelDirection = 'raised',
            tileMode = false,
            blur = 0,
            invertX = false,
            invertY = false,
            flatColor = '#8080ff',
            background = '#1a1a2e',
            onGenerate,
            onError,
            disabled = false,
            className = '',
            brush,
            maskToAlpha = true,
            editable = false,
            onEdit,
            onSampleDirection,
            previewMode = 'normal',
            light: lightProp,
            ambient = 0.2,
            ambientColor = '#ffffff',
            specular = false,
            shininess = 32,
            followCursor = true,
            autoRotate = false,
            onLightChange,
            tool = 'brush',
            wandTolerance = 0.1,
            feather = 0,
            onSelectionChange,
        },
        ref,
    ) => {
        const previewRef = useRef<HTMLCanvasElement>(null)
        const overlayRef = useRef<HTMLCanvasElement>(null)
        const cursorRef = useRef<HTMLDivElement>(null)
        const gizmoRef = useRef<HTMLDivElement>(null)
        const generatingRef = useRef(false)
        const renderTokenRef = useRef(0)

        // Decoded source pixels, cached so option changes don't re-decode (task B2).
        const rawSourceRef = useRef<{ rgba: Uint8ClampedArray; width: number; height: number } | null>(null)

        // Reusable offscreen canvas for the normal/albedo preview blit (task B1).
        const previewSrcCanvasRef = useRef<HTMLCanvasElement | null>(null)
        const previewSrcImgRef = useRef<ImageData | null>(null)
        const previewSrcKeyRef = useRef('')

        // Two-buffer model (task 002).
        const sourceRef = useRef<Uint8ClampedArray | null>(null)
        const autoRef = useRef<Uint8ClampedArray | null>(null)
        const baseHeightRef = useRef<Float32Array | null>(null)
        const combinedHeightRef = useRef<Float32Array | null>(null)
        const heightDeltaRef = useRef<Float32Array | null>(null)
        const workingRef = useRef<WorkingBuffer | null>(null)

        // Texture dirty versions for the lit path (task 003).
        const albedoVersionRef = useRef(0)
        const normalVersionRef = useRef(0)
        const litRendererRef = useRef<LitRenderer | null>(null)

        // Stroke / history state.
        const undoStack = useRef<HistoryEntry[]>([])
        const redoStack = useRef<HistoryEntry[]>([])
        const drawingRef = useRef(false)
        const lastStampRef = useRef<{ x: number; y: number } | null>(null)
        const rafRef = useRef<number | null>(null)
        const lastClientRef = useRef<{ x: number; y: number } | null>(null)

        // Selection (task 004).
        const selectionRef = useRef<Uint8Array | null>(null)
        const antsEdgesRef = useRef<number[]>([])
        const antsOffsetRef = useRef(0)
        const antsRafRef = useRef<number | null>(null)
        // In-progress selection drag (source-px coords).
        const selDragRef = useRef<{ tool: EditorTool; pts: [number, number][]; add: boolean; sub: boolean } | null>(null)

        const brushRef = useRef<NormalBrush>(brush ?? DEFAULT_BRUSH)
        brushRef.current = brush ?? DEFAULT_BRUSH

        // Light state — controlled by `light` prop when provided, else internal.
        const [internalLight, setInternalLight] = useState<NormalLight>(DEFAULT_LIGHT)
        const activeLight = lightProp ?? internalLight
        const activeLightRef = useRef(activeLight)
        activeLightRef.current = activeLight
        const [autoRot, setAutoRot] = useState(autoRotate)
        useEffect(() => setAutoRot(autoRotate), [autoRotate])

        const isLit = previewMode === 'lit' || previewMode === 'lit-surface'
        const isSelectionTool = tool === 'rect' || tool === 'lasso' || tool === 'wand'

        const resolvedLight = useMemo<ResolvedLight>(
            () => ({
                x: activeLight.x,
                y: activeLight.y,
                z: activeLight.z,
                color: norm255(activeLight.color ?? '#ffffff'),
                intensity: activeLight.intensity ?? 1,
            }),
            [activeLight],
        )

        const updateLight = useCallback(
            (next: NormalLight) => {
                setInternalLight(next)
                onLightChange?.(next)
            },
            [onLightChange],
        )

        const buildOptions = useCallback(
            (): GenOptions => ({
                strength,
                embossHeight,
                bevelWidth,
                bevelHeight,
                bevelDirection,
                tileMode,
                blur,
                invertX,
                invertY,
                flatColor: hexToRgb(flatColor),
            }),
            [strength, embossHeight, bevelWidth, bevelHeight, bevelDirection, tileMode, blur, invertX, invertY, flatColor],
        )
        const optionsRef = useRef<GenOptions>(buildOptions())
        optionsRef.current = buildOptions()

        const ensureRenderer = useCallback((): LitRenderer => {
            if (!litRendererRef.current) litRendererRef.current = new LitRenderer()
            return litRendererRef.current
        }, [])

        /** Produce the source-resolution canvas for the active preview mode. */
        const renderModeCanvas = useCallback(
            (working: WorkingBuffer): HTMLCanvasElement | null => {
                // Normal/albedo: blit the buffer into a persistent canvas, skipping
                // the putImageData when the buffer version is unchanged (task B1).
                if (previewMode === 'albedo' || previewMode === 'normal') {
                    const buf = previewMode === 'albedo' ? sourceRef.current : working.rgba
                    if (!buf) return null
                    const ver = previewMode === 'albedo' ? albedoVersionRef.current : normalVersionRef.current
                    const key = `${previewMode}:${working.width}x${working.height}:${ver}`

                    let canvas = previewSrcCanvasRef.current
                    if (!canvas) {
                        canvas = document.createElement('canvas')
                        previewSrcCanvasRef.current = canvas
                    }
                    if (canvas.width !== working.width || canvas.height !== working.height) {
                        canvas.width = working.width
                        canvas.height = working.height
                        previewSrcImgRef.current = null
                        previewSrcKeyRef.current = ''
                    }
                    if (previewSrcKeyRef.current !== key) {
                        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
                        if (!previewSrcImgRef.current) previewSrcImgRef.current = ctx.createImageData(working.width, working.height)
                        previewSrcImgRef.current.data.set(buf)
                        ctx.putImageData(previewSrcImgRef.current, 0, 0)
                        previewSrcKeyRef.current = key
                    }
                    return canvas
                }
                // lit / lit-surface
                if (!sourceRef.current) return null
                return ensureRenderer().shade({
                    albedo: sourceRef.current,
                    normal: working.rgba,
                    width: working.width,
                    height: working.height,
                    light: resolvedLight,
                    ambient,
                    ambientColor: norm255(ambientColor),
                    specular,
                    shininess,
                    surfaceOnly: previewMode === 'lit-surface',
                    albedoVersion: albedoVersionRef.current,
                    normalVersion: normalVersionRef.current,
                })
            },
            [previewMode, resolvedLight, ambient, ambientColor, specular, shininess, ensureRenderer],
        )

        /** Draw the active preview mode into the canvas (DPR-aware, letterboxed). */
        const renderPreview = useCallback(() => {
            const canvas = previewRef.current
            const working = workingRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            const dpr = window.devicePixelRatio || 1
            const displayW = canvas.clientWidth
            const displayH = canvas.clientHeight
            canvas.width = displayW * dpr
            canvas.height = displayH * dpr
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, displayW, displayH)
            ctx.fillStyle = background
            ctx.fillRect(0, 0, displayW, displayH)
            if (!working) return

            const src = renderModeCanvas(working)
            if (!src) return

            const { scale, offsetX, offsetY } = computeFit(working.width, working.height, displayW, displayH)
            ctx.imageSmoothingEnabled = false
            ctx.drawImage(src, offsetX, offsetY, working.width * scale, working.height * scale)

            // Position the light gizmo over the letterboxed sprite (image-uv → display px).
            const gizmo = gizmoRef.current
            if (gizmo) {
                gizmo.style.left = `${offsetX + resolvedLight.x * working.width * scale}px`
                gizmo.style.top = `${offsetY + resolvedLight.y * working.height * scale}px`
            }
        }, [background, renderModeCanvas, resolvedLight])

        // Latest renderer, callable from dep-free callbacks without re-triggering rebuilds.
        const renderRef = useRef(renderPreview)
        renderRef.current = renderPreview

        const scheduleRender = useCallback(() => {
            if (rafRef.current != null) return
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null
                renderRef.current()
            })
        }, [])

        // ── Selection overlay (marching ants) ──

        const drawOverlay = useCallback(() => {
            const overlay = overlayRef.current
            const working = workingRef.current
            if (!overlay) return
            const ctx = overlay.getContext('2d')
            if (!ctx) return
            const dpr = window.devicePixelRatio || 1
            const dw = overlay.clientWidth
            const dh = overlay.clientHeight
            overlay.width = dw * dpr
            overlay.height = dh * dpr
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, dw, dh)
            if (!working) return

            const { scale, offsetX, offsetY } = computeFit(working.width, working.height, dw, dh)
            const tx = (x: number) => offsetX + x * scale
            const ty = (y: number) => offsetY + y * scale

            ctx.lineWidth = 1
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'
            ctx.setLineDash([4, 4])
            ctx.lineDashOffset = antsOffsetRef.current
            ctx.beginPath()

            const drag = selDragRef.current
            if (drag) {
                if (drag.tool === 'rect' && drag.pts.length >= 2) {
                    const [a, b] = [drag.pts[0], drag.pts[drag.pts.length - 1]]
                    ctx.rect(tx(Math.min(a[0], b[0])), ty(Math.min(a[1], b[1])), Math.abs(b[0] - a[0]) * scale, Math.abs(b[1] - a[1]) * scale)
                } else if (drag.tool === 'lasso' && drag.pts.length) {
                    ctx.moveTo(tx(drag.pts[0][0]), ty(drag.pts[0][1]))
                    for (let i = 1; i < drag.pts.length; i++) ctx.lineTo(tx(drag.pts[i][0]), ty(drag.pts[i][1]))
                }
            } else {
                const edges = antsEdgesRef.current
                for (let i = 0; i < edges.length; i += 4) {
                    ctx.moveTo(tx(edges[i]), ty(edges[i + 1]))
                    ctx.lineTo(tx(edges[i + 2]), ty(edges[i + 3]))
                }
            }
            ctx.stroke()
        }, [])

        const stopAnts = useCallback(() => {
            if (antsRafRef.current != null) {
                cancelAnimationFrame(antsRafRef.current)
                antsRafRef.current = null
            }
        }, [])

        const startAnts = useCallback(() => {
            if (antsRafRef.current != null) return
            const loop = () => {
                antsOffsetRef.current = (antsOffsetRef.current + 0.5) % 8
                drawOverlay()
                antsRafRef.current = requestAnimationFrame(loop)
            }
            antsRafRef.current = requestAnimationFrame(loop)
        }, [drawOverlay])

        const commitSelection = useCallback(
            (next: Uint8Array, add: boolean, sub: boolean) => {
                const working = workingRef.current
                if (!working) return
                const mode = add ? 'add' : sub ? 'subtract' : 'replace'
                const combined = combineSelection(selectionRef.current, next, mode)
                if (combined && feather > 0) featherMask(combined, working.width, working.height, feather)
                selectionRef.current = combined
                antsEdgesRef.current = combined ? maskEdges(combined, working.width, working.height) : []
                onSelectionChange?.(combined)
                if (combined) startAnts()
                else {
                    stopAnts()
                    drawOverlay()
                }
            },
            [feather, onSelectionChange, startAnts, stopAnts, drawOverlay],
        )

        useEffect(() => () => stopAnts(), [stopAnts])

        /** Rebuild auto buffers from the cached decoded source + current options; resets all edits. */
        const rebuild = useCallback(() => {
            const raw = rawSourceRef.current
            if (!raw) {
                sourceRef.current = null
                autoRef.current = null
                workingRef.current = null
                renderRef.current()
                return
            }
            const { rgba, width, height } = raw
            const opts = optionsRef.current
            const base = buildHeightmap(rgba, width, height, opts)
            const auto = normalsFromHeight(base, rgba, width, height, opts)

            // Selection gating: re-bevel only inside the mask, keep the previous working buffer outside.
            const prev = workingRef.current
            const sel = selectionRef.current
            let nextRgba: Uint8ClampedArray
            if (sel && prev && prev.width === width && prev.height === height) {
                nextRgba = new Uint8ClampedArray(width * height * 4)
                for (let i = 0; i < width * height; i++) {
                    const cov = sel[i] / 255
                    const o = i * 4
                    for (let c = 0; c < 4; c++) nextRgba[o + c] = auto[o + c] * cov + prev.rgba[o + c] * (1 - cov)
                }
            } else {
                nextRgba = auto.slice()
                if (sel && prev && (prev.width !== width || prev.height !== height)) {
                    // Source dimensions changed → the mask is invalid.
                    selectionRef.current = null
                    antsEdgesRef.current = []
                    stopAnts()
                    onSelectionChange?.(null)
                }
            }

            sourceRef.current = rgba
            baseHeightRef.current = base
            combinedHeightRef.current = base.slice()
            heightDeltaRef.current = new Float32Array(width * height)
            autoRef.current = auto
            workingRef.current = { rgba: nextRgba, width, height }
            undoStack.current = []
            redoStack.current = []
            albedoVersionRef.current++
            normalVersionRef.current++

            renderRef.current()
            drawOverlay()
        }, [buildOptions, stopAnts, onSelectionChange])

        // Latest rebuild, callable from the dep-isolated decode effect without
        // re-triggering a decode when only generation options change.
        const rebuildRef = useRef(rebuild)
        rebuildRef.current = rebuild

        // Decode only when `source` changes (task B2). The decoded pixels are
        // cached in `rawSourceRef`; option changes reuse them via `rebuild`.
        useEffect(() => {
            const token = ++renderTokenRef.current
            if (!source) {
                rawSourceRef.current = null
                rebuildRef.current()
                return
            }
            let cancelled = false
            decodeSource(source)
                .then((decoded) => {
                    if (cancelled || token !== renderTokenRef.current) return
                    rawSourceRef.current = decoded
                    rebuildRef.current()
                })
                .catch((err) => {
                    if (cancelled || token !== renderTokenRef.current) return
                    rawSourceRef.current = null
                    onError?.(err)
                    rebuildRef.current()
                })
            return () => {
                cancelled = true
            }
        }, [source, onError])

        // Rebuild from the cached source when generation options change (no re-decode).
        useEffect(() => {
            if (rawSourceRef.current) rebuild()
        }, [rebuild])

        // Redraw on any visual-param change (light, mode, ambient, …).
        useEffect(() => {
            scheduleRender()
        }, [renderPreview, scheduleRender])

        // Auto-rotate turntable — accumulate angle from rAF delta (no Date.now).
        useEffect(() => {
            if (!autoRot) return
            let raf = 0
            let prev = 0
            let t = 0
            const step = (ts: number) => {
                if (prev) t += (ts - prev) * ROTATE_SPEED
                prev = ts
                updateLight({
                    ...activeLightRef.current,
                    x: 0.5 + 0.4 * Math.cos(t),
                    y: 0.5 + 0.4 * Math.sin(t),
                })
                raf = requestAnimationFrame(step)
            }
            raf = requestAnimationFrame(step)
            return () => cancelAnimationFrame(raf)
        }, [autoRot, updateLight])

        // Dispose GL resources on unmount.
        useEffect(() => () => litRendererRef.current?.dispose(), [])

        // ── History ──

        const snapshot = useCallback((): HistoryEntry | null => {
            const w = workingRef.current
            const c = combinedHeightRef.current
            const d = heightDeltaRef.current
            if (!w || !c || !d) return null
            return { working: w.rgba.slice(), combined: c.slice(), heightDelta: d.slice() }
        }, [])

        const restore = useCallback(
            (entry: HistoryEntry) => {
                const w = workingRef.current
                if (!w) return
                w.rgba.set(entry.working)
                combinedHeightRef.current?.set(entry.combined)
                heightDeltaRef.current?.set(entry.heightDelta)
                normalVersionRef.current++
                renderRef.current()
                onEdit?.(w.rgba)
            },
            [onEdit],
        )

        // ── Brush painting ──

        const mapToSource = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
            const canvas = previewRef.current
            const working = workingRef.current
            if (!canvas || !working) return null
            const rect = canvas.getBoundingClientRect()
            const { scale, offsetX, offsetY } = computeFit(working.width, working.height, canvas.clientWidth, canvas.clientHeight)
            return {
                x: (clientX - rect.left - offsetX) / scale,
                y: (clientY - rect.top - offsetY) / scale,
            }
        }, [])

        const stampAt = useCallback(
            (x: number, y: number) => {
                const working = workingRef.current
                if (!working || !sourceRef.current || !autoRef.current) return
                applyBrush({
                    working: working.rgba,
                    source: sourceRef.current,
                    auto: autoRef.current,
                    w: working.width,
                    h: working.height,
                    cx: x,
                    cy: y,
                    brush: brushRef.current,
                    maskToAlpha,
                    combinedHeight: combinedHeightRef.current!,
                    heightDelta: heightDeltaRef.current!,
                    genOpts: optionsRef.current,
                    selection: selectionRef.current,
                })
                normalVersionRef.current++
                scheduleRender()
            },
            [maskToAlpha, scheduleRender],
        )

        const moveCursor = useCallback((clientX: number, clientY: number) => {
            const cursor = cursorRef.current
            const canvas = previewRef.current
            const working = workingRef.current
            if (!cursor || !canvas || !working) return
            const rect = canvas.getBoundingClientRect()
            const { scale } = computeFit(working.width, working.height, canvas.clientWidth, canvas.clientHeight)
            const diameter = brushRef.current.size * 2 * scale
            cursor.style.display = 'block'
            cursor.style.width = `${diameter}px`
            cursor.style.height = `${diameter}px`
            cursor.style.left = `${clientX - rect.left}px`
            cursor.style.top = `${clientY - rect.top}px`
        }, [])

        // ── Light positioning ──

        const lightFromClient = useCallback(
            (clientX: number, clientY: number): NormalLight => {
                const working = workingRef.current
                const pt = mapToSource(clientX, clientY)
                if (!pt || !working) return activeLight
                const x = Math.min(1, Math.max(0, pt.x / working.width))
                const y = Math.min(1, Math.max(0, pt.y / working.height))
                return { ...activeLight, x, y }
            },
            [activeLight, mapToSource],
        )

        // ── Pointer dispatch (brush in editable normal/albedo modes, light in lit modes) ──

        const onPointerDown = useCallback(
            (e: React.PointerEvent<HTMLCanvasElement>) => {
                if (!workingRef.current) return

                if (isLit) {
                    if (followCursor && !autoRot) {
                        e.currentTarget.setPointerCapture(e.pointerId)
                        updateLight(lightFromClient(e.clientX, e.clientY))
                    }
                    return
                }

                if (isSelectionTool) {
                    const pt = mapToSource(e.clientX, e.clientY)
                    const working = workingRef.current
                    if (!pt || !working || !sourceRef.current) return
                    e.currentTarget.setPointerCapture(e.pointerId)
                    const add = e.shiftKey
                    const sub = e.altKey
                    if (tool === 'wand') {
                        commitSelection(
                            wandSelect(sourceRef.current, working.rgba, working.width, working.height, pt.x, pt.y, wandTolerance),
                            add,
                            sub,
                        )
                        return
                    }
                    selDragRef.current = { tool, pts: [[pt.x, pt.y]], add, sub }
                    startAnts()
                    return
                }

                if (!editable) return
                const pt = mapToSource(e.clientX, e.clientY)
                if (!pt) return

                if (e.altKey && brushRef.current.mode === 'direction') {
                    const { rgba, width, height } = workingRef.current
                    const px = Math.max(0, Math.min(width - 1, Math.round(pt.x)))
                    const py = Math.max(0, Math.min(height - 1, Math.round(pt.y)))
                    const o = (py * width + px) * 4
                    onSampleDirection?.(unpack(rgba[o], rgba[o + 1], rgba[o + 2]))
                    return
                }

                const snap = snapshot()
                if (snap) {
                    undoStack.current.push(snap)
                    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift()
                    redoStack.current = []
                }
                drawingRef.current = true
                lastStampRef.current = pt
                e.currentTarget.setPointerCapture(e.pointerId)
                stampAt(pt.x, pt.y)
            },
            [isLit, isSelectionTool, tool, wandTolerance, commitSelection, startAnts, followCursor, autoRot, updateLight, lightFromClient, editable, mapToSource, snapshot, stampAt, onSampleDirection],
        )

        const onPointerMove = useCallback(
            (e: React.PointerEvent<HTMLCanvasElement>) => {
                lastClientRef.current = { x: e.clientX, y: e.clientY }

                if (isLit) {
                    if (followCursor && !autoRot) updateLight(lightFromClient(e.clientX, e.clientY))
                    return
                }

                if (isSelectionTool) {
                    const drag = selDragRef.current
                    if (!drag) return
                    const pt = mapToSource(e.clientX, e.clientY)
                    if (!pt) return
                    if (drag.tool === 'rect') drag.pts = [drag.pts[0], [pt.x, pt.y]]
                    else if (drag.tool === 'lasso') drag.pts.push([pt.x, pt.y])
                    drawOverlay()
                    return
                }

                if (!editable) return
                moveCursor(e.clientX, e.clientY)
                if (!drawingRef.current) return
                const pt = mapToSource(e.clientX, e.clientY)
                if (!pt) return
                const last = lastStampRef.current ?? pt
                const step = Math.max(1, brushRef.current.size * 0.25)
                const dx = pt.x - last.x
                const dy = pt.y - last.y
                const dist = Math.hypot(dx, dy)
                const steps = Math.max(1, Math.floor(dist / step))
                for (let i = 1; i <= steps; i++) {
                    stampAt(last.x + (dx * i) / steps, last.y + (dy * i) / steps)
                }
                lastStampRef.current = pt
            },
            [isLit, isSelectionTool, followCursor, autoRot, updateLight, lightFromClient, editable, moveCursor, mapToSource, drawOverlay, stampAt],
        )

        const endStroke = useCallback(
            (e: React.PointerEvent<HTMLCanvasElement>) => {
                try {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                } catch {
                    /* capture may already be gone */
                }

                const drag = selDragRef.current
                if (drag) {
                    selDragRef.current = null
                    const working = workingRef.current
                    if (working) {
                        let mask: Uint8Array | null = null
                        if (drag.tool === 'rect' && drag.pts.length >= 2) {
                            const [a, b] = [drag.pts[0], drag.pts[drag.pts.length - 1]]
                            mask = rectToMask(a[0], a[1], b[0], b[1], working.width, working.height)
                        } else if (drag.tool === 'lasso' && drag.pts.length >= 3) {
                            mask = polygonToMask(drag.pts, working.width, working.height)
                        }
                        if (mask) commitSelection(mask, drag.add, drag.sub)
                        else drawOverlay()
                    }
                    return
                }

                if (!drawingRef.current) return
                drawingRef.current = false
                lastStampRef.current = null
                if (workingRef.current) onEdit?.(workingRef.current.rgba)
            },
            [commitSelection, drawOverlay, onEdit],
        )

        const hideCursor = useCallback(() => {
            if (cursorRef.current) cursorRef.current.style.display = 'none'
        }, [])

        const onWheel = useCallback(
            (e: React.WheelEvent<HTMLCanvasElement>) => {
                if (!isLit) return
                const z = Math.min(2, Math.max(0.05, activeLight.z - e.deltaY * 0.001))
                updateLight({ ...activeLight, z })
            },
            [isLit, activeLight, updateLight],
        )

        const onKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLDivElement>) => {
                const key = e.key.toLowerCase()
                if (key === 'p' && isLit && lastClientRef.current) {
                    updateLight(lightFromClient(lastClientRef.current.x, lastClientRef.current.y))
                } else if (key === 'r') {
                    setAutoRot((v) => !v)
                }
            },
            [isLit, lightFromClient, updateLight],
        )

        // ── Imperative handle ──

        const handleGenerate = useCallback(async (): Promise<NormalMapOutput | null> => {
            if (disabled || generatingRef.current || !source) return null
            generatingRef.current = true
            try {
                let working = workingRef.current
                if (!working) {
                    let raw = rawSourceRef.current
                    if (!raw) {
                        try {
                            raw = await decodeSource(source)
                        } catch (err) {
                            onError?.(err)
                            return null
                        }
                        rawSourceRef.current = raw
                    }
                    const out = generateNormalMap(raw.rgba, raw.width, raw.height, optionsRef.current)
                    working = { rgba: out, width: raw.width, height: raw.height }
                    workingRef.current = working
                }

                const canvas = rgbaToCanvas(working.rgba, working.width, working.height)
                const png = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to generate PNG'))), 'image/png')
                })

                const output: NormalMapOutput = { png, rgba: working.rgba, width: working.width, height: working.height }
                onGenerate?.(output)
                return output
            } finally {
                generatingRef.current = false
            }
        }, [disabled, source, onGenerate, onError])

        const exportLit = useCallback(async (): Promise<Blob | null> => {
            const working = workingRef.current
            const src = sourceRef.current
            if (!working || !src) return null
            const canvas = ensureRenderer().shade({
                albedo: src,
                normal: working.rgba,
                width: working.width,
                height: working.height,
                light: resolvedLight,
                ambient,
                ambientColor: norm255(ambientColor),
                specular,
                shininess,
                surfaceOnly: false,
                albedoVersion: albedoVersionRef.current,
                normalVersion: normalVersionRef.current,
            })
            return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
        }, [ensureRenderer, resolvedLight, ambient, ambientColor, specular, shininess])

        const undo = useCallback(() => {
            const entry = undoStack.current.pop()
            if (!entry) return
            const cur = snapshot()
            if (cur) redoStack.current.push(cur)
            restore(entry)
        }, [snapshot, restore])

        const redo = useCallback(() => {
            const entry = redoStack.current.pop()
            if (!entry) return
            const cur = snapshot()
            if (cur) undoStack.current.push(cur)
            restore(entry)
        }, [snapshot, restore])

        const reset = useCallback(() => {
            const auto = autoRef.current
            const base = baseHeightRef.current
            const working = workingRef.current
            if (!auto || !base || !working) return
            working.rgba.set(auto)
            combinedHeightRef.current?.set(base)
            heightDeltaRef.current?.fill(0)
            normalVersionRef.current++
            undoStack.current = []
            redoStack.current = []
            renderRef.current()
            onEdit?.(working.rgba)
        }, [onEdit])

        const selectAll = useCallback(() => {
            const working = workingRef.current
            if (!working) return
            const m = new Uint8Array(working.width * working.height).fill(255)
            selectionRef.current = m
            antsEdgesRef.current = maskEdges(m, working.width, working.height)
            onSelectionChange?.(m)
            startAnts()
        }, [onSelectionChange, startAnts])

        const clearSelection = useCallback(() => {
            selectionRef.current = null
            antsEdgesRef.current = []
            onSelectionChange?.(null)
            stopAnts()
            drawOverlay()
        }, [onSelectionChange, stopAnts, drawOverlay])

        const setSelection = useCallback(
            (mask: Uint8Array | null) => {
                const working = workingRef.current
                if (!mask || !working) {
                    selectionRef.current = null
                    antsEdgesRef.current = []
                    onSelectionChange?.(null)
                    stopAnts()
                    drawOverlay()
                    return
                }
                selectionRef.current = mask
                antsEdgesRef.current = maskEdges(mask, working.width, working.height)
                onSelectionChange?.(mask)
                startAnts()
            },
            [onSelectionChange, startAnts, stopAnts, drawOverlay],
        )

        useImperativeHandle(
            ref,
            () => ({ generate: handleGenerate, undo, redo, reset, exportLit, selectAll, clearSelection, setSelection }),
            [handleGenerate, undo, redo, reset, exportLit, selectAll, clearSelection, setSelection],
        )

        const interactive = editable || isLit || isSelectionTool
        const rootClass = [
            'component',
            'component-normal-map-generator',
            editable && !isLit && !isSelectionTool ? 'component-normal-map-generator--editable' : '',
            isLit ? 'component-normal-map-generator--lit' : '',
            isSelectionTool ? 'component-normal-map-generator--selecting' : '',
            className,
        ]
            .filter(Boolean)
            .join(' ')

        const showBrushCursor = editable && !isLit && !isSelectionTool

        return (
            <div className={rootClass} tabIndex={interactive ? 0 : undefined} onKeyDown={interactive ? onKeyDown : undefined}>
                <canvas
                    ref={previewRef}
                    className="component-normal-map-generator__preview"
                    onPointerDown={interactive ? onPointerDown : undefined}
                    onPointerMove={interactive ? onPointerMove : undefined}
                    onPointerUp={interactive ? endStroke : undefined}
                    onPointerCancel={interactive ? endStroke : undefined}
                    onPointerLeave={showBrushCursor ? hideCursor : undefined}
                    onWheel={isLit ? onWheel : undefined}
                />
                <canvas
                    ref={overlayRef}
                    className="component-normal-map-generator__selection-overlay"
                    aria-hidden={true}
                />
                {showBrushCursor && (
                    <div ref={cursorRef} className="component-normal-map-generator__brush-cursor" aria-hidden={true} />
                )}
                {isLit && (
                    <div ref={gizmoRef} className="component-normal-map-generator__light-gizmo" aria-hidden={true} />
                )}
            </div>
        )
    },
)

NormalMapGenerator.displayName = 'NormalMapGenerator'

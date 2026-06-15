// tc-node-editor — framework-free canvas node/graph editor. Positioned HTML
// node boxes live inside a transformable viewport (CSS transform = pan + zoom);
// an SVG overlay inside that same viewport draws bezier edges between ports, so
// edges share the world coordinate space and need no redraw on pan/zoom. Light
// DOM, no shadow root. All cosmetics flow through --bs-node-editor-* tokens.

const TAG_NAME = 'tc-node-editor'

export interface NodePort {
    id: string
    label?: string
}

export interface GraphNode {
    id: string
    label: string
    inputs?: NodePort[]
    outputs?: NodePort[]
}

export interface GraphEdge {
    from: string
    to: string
    fromPort?: string
    toPort?: string
}

export interface GraphData {
    nodes: GraphNode[]
    edges: GraphEdge[]
}

export interface Pos {
    x: number
    y: number
}

// Layout constants — mirrored by the SCSS partial via --bs-node-editor-* so the
// analytic port anchors below line up with the rendered geometry.
const NODE_WIDTH = 168
const HEADER_H = 34
const BODY_PAD = 10
const PORT_ROW_H = 24
const MIN_BODY_H = 18
const GRID = 24

const ZOOM_MIN = 0.3
const ZOOM_MAX = 2.5
const ZOOM_STEP = 1.1
const DRAG_THRESHOLD = 3
const NUDGE = 10

// Four-character HTML escape — user strings (labels, ids) are injected into
// innerHTML, so encode the dangerous characters before they reach the DOM.
function esc(s: unknown): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function clamp(v: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, v))
}

interface DragState {
    mode: 'pan' | 'node' | 'connect'
    moved: boolean
    // pan
    startPanX?: number
    startPanY?: number
    startScreenX?: number
    startScreenY?: number
    // node drag
    nodeId?: string
    startPosX?: number
    startPosY?: number
    startWorldX?: number
    startWorldY?: number
    // connect drag
    fromNode?: string
    fromPort?: string
}

export class NodeEditor extends HTMLElement {

    private _initialised = false

    private _graph: GraphData = { nodes: [], edges: [] }
    private _positions: Record<string, Pos> = {}

    private _panX = 0
    private _panY = 0
    private _zoom = 1

    private _drag: DragState | null = null
    private _dragMoveHandler: ((e: PointerEvent) => void) | null = null
    private _dragUpHandler: ((e: PointerEvent) => void) | null = null

    onSelect: ((id: string | null) => void) | null = null
    onMoveNode: ((id: string, pos: Pos) => void) | null = null
    onConnect: ((from: string, to: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id', 'disabled']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this.addEventListener('pointerdown', this._onPointerDown)
        this.addEventListener('wheel', this._onWheel, { passive: false })
        this.addEventListener('keydown', this._onKeyDown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('pointerdown', this._onPointerDown)
        this.removeEventListener('wheel', this._onWheel)
        this.removeEventListener('keydown', this._onKeyDown)
        this._cleanupDrag()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'selected-id') {
            this._patchSelection()
        } else {
            // disabled — re-render to refresh aria-disabled / interaction chrome
            this.render()
        }
    }

    // ---- properties ---------------------------------------------------------

    get graph(): GraphData {
        return this._graph
    }
    set graph(v: GraphData) {
        this._graph =
            v && typeof v === 'object' && Array.isArray(v.nodes) && Array.isArray(v.edges)
                ? v
                : { nodes: [], edges: [] }
        if (this._initialised) this.render()
    }

    get positions(): Record<string, Pos> {
        return this._positions
    }
    set positions(v: Record<string, Pos>) {
        this._positions = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
        if (this._initialised) this.render()
    }

    get selectedId(): string | null {
        return this.getAttribute('selected-id')
    }
    set selectedId(v: string | null) {
        if (v != null) this.setAttribute('selected-id', v)
        else this.removeAttribute('selected-id')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ---- geometry -----------------------------------------------------------

    private _posOf(node: GraphNode, index: number): Pos {
        const p = this._positions[node.id]
        if (p && typeof p.x === 'number' && typeof p.y === 'number') return p
        // Fallback auto-layout: stagger nodes diagonally so an unpositioned
        // graph is still legible.
        return { x: 40 + index * 60, y: 40 + index * 90 }
    }

    private _bodyHeight(node: GraphNode): number {
        const rows = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0)
        return rows > 0 ? rows * PORT_ROW_H + BODY_PAD * 2 : MIN_BODY_H + BODY_PAD * 2
    }

    // World-space anchor for a port on a given node side. When no matching port
    // id is found we fall back to the node's vertical centre on that edge.
    private _anchor(nodeId: string, side: 'in' | 'out', portId?: string): Pos | null {
        const idx = this._graph.nodes.findIndex(n => n.id === nodeId)
        if (idx === -1) return null
        const node = this._graph.nodes[idx]
        const pos = this._posOf(node, idx)
        const x = side === 'in' ? pos.x : pos.x + NODE_WIDTH
        const ports = side === 'in' ? node.inputs : node.outputs
        let row = -1
        if (ports && ports.length) {
            row = portId != null ? ports.findIndex(p => p.id === portId) : 0
            if (row === -1) row = 0
        }
        const y =
            row >= 0
                ? pos.y + HEADER_H + BODY_PAD + row * PORT_ROW_H + PORT_ROW_H / 2
                : pos.y + HEADER_H + this._bodyHeight(node) / 2
        return { x, y }
    }

    private _edgePath(a: Pos, b: Pos): string {
        const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5)
        return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
    }

    private _screenToWorld(clientX: number, clientY: number): { x: number; y: number; sx: number; sy: number } {
        const root = this.querySelector('.tc-node-editor') as HTMLElement | null
        const rect = root ? root.getBoundingClientRect() : { left: 0, top: 0 }
        const sx = clientX - rect.left
        const sy = clientY - rect.top
        return { x: (sx - this._panX) / this._zoom, y: (sy - this._panY) / this._zoom, sx, sy }
    }

    // ---- rendering ----------------------------------------------------------

    private render(): void {
        const disabled = this.disabled
        const selected = this.getAttribute('selected-id')

        const nodesHtml = this._graph.nodes
            .map((node, i) => {
                const pos = this._posOf(node, i)
                const isSel = selected != null && node.id === selected
                const body = this._renderBody(node)
                return (
                    `<div class="tc-node-editor-node${isSel ? ' tc-node-editor-node--selected' : ''}" ` +
                    `data-node-id="${esc(node.id)}" tabindex="${disabled ? '-1' : '0'}" role="button" ` +
                    `aria-selected="${isSel ? 'true' : 'false'}" aria-label="${esc(node.label)}" ` +
                    `style="left:${pos.x}px;top:${pos.y}px;width:${NODE_WIDTH}px">` +
                    `<div class="tc-node-editor-node-header">${esc(node.label)}</div>` +
                    `<div class="tc-node-editor-node-body" style="min-height:${this._bodyHeight(node)}px">${body}</div>` +
                    `</div>`
                )
            })
            .join('')

        this.innerHTML =
            `<div class="tc-node-editor" role="application" aria-label="Node editor canvas"` +
            `${disabled ? ' aria-disabled="true"' : ''}>` +
            `<div class="tc-node-editor-viewport">` +
            `<svg class="tc-node-editor-edges" aria-hidden="true"></svg>` +
            nodesHtml +
            `</div>` +
            `</div>`

        this._applyTransform()
        this._renderEdges()
    }

    private _renderBody(node: GraphNode): string {
        const inputs = (node.inputs ?? [])
            .map(
                p =>
                    `<div class="tc-node-editor-port-row">` +
                    `<span class="tc-node-editor-port tc-node-editor-port--in" data-node-id="${esc(node.id)}" data-port-id="${esc(p.id)}" data-side="in"></span>` +
                    `<span class="tc-node-editor-port-label">${esc(p.label ?? p.id)}</span>` +
                    `</div>`
            )
            .join('')
        const outputs = (node.outputs ?? [])
            .map(
                p =>
                    `<div class="tc-node-editor-port-row tc-node-editor-port-row--out">` +
                    `<span class="tc-node-editor-port-label">${esc(p.label ?? p.id)}</span>` +
                    `<span class="tc-node-editor-port tc-node-editor-port--out" data-node-id="${esc(node.id)}" data-port-id="${esc(p.id)}" data-side="out"></span>` +
                    `</div>`
            )
            .join('')
        return (
            `<div class="tc-node-editor-ports tc-node-editor-ports--in">${inputs}</div>` +
            `<div class="tc-node-editor-ports tc-node-editor-ports--out">${outputs}</div>`
        )
    }

    private _renderEdges(preview?: { from: Pos; to: Pos }): void {
        const svg = this.querySelector('.tc-node-editor-edges')
        if (!svg) return
        let paths = ''
        for (const edge of this._graph.edges) {
            const a = this._anchor(edge.from, 'out', edge.fromPort)
            const b = this._anchor(edge.to, 'in', edge.toPort)
            if (!a || !b) continue
            paths += `<path class="tc-node-editor-edge" d="${this._edgePath(a, b)}" fill="none" />`
        }
        if (preview) {
            paths += `<path class="tc-node-editor-edge tc-node-editor-edge--preview" d="${this._edgePath(preview.from, preview.to)}" fill="none" />`
        }
        svg.innerHTML = paths
    }

    private _applyTransform(): void {
        const vp = this.querySelector('.tc-node-editor-viewport') as HTMLElement | null
        if (vp) vp.style.transform = `translate(${this._panX}px, ${this._panY}px) scale(${this._zoom})`
        const root = this.querySelector('.tc-node-editor') as HTMLElement | null
        if (root) {
            const size = GRID * this._zoom
            root.style.backgroundSize = `${size}px ${size}px`
            root.style.backgroundPosition = `${this._panX}px ${this._panY}px`
        }
    }

    private _patchSelection(): void {
        const selected = this.getAttribute('selected-id')
        this.querySelectorAll<HTMLElement>('.tc-node-editor-node').forEach(el => {
            const isSel = selected != null && el.dataset.nodeId === selected
            el.classList.toggle('tc-node-editor-node--selected', isSel)
            el.setAttribute('aria-selected', isSel ? 'true' : 'false')
        })
    }

    // ---- selection / events -------------------------------------------------

    private _select(id: string | null): void {
        const current = this.getAttribute('selected-id')
        if (current === id || (current == null && id == null)) return
        if (id != null) this.setAttribute('selected-id', id)
        else this.removeAttribute('selected-id')
        // attributeChangedCallback patches selection visuals; fire the event.
        this.dispatchEvent(
            new CustomEvent('tc-select', { bubbles: true, composed: true, detail: { id } })
        )
        if (typeof this.onSelect === 'function') this.onSelect(id)
    }

    private _emitMove(id: string, pos: Pos): void {
        this.dispatchEvent(
            new CustomEvent('tc-move-node', { bubbles: true, composed: true, detail: { id, pos } })
        )
        if (typeof this.onMoveNode === 'function') this.onMoveNode(id, pos)
    }

    private _emitConnect(from: string, to: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-connect', { bubbles: true, composed: true, detail: { from, to } })
        )
        if (typeof this.onConnect === 'function') this.onConnect(from, to)
    }

    // ---- pointer interaction ------------------------------------------------

    private _onPointerDown = (e: PointerEvent): void => {
        if (this.disabled || e.button !== 0) return
        const target = e.target as HTMLElement

        const port = target.closest<HTMLElement>('.tc-node-editor-port--out')
        if (port) {
            // Begin connection drag from an output port.
            const fromNode = port.dataset.nodeId!
            const fromPort = port.dataset.portId
            this._select(fromNode)
            this._drag = { mode: 'connect', moved: false, fromNode, fromPort }
            this._attachDrag()
            e.preventDefault()
            return
        }

        const node = target.closest<HTMLElement>('.tc-node-editor-node')
        if (node) {
            const nodeId = node.dataset.nodeId!
            this._select(nodeId)
            node.focus()
            const header = target.closest('.tc-node-editor-node-header')
            if (header) {
                const world = this._screenToWorld(e.clientX, e.clientY)
                const idx = this._graph.nodes.findIndex(n => n.id === nodeId)
                const pos = idx === -1 ? { x: 0, y: 0 } : this._posOf(this._graph.nodes[idx], idx)
                this._drag = {
                    mode: 'node',
                    moved: false,
                    nodeId,
                    startPosX: pos.x,
                    startPosY: pos.y,
                    startWorldX: world.x,
                    startWorldY: world.y,
                }
                this._attachDrag()
                e.preventDefault()
            }
            return
        }

        // Empty canvas — pan, and clear selection on a click without movement.
        this._drag = {
            mode: 'pan',
            moved: false,
            startPanX: this._panX,
            startPanY: this._panY,
            startScreenX: e.clientX,
            startScreenY: e.clientY,
        }
        this._attachDrag()
    }

    private _attachDrag(): void {
        this._dragMoveHandler = (e: PointerEvent) => this._onDragMove(e)
        this._dragUpHandler = (e: PointerEvent) => this._onDragUp(e)
        document.addEventListener('pointermove', this._dragMoveHandler)
        document.addEventListener('pointerup', this._dragUpHandler)
        document.addEventListener('pointercancel', this._dragUpHandler)
    }

    private _cleanupDrag(): void {
        if (this._dragMoveHandler) {
            document.removeEventListener('pointermove', this._dragMoveHandler)
            this._dragMoveHandler = null
        }
        if (this._dragUpHandler) {
            document.removeEventListener('pointerup', this._dragUpHandler)
            document.removeEventListener('pointercancel', this._dragUpHandler)
            this._dragUpHandler = null
        }
        this._drag = null
    }

    private _onDragMove(e: PointerEvent): void {
        const d = this._drag
        if (!d) return

        if (d.mode === 'pan') {
            const dx = e.clientX - d.startScreenX!
            const dy = e.clientY - d.startScreenY!
            if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) d.moved = true
            this._panX = d.startPanX! + dx
            this._panY = d.startPanY! + dy
            this._applyTransform()
            return
        }

        if (d.mode === 'node') {
            const world = this._screenToWorld(e.clientX, e.clientY)
            const nx = d.startPosX! + (world.x - d.startWorldX!)
            const ny = d.startPosY! + (world.y - d.startWorldY!)
            if (
                Math.abs(world.x - d.startWorldX!) > DRAG_THRESHOLD / this._zoom ||
                Math.abs(world.y - d.startWorldY!) > DRAG_THRESHOLD / this._zoom
            )
                d.moved = true
            this._positions = { ...this._positions, [d.nodeId!]: { x: Math.round(nx), y: Math.round(ny) } }
            const el = this.querySelector<HTMLElement>(`.tc-node-editor-node[data-node-id="${cssEscape(d.nodeId!)}"]`)
            if (el) {
                el.style.left = `${Math.round(nx)}px`
                el.style.top = `${Math.round(ny)}px`
            }
            this._renderEdges()
            return
        }

        if (d.mode === 'connect') {
            d.moved = true
            const from = this._anchor(d.fromNode!, 'out', d.fromPort)
            if (from) {
                const world = this._screenToWorld(e.clientX, e.clientY)
                this._renderEdges({ from, to: world })
            }
        }
    }

    private _onDragUp(e: PointerEvent): void {
        const d = this._drag
        if (!d) {
            this._cleanupDrag()
            return
        }

        if (d.mode === 'pan' && !d.moved) {
            this._select(null)
        } else if (d.mode === 'node' && d.moved) {
            const pos = this._positions[d.nodeId!]
            if (pos) this._emitMove(d.nodeId!, pos)
        } else if (d.mode === 'connect') {
            const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
            const inPort = el?.closest<HTMLElement>('.tc-node-editor-port--in')
            if (inPort) {
                const to = inPort.dataset.nodeId!
                if (to && to !== d.fromNode) this._emitConnect(d.fromNode!, to)
            }
            this._renderEdges()
        }

        this._cleanupDrag()
    }

    private _onWheel = (e: WheelEvent): void => {
        if (this.disabled) return
        e.preventDefault()
        const world = this._screenToWorld(e.clientX, e.clientY)
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
        const next = clamp(this._zoom * factor, ZOOM_MIN, ZOOM_MAX)
        // Keep the world point under the cursor fixed while zooming.
        this._panX = world.sx - world.x * next
        this._panY = world.sy - world.y * next
        this._zoom = next
        this._applyTransform()
    }

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (this.disabled) return
        const node = (e.target as HTMLElement).closest<HTMLElement>('.tc-node-editor-node')
        if (!node) return
        const nodeId = node.dataset.nodeId!

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            this._select(nodeId)
            return
        }

        let dx = 0
        let dy = 0
        if (e.key === 'ArrowLeft') dx = -NUDGE
        else if (e.key === 'ArrowRight') dx = NUDGE
        else if (e.key === 'ArrowUp') dy = -NUDGE
        else if (e.key === 'ArrowDown') dy = NUDGE
        else return

        e.preventDefault()
        const idx = this._graph.nodes.findIndex(n => n.id === nodeId)
        if (idx === -1) return
        const cur = this._posOf(this._graph.nodes[idx], idx)
        const pos = { x: cur.x + dx, y: cur.y + dy }
        this._positions = { ...this._positions, [nodeId]: pos }
        node.style.left = `${pos.x}px`
        node.style.top = `${pos.y}px`
        this._renderEdges()
        this._emitMove(nodeId, pos)
    }
}

// CSS.escape with a tiny fallback so the attribute selector survives ids that
// contain quotes or other special characters.
function cssEscape(value: string): string {
    if (typeof (window as any).CSS !== 'undefined' && typeof (window as any).CSS.escape === 'function') {
        return (window as any).CSS.escape(value)
    }
    return value.replace(/["\\]/g, '\\$&')
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: NodeEditor
    }
}

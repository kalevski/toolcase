import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { num } from './internal/tc-element'

// tc-graph-canvas — a radial tidy tree: one centre, its children on a ring, their
// children on the next ring out.
//
// From mindmap's `NoteGraphCanvas` and `helpers/graphLayout.ts`. The layout maths
// is domain-free and the two decisions in it are the reason it is worth lifting:
//
// A RING'S RADIUS GROWS WITH ITS SIBLING COUNT, not with its level. Placing every
// level at a fixed radius works until a node has eleven children, at which point
// eleven cards are drawn on a circle whose circumference cannot hold them and
// they overlap. The radius is therefore derived from how many nodes have to fit
// on the ring, which keeps the gap between siblings roughly constant however wide
// the tree is.
//
// PAST EIGHT SIBLINGS THE RING BECOMES A GRID. A twelfth child on an ever-growing
// ring pushes the whole drawing off screen to keep an arc that nobody is reading
// as an arc any more. Past the threshold the children stack into a block instead:
// still grouped under their parent, no longer pretending to be a ring.
//
// CARDS SHRINK BY LEVEL. A third-ring node is context, not content, and drawing
// it at the same size as the centre is what makes a radial graph unreadable at
// the exact moment it has enough in it to be worth drawing.
//
// A CHILD'S SLICE OF THE RING IS WEIGHTED BY ITS OWN SUBTREE, not split evenly
// among siblings — see `_weight`. A branch that has grown wide gets
// proportionally more of the circle, so a dense subtree can never crowd into a
// sparse sibling's territory the way an even split would let it.
//
// A GRID'S COLUMNS ARE SIZED FROM WHAT IS ACTUALLY GOING INTO IT — see
// `_measure`/`_gridFor` — so a stacked block whose members are themselves
// deeply branching packs wide-and-short instead of running a uniform-cell
// column off the canvas.
//
// LINKS ARE TRIMMED TO THE CARD'S EDGE AND BENT, never drawn centre to centre —
// see `_drawGuides` — and every child of one parent leaves that parent from the
// same point, which is what makes the drawing read as a tree rather than a
// scatter of sticks.
//
// The element draws the LAYOUT — the ring guides, the spokes and a positioned box
// per node — and hands each box back through `--tc-node-*` custom properties. The
// node's own contents are yours: pass them as children carrying `data-node-id`,
// and this element positions them without ever moving them into a wrapper.

const TAG_NAME = 'tc-graph-canvas'

export interface GraphCanvasNode {
    id: string
    /** The parent's id. Absent (or unmatched) makes this a root. */
    parent?: string | null
    label?: string
    /** Colour key, exposed as `data-tone` on the placed box. */
    tone?: string
}

export interface GraphCanvasPlacement {
    id: string
    x: number
    y: number
    /** 0 for the centre, 1 for the first ring, and so on. */
    level: number
    /** The scale a card at this level is drawn at. */
    scale: number
}

/** Past this many siblings a ring stops being a ring. See the header. */
const RING_CAP = 8

/** How much smaller each level is drawn than the one inside it. */
const LEVEL_SHRINK = 0.82

const RADIAN = Math.PI / 180

const TAU = Math.PI * 2

/** Clearance folded into a ring's circumference formula and a stacked grid's
 *  per-item padding — kept as named constants so the two pads used across
 *  `_weight`/`_measure`/`_layout` can't drift apart. */
const SIBLING_GAP = 24
const GRID_GAP = 12

/** A hair of clearance so a link's stroke doesn't touch the card's own border. */
const EDGE_GAP = 3

const CURVE = 0.42

/** The shortest link still gets a readable bend rather than collapsing to a
 *  straight stub. */
const MIN_BEND = 16

export class GraphCanvas extends HTMLElement {
    private _built = false
    private _nodes: GraphCanvasNode[] = []
    private _placements: GraphCanvasPlacement[] = []
    private _layer: HTMLElement | null = null

    static get observedAttributes(): string[] {
        return ['ring-gap', 'node-width', 'node-height', 'start-angle', 'class']
    }

    connectedCallback(): void {
        if (!this._built) {
            // The guides layer is element-owned and sits BEHIND everything; your
            // node children stay direct children of the host and are positioned by
            // the custom properties this element writes on them.
            this.insertAdjacentHTML(
                'afterbegin',
                `<svg class="tc-graph-canvas__guides" aria-hidden="true" focusable="false"></svg>`,
            )
            this._layer = this.querySelector(':scope > .tc-graph-canvas__guides')
            this._built = true
        }
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** The tree, flat. A JS property. */
    get nodes(): GraphCanvasNode[] {
        return this._nodes
    }
    set nodes(v: GraphCanvasNode[]) {
        this._nodes = Array.isArray(v) ? v : []
        if (this._built) this.patch()
    }

    /** The computed layout. Read-only — useful for a consumer drawing their own
     *  edges, or measuring the drawing before it is on screen. */
    get placements(): GraphCanvasPlacement[] {
        return this._placements
    }

    /** Base distance between rings, in px. The real radius grows past it when a
     *  ring has more on it than the gap can hold. */
    get ringGap(): number {
        return num(this.getAttribute('ring-gap'), 180)
    }
    set ringGap(v: number) {
        this.setAttribute('ring-gap', String(v))
    }

    get nodeWidth(): number {
        return num(this.getAttribute('node-width'), 168)
    }
    set nodeWidth(v: number) {
        this.setAttribute('node-width', String(v))
    }

    get nodeHeight(): number {
        return num(this.getAttribute('node-height'), 72)
    }
    set nodeHeight(v: number) {
        this.setAttribute('node-height', String(v))
    }

    /** Where the first child of a ring is placed, in degrees. `-90` is twelve
     *  o'clock, which is where a reader looks first. */
    get startAngle(): number {
        return num(this.getAttribute('start-angle'), -90)
    }
    set startAngle(v: number) {
        this.setAttribute('start-angle', String(v))
    }

    private patch(): void {
        setHostClass(this, 'tc-graph-canvas')
        this._layout()
        this._place()
        this._drawGuides()
    }

    // ── Layout ───────────────────────────────────────────────────────────────

    private _childrenOf(id: string | null): GraphCanvasNode[] {
        const ids = new Set(this._nodes.map((n) => n.id))
        return this._nodes.filter((node) => {
            const parent = node.parent ?? null
            // A parent that is not in the set is the same as no parent: a subtree
            // handed in without its ancestors still has to draw.
            const resolved = parent !== null && ids.has(parent) ? parent : null
            return resolved === id
        })
    }

    // ── Weighing subtrees ────────────────────────────────────────────────────

    /** How many equivalent-width ring slots one child's subtree needs. A leaf is
     *  one; an ordinary node sums its own children's weight; a stacked block
     *  counts as however many standard-width columns its own grid needs. Used
     *  to size each child's angular slice in `_layout` — a branch that has grown
     *  wide gets proportionally more of the ring instead of the same slice as a
     *  one-node sibling, so two subtrees can never crowd into each other. */
    private _weight(id: string, level: number): number {
        const children = this._childrenOf(id)
        if (children.length === 0) return 1
        if (children.length > RING_CAP) {
            const scale = LEVEL_SHRINK ** level
            const grid = this._gridFor(children, level + 1)
            return Math.max(1, grid.lateral / (this.nodeWidth * scale + SIBLING_GAP))
        }
        return children.reduce((sum, child) => sum + this._weight(child.id, level + 1), 0)
    }

    /** A node's own footprint once its stacked descendants (if any) are folded
     *  in: how wide (lateral) and how deep (outward) drawing it and everything
     *  beneath it actually needs. */
    private _measure(id: string, level: number): { lateral: number; outward: number } {
        const scale = LEVEL_SHRINK ** level
        const width = this.nodeWidth * scale + GRID_GAP
        const height = this.nodeHeight * scale + GRID_GAP
        const children = this._childrenOf(id)
        if (children.length === 0) return { lateral: width, outward: height }
        const grid = this._gridFor(children, level + 1)
        return {
            lateral: Math.max(width, grid.lateral),
            outward: height + this.ringGap * 0.7 + grid.outward + GRID_GAP,
        }
    }

    /** Columns sized from the AVERAGE measured footprint of what is actually
     *  going into the grid, so a block whose members are themselves deeply
     *  stacked comes out wide-and-short instead of the tall column a plain
     *  `sqrt(count)` would draw. Column widths and row heights then come from
     *  the largest item actually in that column/row, not a uniform cell. */
    private _gridFor(
        children: GraphCanvasNode[],
        level: number,
    ): {
        columns: number
        rows: number
        columnWidths: number[]
        rowHeights: number[]
        lateral: number
        outward: number
    } {
        const items = children.map((child) => this._measure(child.id, level))
        const count = items.length
        const lateralAvg = items.reduce((sum, box) => sum + box.lateral, 0) / count
        const outwardAvg = items.reduce((sum, box) => sum + box.outward, 0) / count
        const columns = Math.max(1, Math.min(count, Math.ceil(Math.sqrt((count * outwardAvg) / lateralAvg))))
        const rows = Math.ceil(count / columns)
        const columnWidths: number[] = new Array(columns).fill(0)
        const rowHeights: number[] = new Array(rows).fill(0)

        items.forEach((box, index) => {
            const column = Math.floor(index / rows)
            const row = index % rows
            columnWidths[column] = Math.max(columnWidths[column], box.lateral)
            rowHeights[row] = Math.max(rowHeights[row], box.outward)
        })

        return {
            columns,
            rows,
            columnWidths,
            rowHeights,
            lateral: columnWidths.reduce((sum, w) => sum + w, 0),
            outward: rowHeights.reduce((sum, h) => sum + h, 0),
        }
    }

    // ── Layout ───────────────────────────────────────────────────────────────

    private _layout(): void {
        const placements: GraphCanvasPlacement[] = []
        const roots = this._childrenOf(null)
        const gap = this.ringGap

        const walk = (
            parents: Array<{ node: GraphCanvasNode; x: number; y: number }>,
            level: number,
        ): void => {
            if (parents.length === 0 || level > 6) return
            const next: Array<{ node: GraphCanvasNode; x: number; y: number }> = []
            for (const parent of parents) {
                const children = this._childrenOf(parent.node.id)
                if (children.length === 0) continue
                const scale = LEVEL_SHRINK ** level

                if (children.length > RING_CAP) {
                    // Past the cap the ring becomes a grid under the parent, sized
                    // from what each child's own subtree actually needs rather than
                    // a uniform cell — see `_gridFor` — so a block whose members are
                    // themselves deeply stacked comes out wide-and-short instead of
                    // running a column off the canvas.
                    const grid = this._gridFor(children, level)
                    const columnLefts: number[] = []
                    let left = -grid.lateral / 2
                    for (const columnWidth of grid.columnWidths) {
                        columnLefts.push(left)
                        left += columnWidth
                    }
                    const rowTops: number[] = []
                    let top = gap * 0.7
                    for (const rowHeight of grid.rowHeights) {
                        rowTops.push(top)
                        top += rowHeight
                    }
                    children.forEach((child, index) => {
                        const column = Math.floor(index / grid.rows)
                        const row = index % grid.rows
                        const x = parent.x + columnLefts[column] + grid.columnWidths[column] / 2
                        const y = parent.y + rowTops[row] + (this.nodeHeight * scale) / 2
                        placements.push({ id: child.id, x, y, level, scale })
                        next.push({ node: child, x, y })
                    })
                    continue
                }

                // Each child's slice of the circle is proportional to its own
                // subtree's weight (see `_weight`), not an even split, so a branch
                // that has grown wide gets proportionally more of the ring and a
                // sibling's subtree can never crowd into it. The radius still grows
                // with the sibling count — sized to whichever child needs the most
                // room for its (possibly narrower) slice.
                const weights = children.map((child) => this._weight(child.id, level))
                const total = weights.reduce((sum, w) => sum + w, 0)
                const needed = weights.reduce((widest, w) => {
                    const span = Math.max((TAU * w) / total, 0.0001)
                    return Math.max(widest, (this.nodeWidth * scale + SIBLING_GAP) / span)
                }, 0)
                const radius = Math.max(gap * (level === 1 ? 1 : 0.8), needed)

                let cursor = 0
                children.forEach((child, index) => {
                    const span = (360 * weights[index]) / total
                    const angle = (this.startAngle + cursor + span / 2) * RADIAN
                    cursor += span
                    const x = parent.x + Math.cos(angle) * radius
                    const y = parent.y + Math.sin(angle) * radius
                    placements.push({ id: child.id, x, y, level, scale })
                    next.push({ node: child, x, y })
                })
            }
            walk(next, level + 1)
        }

        // Several roots share the centre ring rather than stacking: a forest is a
        // ring of trees, which is what a "recent graphs" canvas actually holds.
        const centres = roots.map((node, index) => {
            if (roots.length === 1) return { node, x: 0, y: 0 }
            const angle = (this.startAngle + (360 / roots.length) * index) * RADIAN
            const radius = gap * 0.6
            return { node, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
        })
        for (const centre of centres) {
            placements.push({ id: centre.node.id, x: centre.x, y: centre.y, level: 0, scale: 1 })
        }
        walk(centres, 1)
        this._placements = placements
    }

    // ── Placing the consumer's own nodes ─────────────────────────────────────

    private _place(): void {
        const byId = new Map(this._placements.map((p) => [p.id, p]))
        for (const child of Array.from(
            this.querySelectorAll<HTMLElement>(':scope > [data-node-id]'),
        )) {
            const placement = byId.get(child.dataset.nodeId ?? '')
            if (!placement) {
                // A node with no placement is not hidden — it is left where it is,
                // because a consumer may be animating one out and a canvas that
                // deletes state it does not understand is a canvas nobody trusts.
                child.removeAttribute('data-placed')
                continue
            }
            child.setAttribute('data-placed', '')
            child.setAttribute('data-level', String(placement.level))
            child.style.setProperty('--tc-node-x', `${placement.x.toFixed(2)}px`)
            child.style.setProperty('--tc-node-y', `${placement.y.toFixed(2)}px`)
            child.style.setProperty('--tc-node-scale', placement.scale.toFixed(3))
            const tone = this._nodes.find((n) => n.id === placement.id)?.tone
            if (tone) child.setAttribute('data-tone', tone)
        }
    }

    // ── Guides ───────────────────────────────────────────────────────────────

    private _drawGuides(): void {
        const svg = this._layer
        if (!svg) return
        const byId = new Map(this._placements.map((p) => [p.id, p]))
        const ids = new Set(this._nodes.map((n) => n.id))
        const parentOf = (node: GraphCanvasNode): string | null => {
            const parent = node.parent ?? null
            return parent !== null && ids.has(parent) ? parent : null
        }

        // The direction a node's link leaves ITS PARENT from — away from
        // wherever that parent was itself reached from — so every child of one
        // parent exits the same point on its edge instead of scattering around
        // its perimeter. Falls back to straight up in the degenerate case of a
        // node sitting exactly on top of its own reference point.
        const along = (id: string): { x: number; y: number } => {
            const placement = byId.get(id)
            if (!placement) return { x: 0, y: -1 }
            const node = this._nodes.find((n) => n.id === id) ?? null
            const anchor = node ? byId.get(parentOf(node) ?? '') : null
            const ox = anchor ? anchor.x : 0
            const oy = anchor ? anchor.y : 0
            const dx = placement.x - ox
            const dy = placement.y - oy
            const dist = Math.hypot(dx, dy)
            return dist < 1 ? { x: 0, y: -1 } : { x: dx / dist, y: dy / dist }
        }

        // Where a ray leaving a card's centre crosses its (rectangular) boundary.
        const edgeOf = (
            centre: { x: number; y: number },
            size: { width: number; height: number },
            dx: number,
            dy: number,
        ) => {
            const spanX = dx === 0 ? Infinity : size.width / 2 / Math.abs(dx)
            const spanY = dy === 0 ? Infinity : size.height / 2 / Math.abs(dy)
            const span = Math.min(spanX, spanY)
            return { x: centre.x + dx * span, y: centre.y + dy * span }
        }

        const lines = this._nodes
            .map((node) => {
                const to = byId.get(node.id)
                const parentId = parentOf(node)
                const from = parentId ? byId.get(parentId) : null
                if (!to || !from || !parentId) return ''

                const lead = along(parentId)
                const tail = along(node.id)
                const fromSize = { width: this.nodeWidth * from.scale, height: this.nodeHeight * from.scale }
                const toSize = { width: this.nodeWidth * to.scale, height: this.nodeHeight * to.scale }

                const fromEdge = edgeOf(from, fromSize, lead.x, lead.y)
                const toEdge = edgeOf(to, toSize, -tail.x, -tail.y)

                const reach = Math.hypot(toEdge.x - fromEdge.x, toEdge.y - fromEdge.y)
                if (reach <= EDGE_GAP * 2) return ''

                const start = { x: fromEdge.x + lead.x * EDGE_GAP, y: fromEdge.y + lead.y * EDGE_GAP }
                const end = { x: toEdge.x - tail.x * EDGE_GAP, y: toEdge.y - tail.y * EDGE_GAP }
                const bend = Math.max(MIN_BEND, reach * CURVE)
                const c1 = { x: start.x + lead.x * bend, y: start.y + lead.y * bend }
                const c2 = { x: end.x - tail.x * bend, y: end.y - tail.y * bend }

                return (
                    `<path class="tc-graph-canvas__spoke"` +
                    ` d="M${start.x.toFixed(1)} ${start.y.toFixed(1)}` +
                    ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)}, ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}"/>`
                )
            })
            .join('')

        // The viewBox is centred on the origin and grown to whatever the layout
        // needed, so the drawing is never clipped and never has to be measured
        // twice.
        const reach = this._placements.reduce(
            (max, p) => Math.max(max, Math.abs(p.x), Math.abs(p.y)),
            this.ringGap,
        )
        const extent = Math.ceil(reach + this.nodeWidth)
        const box = `${-extent} ${-extent} ${extent * 2} ${extent * 2}`
        if (svg.getAttribute('viewBox') !== box) svg.setAttribute('viewBox', box)
        if (svg.innerHTML !== lines) svg.innerHTML = lines
        this.style.setProperty('--tc-graph-extent', `${extent * 2}px`)
        // Exposed for a consumer that wants to label the drawing.
        this.setAttribute('data-node-count', esc(String(this._nodes.length)))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GraphCanvas
    }
}

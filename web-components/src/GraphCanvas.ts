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

    private _layout(): void {
        const placements: GraphCanvasPlacement[] = []
        const roots = this._childrenOf(null)
        const gap = this.ringGap
        const width = this.nodeWidth
        const height = this.nodeHeight

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
                    // Past the cap the ring becomes a grid under the parent. Columns
                    // are the square root of the count, so a block of twelve is 4×3
                    // rather than a column of twelve running off the canvas.
                    const columns = Math.ceil(Math.sqrt(children.length))
                    const cellW = width * scale + 12
                    const cellH = height * scale + 12
                    const rows = Math.ceil(children.length / columns)
                    children.forEach((child, index) => {
                        const column = index % columns
                        const row = Math.floor(index / columns)
                        const x = parent.x + (column - (columns - 1) / 2) * cellW
                        const y = parent.y + gap * 0.7 + (row - (rows - 1) / 2) * cellH
                        placements.push({ id: child.id, x, y, level, scale })
                        next.push({ node: child, x, y })
                    })
                    continue
                }

                // The radius grows with the sibling count so the GAP between
                // siblings stays roughly constant — see the header.
                const circumference = children.length * (width * scale + 24)
                const radius = Math.max(
                    gap * (level === 1 ? 1 : 0.8),
                    circumference / (2 * Math.PI),
                )
                children.forEach((child, index) => {
                    const angle = (this.startAngle + (360 / children.length) * index) * RADIAN
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
        const lines = this._nodes
            .map((node) => {
                const to = byId.get(node.id)
                const from = node.parent ? byId.get(node.parent) : null
                if (!to || !from) return ''
                return (
                    `<line class="tc-graph-canvas__spoke"` +
                    ` x1="${from.x.toFixed(2)}" y1="${from.y.toFixed(2)}"` +
                    ` x2="${to.x.toFixed(2)}" y2="${to.y.toFixed(2)}"/>`
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

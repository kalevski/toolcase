import { setHostClass } from './internal/host-class'
import { num, setAttr } from './internal/tc-element'

// tc-graph-sigil — a miniature of a tree's own first ring, used as its identity
// mark.
//
// From mindmap's `GraphSigil` (82 lines). The idea generalises past graphs: any
// list of trees, boards, projects or documents needs a thumbnail, and the two
// usual answers are both bad. A screenshot is expensive to make, stale the moment
// anything changes, and unreadable at 72px. A letter avatar says nothing about
// the thing — two graphs called "Notes" get the same mark.
//
// A sigil is drawn FROM THE DATA: the ring count is the tree's depth and the
// satellite count is how many children the root has, so two trees look alike
// exactly when they are alike, and a tree's mark changes as it grows. The angle
// is seeded from the id, so the same tree is drawn the same way forever without
// storing anything.
//
// THE SATELLITES ARE CAPPED AT NINE and the ring is marked `full` past that.
// Nine dots on a 72px circle are 8px apart; a tenth is a smudge. The cap is drawn
// rather than hidden — a full ring says "more than nine" in the same glance.

const TAG_NAME = 'tc-graph-sigil'

const SIZE = 72
const CENTER = SIZE / 2
const RING_RADIUS = 23
const SATELLITE_CAP = 9
const RADIAN = Math.PI / 180

/** A stable angle for a seed. Not a hash for security — a hash for repeatability:
 *  the same graph must be drawn the same way on every device, forever. */
const seedAngle = (seed: string): number => {
    let hash = 0
    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 31 + seed.charCodeAt(index)) % 360
    }
    return hash
}

export class GraphSigil extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        return ['seed', 'ring', 'depth', 'tone', 'size', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** Anything stable and unique — an id, a slug. Decides the rotation. */
    get seed(): string {
        return this.getAttribute('seed') ?? ''
    }
    set seed(v: string) {
        setAttr(this, 'seed', v)
    }

    /** How many children the root has. Drawn as satellites, capped at nine. */
    get ring(): number {
        return Math.max(0, Math.round(num(this.getAttribute('ring'), 0)))
    }
    set ring(v: number) {
        this.setAttribute('ring', String(v))
    }

    /** How deep the tree goes. Drawn as concentric rings, capped at four. */
    get depth(): number {
        return Math.max(0, Math.round(num(this.getAttribute('depth'), 1)))
    }
    set depth(v: number) {
        this.setAttribute('depth', String(v))
    }

    /** The core's colour. A CSS custom property, so a theme owns the palette. */
    get tone(): string | null {
        return this.getAttribute('tone')
    }
    set tone(v: string | null) {
        if (v != null) this.setAttribute('tone', v)
        else this.removeAttribute('tone')
    }

    private patch(): void {
        setHostClass(this, 'tc-graph-sigil')
        // Decorative by construction: everything it says is said again by the title
        // beside it, and a screen reader announcing "circle with nine dots" is
        // noise between a reader and a list of names.
        this.setAttribute('aria-hidden', 'true')
        const tone = this.tone
        if (tone) this.setAttribute('data-tone', tone)
        else this.removeAttribute('data-tone')

        const shown = Math.min(this.ring, SATELLITE_CAP)
        const crowded = this.ring > SATELLITE_CAP
        const start = seedAngle(this.seed)
        const rings = Math.max(1, Math.min(Math.max(this.depth - 1, 0), 3))

        const ringMarkup = Array.from({ length: rings }, (_, index) => {
            const cls = `tc-graph-sigil__ring${crowded ? ' tc-graph-sigil__ring--full' : ''}`
            return `<circle class="${cls}" cx="${CENTER}" cy="${CENTER}" r="${RING_RADIUS - index * 7}"/>`
        }).join('')

        const satellites = Array.from({ length: shown }, (_, index) => {
            const angle = (start + (360 / Math.max(shown, 1)) * index) * RADIAN
            const x = (CENTER + Math.cos(angle) * RING_RADIUS).toFixed(2)
            const y = (CENTER + Math.sin(angle) * RING_RADIUS).toFixed(2)
            return (
                `<line class="tc-graph-sigil__spoke" x1="${CENTER}" y1="${CENTER}" x2="${x}" y2="${y}"/>` +
                `<circle class="tc-graph-sigil__satellite" cx="${x}" cy="${y}" r="3"/>`
            )
        }).join('')

        const svg =
            `<svg class="tc-graph-sigil__svg" viewBox="0 0 ${SIZE} ${SIZE}"` +
            ` aria-hidden="true" focusable="false">` +
            ringMarkup +
            satellites +
            `<circle class="tc-graph-sigil__core" cx="${CENTER}" cy="${CENTER}" r="6"/>` +
            `</svg>`

        // One owned child, replaced only when the drawing actually changes — a list
        // of forty sigils re-rendering on a scroll would be forty SVG rebuilds.
        const existing = this.querySelector<HTMLElement>(':scope > .tc-graph-sigil__svg')
        if (existing?.outerHTML === svg) return
        if (existing) existing.outerHTML = svg
        else this.insertAdjacentHTML('afterbegin', svg)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GraphSigil
    }
}

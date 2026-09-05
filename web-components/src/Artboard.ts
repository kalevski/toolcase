import { setHostClass } from './internal/host-class'
import { num } from './internal/tc-element'

// tc-artboard — a fixed-size surface on a `tc-design-canvas`.
//
// From `DesignArtboard`, shipped by both webgame.cloud and mindmap. The whole
// element is three declarations and one idea: it is the box that has REAL pixel
// dimensions, so everything a consumer draws inside it can be positioned in the
// design's own coordinates and the canvas's scale is the only thing that changes.
//
// IT SCALES ITSELF. `transform: scale(--tc-canvas-scale)` on the host, not on a
// wrapper: a wrapper would mean moving your children into it, and moving a node
// react-dom created is what makes `removeChild` throw. A transform leaves the
// layout box at natural size, which is exactly what the coordinates want.
//
// `tc-artboard-backdrop` (already in this library) is the surrounding wash — the
// two are siblings, not alternatives: the backdrop paints the space AROUND an
// artboard, this element is the artboard.

const TAG_NAME = 'tc-artboard'

export class Artboard extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        return ['width', 'height', 'label', 'selected', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** Natural width in px — the design's own coordinate space. */
    get width(): number {
        return num(this.getAttribute('width'), 0)
    }
    set width(v: number) {
        this.setAttribute('width', String(v))
    }

    /** Natural height in px. */
    get height(): number {
        return num(this.getAttribute('height'), 0)
    }
    set height(v: number) {
        this.setAttribute('height', String(v))
    }

    /** The artboard's name, shown above it. */
    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get selected(): boolean {
        return this.hasAttribute('selected')
    }
    set selected(v: boolean) {
        if (v) this.setAttribute('selected', '')
        else this.removeAttribute('selected')
    }

    private patch(): void {
        setHostClass(this, 'tc-artboard')
        const width = this.width
        const height = this.height
        if (width > 0) this.style.width = `${width}px`
        else this.style.removeProperty('width')
        if (height > 0) this.style.height = `${height}px`
        else this.style.removeProperty('height')
        const label = this.label
        // The name rides on `data-label` and is drawn by a pseudo-element: an extra
        // NODE above the artboard would be inside the scaled box and would shrink
        // with it, which is the one thing a label must not do.
        if (label) this.setAttribute('data-label', label)
        else this.removeAttribute('data-label')
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        if (label) this.setAttribute('aria-label', label)
        else this.removeAttribute('aria-label')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Artboard
    }
}

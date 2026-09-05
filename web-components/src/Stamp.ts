import { VARIANTS_CORE } from './internal/variants'
import { esc } from './internal/esc'
import { setHostClass } from './internal/host-class'
import { setAttr, syncOwnedNodes } from './internal/tc-element'
const TAG_NAME = 'tc-stamp'

// A bare number is treated as degrees; anything with a CSS angle unit is left as-is.
function normalizeAngle(v: string): string {
    const trimmed = v.trim()
    return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(trimmed) ? `${trimmed}deg` : trimmed
}

export type StampColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
export type StampPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const COLORS: StampColor[] = [...VARIANTS_CORE]
const POSITIONS: StampPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

export class Stamp extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['label', 'color', 'position', 'angle']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get color(): StampColor {
        const v = this.getAttribute('color') as StampColor
        return COLORS.includes(v) ? v : 'primary'
    }
    set color(v: StampColor) {
        setAttr(this, 'color', v)
    }

    get position(): StampPosition {
        const v = this.getAttribute('position') as StampPosition
        return POSITIONS.includes(v) ? v : 'top-right'
    }
    set position(v: StampPosition) {
        setAttr(this, 'position', v)
    }

    // Optional per-instance tilt override. A bare number is read as degrees;
    // a value with a unit (deg/rad/turn/grad) is passed through verbatim.
    // When absent, the SCSS default --bs-stamp-rotation (-8deg) applies.
    get angle(): string | null {
        return this.getAttribute('angle')
    }
    set angle(v: string | null) {
        if (v != null) this.setAttribute('angle', v)
        else this.removeAttribute('angle')
    }

    /** THE HOST IS THE STAMP. The `.tc-stamp` classes are re-asserted on the
     *  consumer's own tag and the only node the element creates is the `label`
     *  text — which is prepended, never wrapped around slotted content (rule 1). */
    private render(): void {
        const label = this.getAttribute('label')
        const angle = this.angle

        setHostClass(this, `tc-stamp tc-stamp-${this.color} tc-stamp-${this.position}`)

        if (angle != null) this.style.setProperty('--bs-stamp-rotation', normalizeAngle(angle))
        else this.style.removeProperty('--bs-stamp-rotation')

        // `label` supersedes slotted content; without it the consumer's children
        // are the stamp text and no owned node exists at all.
        syncOwnedNodes(this, [
            { cls: 'tc-stamp-content', tag: 'span', html: label != null ? esc(label) : null },
        ])
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Stamp
    }
}

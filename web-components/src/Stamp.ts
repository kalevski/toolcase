import { VARIANTS_CORE } from './internal/variants'
import { esc } from './internal/esc'
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
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            if (!this.hasAttribute('label')) {
                const inner = this.querySelector('.tc-stamp-content')
                if (inner) slotContent.forEach((n) => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-stamp-content')
        const slotContent = !this.hasAttribute('label') && inner ? Array.from(inner.childNodes) : []
        this.render()
        if (!this.hasAttribute('label')) {
            const newInner = this.querySelector('.tc-stamp-content')
            if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
        }
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
        this.setAttribute('color', v)
    }

    get position(): StampPosition {
        const v = this.getAttribute('position') as StampPosition
        return POSITIONS.includes(v) ? v : 'top-right'
    }
    set position(v: StampPosition) {
        this.setAttribute('position', v)
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

    private render(): void {
        const label = this.getAttribute('label')
        const color = this.color
        const position = this.position
        const angle = this.angle

        const contentHtml = label != null ? esc(label) : ''
        const styleAttr =
            angle != null ? ` style="--bs-stamp-rotation:${esc(normalizeAngle(angle))}"` : ''

        this.innerHTML = `<span class="tc-stamp tc-stamp-${color} tc-stamp-${position}"${styleAttr}><span class="tc-stamp-content">${contentHtml}</span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Stamp
    }
}

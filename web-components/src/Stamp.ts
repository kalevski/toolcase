const TAG_NAME = 'tc-stamp'

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type StampColor = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
export type StampPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const COLORS: StampColor[] = ['primary', 'secondary', 'success', 'danger', 'warning', 'info']
const POSITIONS: StampPosition[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']

export class Stamp extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['label', 'color', 'position']
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
                if (inner) slotContent.forEach(n => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-stamp-content')
        const slotContent = (!this.hasAttribute('label') && inner)
            ? Array.from(inner.childNodes)
            : []
        this.render()
        if (!this.hasAttribute('label')) {
            const newInner = this.querySelector('.tc-stamp-content')
            if (newInner) slotContent.forEach(n => newInner.appendChild(n))
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

    private render(): void {
        const label = this.getAttribute('label')
        const color = this.color
        const position = this.position

        const contentHtml = label != null ? esc(label) : ''

        this.innerHTML = `<span class="tc-stamp tc-stamp-${color} tc-stamp-${position}"><span class="tc-stamp-content">${contentHtml}</span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Stamp
    }
}

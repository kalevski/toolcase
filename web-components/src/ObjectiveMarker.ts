import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-objective-marker'

// Pre-computed at module level — always rendered, never conditional.
const mapPinIconHtml = lucideByName('map-pin')

function formatDistance(d: number): string {
    if (d >= 1000) return `${(d / 1000).toFixed(1)}km`
    return `${Math.round(d)}m`
}

export class ObjectiveMarker extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['x', 'y', 'label', 'distance', 'color', 'size', 'pulse']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    private numberAttr(name: string): number | null {
        const raw = this.getAttribute(name)
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }

    get x(): number | null {
        return this.numberAttr('x')
    }
    set x(v: number | null) {
        if (v == null) this.removeAttribute('x')
        else this.setAttribute('x', String(v))
    }

    get y(): number | null {
        return this.numberAttr('y')
    }
    set y(v: number | null) {
        if (v == null) this.removeAttribute('y')
        else this.setAttribute('y', String(v))
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        if (v) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get distance(): number | null {
        return this.numberAttr('distance')
    }
    set distance(v: number | null) {
        if (v == null) this.removeAttribute('distance')
        else this.setAttribute('distance', String(v))
    }

    get color(): string {
        return this.getAttribute('color') ?? ''
    }
    set color(v: string) {
        if (v) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get size(): number | null {
        return this.numberAttr('size')
    }
    set size(v: number | null) {
        if (v == null) this.removeAttribute('size')
        else this.setAttribute('size', String(v))
    }

    get pulse(): boolean {
        return this.hasAttribute('pulse')
    }
    set pulse(v: boolean) {
        if (v) this.setAttribute('pulse', '')
        else this.removeAttribute('pulse')
    }

    private render(): void {
        const x = this.x
        const y = this.y
        const size = this.size
        const color = this.color

        if (x != null) this.style.left = `${x}px`
        else this.style.removeProperty('left')
        if (y != null) this.style.top = `${y}px`
        else this.style.removeProperty('top')
        if (size != null) this.style.setProperty('--bs-objective-marker-size', `${size}px`)
        else this.style.removeProperty('--bs-objective-marker-size')
        if (color) this.style.setProperty('--bs-objective-marker-color', color)
        else this.style.removeProperty('--bs-objective-marker-color')

        this.classList.add('tc-objective-marker')

        const label = this.label
        const distance = this.distance

        const distanceMarkup =
            distance != null
                ? `<span class="tc-objective-marker__distance">${esc(formatDistance(distance))}</span>`
                : ''
        const textMarkup =
            label || distance != null
                ? `<div class="tc-objective-marker__text">
                   ${label ? `<span class="tc-objective-marker__label">${esc(label)}</span>` : ''}
                   ${distanceMarkup}
               </div>`
                : ''

        patchHtml(
            this,
            `
            <div class="tc-objective-marker__glyph" aria-hidden="true">
                ${mapPinIconHtml}
            </div>
            ${textMarkup}
        `,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ObjectiveMarker
    }
}

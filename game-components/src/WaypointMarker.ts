const TAG_NAME = 'gc-waypoint-marker'

export class WaypointMarker extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['x', 'y', 'label', 'distance', 'color', 'icon', 'size']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    private numberAttr(name: string, fallback: number | null): number | null {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    get x(): number | null { return this.numberAttr('x', null) }
    set x(v: number | null) {
        if (v == null) this.removeAttribute('x')
        else this.setAttribute('x', String(v))
    }

    get y(): number | null { return this.numberAttr('y', null) }
    set y(v: number | null) {
        if (v == null) this.removeAttribute('y')
        else this.setAttribute('y', String(v))
    }

    get label(): string { return this.getAttribute('label') ?? '' }
    set label(v: string) {
        if (v) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get distance(): number | null { return this.numberAttr('distance', null) }
    set distance(v: number | null) {
        if (v == null) this.removeAttribute('distance')
        else this.setAttribute('distance', String(v))
    }

    get color(): string { return this.getAttribute('color') ?? '' }
    set color(v: string) {
        if (v) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get icon(): string { return this.getAttribute('icon') ?? '' }
    set icon(v: string) {
        if (v) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get size(): number | null { return this.numberAttr('size', null) }
    set size(v: number | null) {
        if (v == null) this.removeAttribute('size')
        else this.setAttribute('size', String(v))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private formatDistance(d: number): string {
        if (d >= 1000) return `${(d / 1000).toFixed(1)}km`
        return `${Math.round(d)}m`
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
        if (size != null) this.style.setProperty('--gc-waypoint-marker-size', `${size}px`)
        else this.style.removeProperty('--gc-waypoint-marker-size')
        if (color) this.style.setProperty('--gc-waypoint-marker-color', color)
        else this.style.removeProperty('--gc-waypoint-marker-color')

        const icon = this.icon || '✦'
        const label = this.label
        const distance = this.distance
        const distanceMarkup = distance != null
            ? `<span class="gc-waypoint-marker-distance">${this.formatDistance(distance)}</span>`
            : ''
        const labelMarkup = label
            ? `<span class="gc-waypoint-marker-label">${this.escape(label)}</span>`
            : ''

        this.innerHTML = `
            <div class="gc-waypoint-marker-glyph">${this.escape(icon)}</div>
            <div class="gc-waypoint-marker-text">
                ${labelMarkup}
                ${distanceMarkup}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: WaypointMarker
    }
}

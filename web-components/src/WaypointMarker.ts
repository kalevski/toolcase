import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-waypoint-marker'
const DEFAULT_ICON = 'navigation'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

function formatDistance(d: number): string {
    if (d >= 1000) return `${(d / 1000).toFixed(1)}km`
    return `${Math.round(d)}m`
}

export class WaypointMarker extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['x', 'y', 'label', 'distance', 'color', 'icon', 'size']
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

    get x(): number | null { return this.numberAttr('x') }
    set x(v: number | null) {
        if (v == null) this.removeAttribute('x')
        else this.setAttribute('x', String(v))
    }

    get y(): number | null { return this.numberAttr('y') }
    set y(v: number | null) {
        if (v == null) this.removeAttribute('y')
        else this.setAttribute('y', String(v))
    }

    get label(): string { return this.getAttribute('label') ?? '' }
    set label(v: string) {
        if (v) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get distance(): number | null { return this.numberAttr('distance') }
    set distance(v: number | null) {
        if (v == null) this.removeAttribute('distance')
        else this.setAttribute('distance', String(v))
    }

    get color(): string { return this.getAttribute('color') ?? '' }
    set color(v: string) {
        if (v) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    // Lucide icon name (kebab-case). Defaults to 'navigation' when absent.
    // Note: HTMLElement does not define a native `icon` property so no collision.
    get icon(): string { return this.getAttribute('icon') ?? '' }
    set icon(v: string) {
        if (v) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get size(): number | null { return this.numberAttr('size') }
    set size(v: number | null) {
        if (v == null) this.removeAttribute('size')
        else this.setAttribute('size', String(v))
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
        if (size != null) this.style.setProperty('--bs-waypoint-marker-size', `${size}px`)
        else this.style.removeProperty('--bs-waypoint-marker-size')
        if (color) this.style.setProperty('--bs-waypoint-marker-color', color)
        else this.style.removeProperty('--bs-waypoint-marker-color')

        this.classList.add('tc-waypoint-marker')

        const iconName = this.icon || DEFAULT_ICON
        const iconHtml = lucideByName(iconName)
        const label = this.label
        const distance = this.distance

        const distanceMarkup = distance != null
            ? `<span class="tc-waypoint-marker__distance">${esc(formatDistance(distance))}</span>`
            : ''
        const textMarkup = (label || distance != null)
            ? `<div class="tc-waypoint-marker__text">
                   ${label ? `<span class="tc-waypoint-marker__label">${esc(label)}</span>` : ''}
                   ${distanceMarkup}
               </div>`
            : ''

        this.innerHTML = `
            <div class="tc-waypoint-marker__glyph" aria-hidden="true">
                ${iconHtml}
            </div>
            ${textMarkup}
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: WaypointMarker
    }
}

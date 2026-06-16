const TAG_NAME = 'tc-compass-bar'

export interface CompassMarker {
    id: string
    heading: number
    color?: string
    label?: string
    icon?: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

export class CompassBar extends HTMLElement {
    private _initialised = false
    private _markers: CompassMarker[] = []

    static get observedAttributes(): string[] {
        return ['heading', 'fov', 'width', 'height', 'show-cardinals']
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

    get heading(): number {
        const raw = this.getAttribute('heading')
        const parsed = raw == null ? 0 : parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : 0
    }
    set heading(v: number) {
        this.setAttribute('heading', String(v))
    }

    get fov(): number {
        const raw = this.getAttribute('fov')
        const parsed = raw == null ? 90 : parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 90
    }
    set fov(v: number) {
        this.setAttribute('fov', String(v))
    }

    get width(): number | null {
        const raw = this.getAttribute('width')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set width(v: number | null) {
        if (v == null) this.removeAttribute('width')
        else this.setAttribute('width', String(v))
    }

    get height(): number | null {
        const raw = this.getAttribute('height')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set height(v: number | null) {
        if (v == null) this.removeAttribute('height')
        else this.setAttribute('height', String(v))
    }

    get showCardinals(): boolean {
        return this.hasAttribute('show-cardinals')
    }
    set showCardinals(v: boolean) {
        if (v) this.setAttribute('show-cardinals', '')
        else this.removeAttribute('show-cardinals')
    }

    get markers(): CompassMarker[] {
        return this._markers.slice()
    }
    set markers(value: CompassMarker[]) {
        this._markers = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private normalizeDeg(deg: number): number {
        let d = deg % 360
        if (d < 0) d += 360
        return d
    }

    // Returns the marker's normalised offset within the field of view as a value
    // in [-1, 1] (0 = dead centre), or null when it falls outside the FOV window.
    private offsetWithinFOV(target: number, heading: number, fov: number): number | null {
        let delta = this.normalizeDeg(target) - this.normalizeDeg(heading)
        if (delta > 180) delta -= 360
        if (delta < -180) delta += 360
        if (Math.abs(delta) > fov / 2) return null
        return delta / (fov / 2)
    }

    private render(): void {
        const width = this.width
        const height = this.height
        if (width != null) this.style.setProperty('--bs-compass-bar-width', `${width}px`)
        else this.style.removeProperty('--bs-compass-bar-width')
        if (height != null) this.style.setProperty('--bs-compass-bar-height', `${height}px`)
        else this.style.removeProperty('--bs-compass-bar-height')

        const heading = this.heading
        const fov = this.fov
        const showCardinals = this.showCardinals

        const cardinals = [
            { heading: 0, label: 'N' },
            { heading: 45, label: 'NE' },
            { heading: 90, label: 'E' },
            { heading: 135, label: 'SE' },
            { heading: 180, label: 'S' },
            { heading: 225, label: 'SW' },
            { heading: 270, label: 'W' },
            { heading: 315, label: 'NW' }
        ]
        const cardinalsMarkup = showCardinals
            ? cardinals.map((c) => {
                const t = this.offsetWithinFOV(c.heading, heading, fov)
                if (t == null) return ''
                const pct = (t * 0.5 + 0.5) * 100
                return `<span class="tc-compass-bar__cardinal" aria-hidden="true" style="left:${pct.toFixed(2)}%;">${c.label}</span>`
            }).join('')
            : ''

        const markerMarkup = this._markers.map((m) => {
            const t = this.offsetWithinFOV(m.heading, heading, fov)
            if (t == null) return ''
            const pct = (t * 0.5 + 0.5) * 100
            const color = m.color ? esc(m.color) : ''
            const styleAttr = `left:${pct.toFixed(2)}%;${color ? `--bs-compass-bar-marker-color:${color};` : ''}`
            const hasGlyph = !!m.icon
            const glyphMarkup = hasGlyph
                ? `<span class="tc-compass-bar__marker-glyph">${esc(m.icon as string)}</span>`
                : ''
            const labelMarkup = m.label
                ? `<span class="tc-compass-bar__marker-label">${esc(m.label)}</span>`
                : ''
            const markerClass = hasGlyph
                ? 'tc-compass-bar__marker tc-compass-bar__marker--glyph'
                : 'tc-compass-bar__marker'
            return `<span class="${markerClass}" data-id="${esc(m.id)}" style="${styleAttr}"><span class="tc-compass-bar__marker-tick" aria-hidden="true"></span>${glyphMarkup}${labelMarkup}</span>`
        }).join('')

        const normalized = Math.round(this.normalizeDeg(heading))
        const headingLabel = normalized.toString().padStart(3, '0')

        this.classList.add('tc-compass-bar')
        this.setAttribute('role', 'img')
        this.setAttribute('aria-label', `Compass — heading ${headingLabel}°`)

        this.innerHTML = `
            <div class="tc-compass-bar__track">
                ${cardinalsMarkup}
                ${markerMarkup}
                <span class="tc-compass-bar__center" aria-hidden="true"></span>
                <span class="tc-compass-bar__pointer" aria-hidden="true"></span>
            </div>
            <span class="tc-compass-bar__heading">${headingLabel}°</span>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CompassBar
    }
}

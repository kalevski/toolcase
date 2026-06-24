import { esc } from './internal/esc'
const TAG_NAME = 'tc-minimap'

export interface MinimapMarker {
    id: string
    x: number
    y: number
    color?: string
    size?: number
}

export class Minimap extends HTMLElement {
    private _initialised = false
    private _markers: MinimapMarker[] = []

    static get observedAttributes(): string[] {
        return [
            'world-x',
            'world-y',
            'world-width',
            'world-height',
            'background-image',
            'size',
            'rotation',
        ]
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

    private numberAttr(name: string, fallback: number): number {
        const raw = this.getAttribute(name)
        if (raw === null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    get worldX(): number {
        return this.numberAttr('world-x', 0)
    }
    set worldX(v: number) {
        this.setAttribute('world-x', String(v))
    }

    get worldY(): number {
        return this.numberAttr('world-y', 0)
    }
    set worldY(v: number) {
        this.setAttribute('world-y', String(v))
    }

    get worldWidth(): number {
        return this.numberAttr('world-width', 100)
    }
    set worldWidth(v: number) {
        this.setAttribute('world-width', String(v))
    }

    get worldHeight(): number {
        return this.numberAttr('world-height', 100)
    }
    set worldHeight(v: number) {
        this.setAttribute('world-height', String(v))
    }

    get backgroundImage(): string {
        return this.getAttribute('background-image') ?? ''
    }
    set backgroundImage(v: string) {
        if (v) this.setAttribute('background-image', v)
        else this.removeAttribute('background-image')
    }

    get size(): number | null {
        const raw = this.getAttribute('size')
        if (raw === null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set size(v: number | null) {
        if (v === null) this.removeAttribute('size')
        else this.setAttribute('size', String(v))
    }

    get rotation(): number {
        return this.numberAttr('rotation', 0)
    }
    set rotation(v: number) {
        this.setAttribute('rotation', String(v))
    }

    get markers(): MinimapMarker[] {
        return this._markers.slice()
    }
    set markers(value: MinimapMarker[]) {
        this._markers = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const size = this.size
        if (size !== null) this.style.setProperty('--bs-minimap-size', `${size}px`)
        else this.style.removeProperty('--bs-minimap-size')

        const bg = this.backgroundImage
        if (bg) this.style.setProperty('--bs-minimap-bg-image', `url(${esc(bg)})`)
        else this.style.removeProperty('--bs-minimap-bg-image')

        const wx = this.worldX
        const wy = this.worldY
        const ww = Math.max(1, this.worldWidth)
        const wh = Math.max(1, this.worldHeight)
        const rotation = this.rotation

        const markersMarkup = this._markers
            .map((m) => {
                const px = ((m.x - wx) / ww) * 100
                const py = ((m.y - wy) / wh) * 100
                if (px < 0 || px > 100 || py < 0 || py > 100) return ''
                const colorProp = m.color ? `--bs-minimap-marker-color:${esc(m.color)};` : ''
                const sizeProp = m.size ? `--bs-minimap-marker-size:${m.size}px;` : ''
                return `<span class="tc-minimap__marker" data-id="${esc(m.id)}" role="img" aria-label="Marker ${esc(m.id)}" style="left:${px.toFixed(2)}%;top:${py.toFixed(2)}%;${colorProp}${sizeProp}"></span>`
            })
            .join('')

        const markerCount = this._markers.length
        const ariaLabel =
            markerCount === 0
                ? 'Minimap — no markers'
                : `Minimap — ${markerCount} marker${markerCount !== 1 ? 's' : ''}`

        this.classList.add('tc-minimap')
        this.setAttribute('role', 'img')
        this.setAttribute('aria-label', ariaLabel)

        this.innerHTML = `
            <div class="tc-minimap__surface" style="transform:rotate(${(-rotation).toFixed(2)}deg);">
                <div class="tc-minimap__bg" aria-hidden="true"></div>
                ${markersMarkup}
            </div>
            <div class="tc-minimap__player" aria-hidden="true"></div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Minimap
    }
}

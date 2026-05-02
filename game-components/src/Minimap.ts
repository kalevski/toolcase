const TAG_NAME = 'gc-minimap'

export interface MinimapMarker {
    id: string
    x: number
    y: number
    color?: string
    size?: number
}

export class Minimap extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['world-x', 'world-y', 'world-width', 'world-height', 'background-image', 'size', 'rotation']
    }

    private _markers: MinimapMarker[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    private numberAttr(name: string, fallback: number): number {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    get worldX(): number { return this.numberAttr('world-x', 0) }
    set worldX(v: number) { this.setAttribute('world-x', String(v)) }

    get worldY(): number { return this.numberAttr('world-y', 0) }
    set worldY(v: number) { this.setAttribute('world-y', String(v)) }

    get worldWidth(): number { return this.numberAttr('world-width', 100) }
    set worldWidth(v: number) { this.setAttribute('world-width', String(v)) }

    get worldHeight(): number { return this.numberAttr('world-height', 100) }
    set worldHeight(v: number) { this.setAttribute('world-height', String(v)) }

    get backgroundImage(): string {
        return this.getAttribute('background-image') ?? ''
    }
    set backgroundImage(v: string) {
        if (v) this.setAttribute('background-image', v)
        else this.removeAttribute('background-image')
    }

    get size(): number | null {
        const raw = this.getAttribute('size')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set size(v: number | null) {
        if (v == null) this.removeAttribute('size')
        else this.setAttribute('size', String(v))
    }

    get rotation(): number { return this.numberAttr('rotation', 0) }
    set rotation(v: number) { this.setAttribute('rotation', String(v)) }

    get markers(): MinimapMarker[] {
        return this._markers.slice()
    }
    set markers(value: MinimapMarker[]) {
        this._markers = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const size = this.size
        if (size != null) this.style.setProperty('--gc-minimap-size', `${size}px`)
        else this.style.removeProperty('--gc-minimap-size')

        const bg = this.backgroundImage
        if (bg) this.style.setProperty('--gc-minimap-bg', `url(${this.escape(bg)})`)
        else this.style.removeProperty('--gc-minimap-bg')

        const wx = this.worldX
        const wy = this.worldY
        const ww = Math.max(1, this.worldWidth)
        const wh = Math.max(1, this.worldHeight)
        const rotation = this.rotation

        const markersMarkup = this._markers.map((m) => {
            const px = ((m.x - wx) / ww) * 100
            const py = ((m.y - wy) / wh) * 100
            if (px < 0 || px > 100 || py < 0 || py > 100) return ''
            const color = m.color ? `--gc-minimap-marker-color:${this.escape(m.color)};` : ''
            const sizeStyle = m.size ? `--gc-minimap-marker-size:${m.size}px;` : ''
            return `<span class="gc-minimap-marker" data-id="${this.escape(m.id)}" style="left:${px.toFixed(2)}%;top:${py.toFixed(2)}%;${color}${sizeStyle}"></span>`
        }).join('')

        this.innerHTML = `
            <div class="gc-minimap-frame">
                <div class="gc-minimap-surface" style="transform: rotate(${(-rotation).toFixed(2)}deg);">
                    <div class="gc-minimap-bg"></div>
                    ${markersMarkup}
                </div>
                <div class="gc-minimap-player">◆</div>
                <span class="gc-minimap-corner gc-minimap-corner-tl"></span>
                <span class="gc-minimap-corner gc-minimap-corner-tr"></span>
                <span class="gc-minimap-corner gc-minimap-corner-bl"></span>
                <span class="gc-minimap-corner gc-minimap-corner-br"></span>
            </div>
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Minimap)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Minimap
    }
}

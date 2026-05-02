const TAG_NAME = 'gc-debug-overlay'

export interface DebugRow {
    label: string
    value: string | number
}

export class DebugOverlay extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['fps', 'draw-calls', 'triangles', 'mem-mb']
    }

    private _rows: DebugRow[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get fps(): number | null {
        return this.parseNumeric('fps')
    }
    set fps(v: number | null) {
        this.writeNumeric('fps', v)
    }

    get drawCalls(): number | null {
        return this.parseNumeric('draw-calls')
    }
    set drawCalls(v: number | null) {
        this.writeNumeric('draw-calls', v)
    }

    get triangles(): number | null {
        return this.parseNumeric('triangles')
    }
    set triangles(v: number | null) {
        this.writeNumeric('triangles', v)
    }

    get memMb(): number | null {
        return this.parseNumeric('mem-mb')
    }
    set memMb(v: number | null) {
        this.writeNumeric('mem-mb', v)
    }

    get rows(): DebugRow[] {
        return this._rows.slice()
    }
    set rows(v: DebugRow[]) {
        this._rows = Array.isArray(v) ? v.slice() : []
        if (this.isConnected) this.render()
    }

    private parseNumeric(attr: string): number | null {
        const raw = this.getAttribute(attr)
        if (raw == null || raw === '') return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }

    private writeNumeric(attr: string, v: number | null): void {
        if (v == null) this.removeAttribute(attr)
        else this.setAttribute(attr, String(v))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private fpsClass(fps: number): string {
        if (fps >= 55) return 'is-good'
        if (fps >= 30) return 'is-warning'
        return 'is-danger'
    }

    private formatNumber(value: number): string {
        return Math.round(value).toLocaleString()
    }

    private render(): void {
        const fps = this.fps
        const drawCalls = this.drawCalls
        const triangles = this.triangles
        const memMb = this.memMb

        const builtInRows: string[] = []
        if (fps != null) {
            builtInRows.push(`<div class="gc-debug-overlay-row gc-debug-overlay-fps ${this.fpsClass(fps)}"><span class="gc-debug-overlay-label">FPS</span><span class="gc-debug-overlay-value">${this.formatNumber(fps)}</span></div>`)
        }
        if (drawCalls != null) {
            builtInRows.push(`<div class="gc-debug-overlay-row"><span class="gc-debug-overlay-label">Draw</span><span class="gc-debug-overlay-value">${this.formatNumber(drawCalls)}</span></div>`)
        }
        if (triangles != null) {
            builtInRows.push(`<div class="gc-debug-overlay-row"><span class="gc-debug-overlay-label">Tris</span><span class="gc-debug-overlay-value">${this.formatNumber(triangles)}</span></div>`)
        }
        if (memMb != null) {
            builtInRows.push(`<div class="gc-debug-overlay-row"><span class="gc-debug-overlay-label">Mem</span><span class="gc-debug-overlay-value">${this.formatNumber(memMb)} MB</span></div>`)
        }

        const customRows = this._rows.map((row) => {
            const value = typeof row.value === 'number' ? this.formatNumber(row.value) : String(row.value)
            return `<div class="gc-debug-overlay-row"><span class="gc-debug-overlay-label">${this.escape(row.label)}</span><span class="gc-debug-overlay-value">${this.escape(value)}</span></div>`
        }).join('')

        this.innerHTML = `<div class="gc-debug-overlay-panel">${builtInRows.join('')}${customRows}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DebugOverlay
    }
}

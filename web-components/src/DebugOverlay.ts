const TAG_NAME = 'tc-debug-overlay'

export interface DebugRow {
    label: string
    value: string | number
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function formatNumber(value: number): string {
    return Math.round(value).toLocaleString()
}

// FPS thresholds mirror the game-components source: ≥55 healthy, ≥30 marginal,
// below that a problem. The status maps onto the standard slate/status palette.
function fpsClass(fps: number): string {
    if (fps >= 55) return 'tc-debug-overlay-fps--good'
    if (fps >= 30) return 'tc-debug-overlay-fps--warning'
    return 'tc-debug-overlay-fps--danger'
}

export class DebugOverlay extends HTMLElement {
    private _initialised = false
    private _rows: DebugRow[] = []

    static get observedAttributes(): string[] {
        return ['fps', 'draw-calls', 'triangles', 'mem-mb']
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
        if (this._initialised) this.render()
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

    private render(): void {
        const fps = this.fps
        const drawCalls = this.drawCalls
        const triangles = this.triangles
        const memMb = this.memMb

        const row = (label: string, value: string, mod = ''): string =>
            `<div class="tc-debug-overlay-row${mod}">` +
            `<span class="tc-debug-overlay-label">${label}</span>` +
            `<span class="tc-debug-overlay-value">${value}</span>` +
            `</div>`

        const builtInRows: string[] = []
        if (fps != null) {
            builtInRows.push(
                row('FPS', formatNumber(fps), ` tc-debug-overlay-fps ${fpsClass(fps)}`)
            )
        }
        if (drawCalls != null) {
            builtInRows.push(row('Draw', formatNumber(drawCalls)))
        }
        if (triangles != null) {
            builtInRows.push(row('Tris', formatNumber(triangles)))
        }
        if (memMb != null) {
            builtInRows.push(row('Mem', `${formatNumber(memMb)} MB`))
        }

        const customRows = this._rows
            .map(r => {
                const value =
                    typeof r.value === 'number' ? formatNumber(r.value) : String(r.value)
                return row(esc(r.label), esc(value))
            })
            .join('')

        this.innerHTML = `<div class="tc-debug-overlay-panel">${builtInRows.join('')}${customRows}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DebugOverlay
    }
}

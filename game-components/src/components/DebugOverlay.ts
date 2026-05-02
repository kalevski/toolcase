import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/DebugOverlay.styles.js'

@customElement('gc-debug-overlay')
export class DebugOverlay extends GameElement {
    static styles = styles

    @property({ type: Number }) fps: number | null = null
    @property({ type: Number, attribute: 'draw-calls' }) drawCalls: number | null = null
    @property({ type: Number }) triangles: number | null = null
    @property({ type: Number, attribute: 'mem-mb' }) memMb: number | null = null
    @property({ type: Array }) rows: Array<{ label: string; value: string }> = []

    render() {
        const rows: Array<{ label: string; value: string; color?: string }> = []
        if (this.fps !== null) {
            const c = this.fps >= 55 ? 'var(--gc-success)' : this.fps >= 30 ? 'var(--gc-warning)' : 'var(--gc-danger)'
            rows.push({ label: 'FPS', value: this.fps.toFixed(0), color: c })
        }
        if (this.drawCalls !== null) rows.push({ label: 'Draw calls', value: String(this.drawCalls) })
        if (this.triangles !== null) rows.push({ label: 'Triangles', value: this.triangles.toLocaleString() })
        if (this.memMb !== null) rows.push({ label: 'Memory', value: `${this.memMb.toFixed(1)} MB` })
        rows.push(...this.rows)
        return html`${rows.map((row) => html`<div class="row" style=${row.color ? `color: ${row.color}` : ''}>
            <span class="label">${row.label}</span><span>${row.value}</span>
        </div>`)}`
    }
}

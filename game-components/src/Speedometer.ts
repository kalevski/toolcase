const TAG_NAME = 'gc-speedometer'

export class Speedometer extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['value', 'max', 'rpm', 'unit', 'gear', 'size']
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

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get max(): number {
        const raw = this.getAttribute('max')
        if (raw == null) return 220
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 220 : parsed
    }
    set max(v: number) {
        this.setAttribute('max', String(v))
    }

    get rpm(): number | null {
        const raw = this.getAttribute('rpm')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? null : parsed
    }
    set rpm(v: number | null) {
        if (v == null) this.removeAttribute('rpm')
        else this.setAttribute('rpm', String(v))
    }

    get unit(): string {
        return this.getAttribute('unit') ?? 'KM/H'
    }
    set unit(v: string) {
        this.setAttribute('unit', v)
    }

    get gear(): string {
        return this.getAttribute('gear') ?? ''
    }
    set gear(v: string) {
        this.setAttribute('gear', v)
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 160
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 160 : parsed
    }
    set size(v: number) {
        this.setAttribute('size', String(v))
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
        this.style.setProperty('--gc-speedo-size', `${size}px`)

        const value = this.value
        const max = this.max
        const pct = Math.max(0, Math.min(1, value / max))
        const danger = pct >= 0.85
        this.dataset.danger = String(danger)

        const rpm = this.rpm
        const unit = this.unit
        const gear = this.gear

        const radius = 0.45
        const stroke = 0.08
        const total = Math.PI
        const cx = 50
        const cy = 60
        const start = { x: cx + radius * 100 * Math.cos(Math.PI), y: cy + radius * 100 * Math.sin(Math.PI) }
        const end = { x: cx + radius * 100 * Math.cos(0), y: cy + radius * 100 * Math.sin(0) }
        const trackPath = `M ${start.x} ${start.y} A ${radius * 100} ${radius * 100} 0 0 1 ${end.x} ${end.y}`

        const fillEndAngle = Math.PI - total * pct
        const fillEnd = { x: cx + radius * 100 * Math.cos(fillEndAngle), y: cy + radius * 100 * Math.sin(fillEndAngle) }
        const fillPath = `M ${start.x} ${start.y} A ${radius * 100} ${radius * 100} 0 0 1 ${fillEnd.x} ${fillEnd.y}`

        const ticks = Array.from({ length: 9 }, (_, i) => {
            const t = i / 8
            const angle = Math.PI - total * t
            const r1 = radius * 100
            const r2 = (radius - 0.05) * 100
            const x1 = cx + r1 * Math.cos(angle)
            const y1 = cy + r1 * Math.sin(angle)
            const x2 = cx + r2 * Math.cos(angle)
            const y2 = cy + r2 * Math.sin(angle)
            return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" class="gc-speedometer-tick" />`
        }).join('')

        const rpmRow = rpm != null
            ? `<div class="gc-speedometer-rpm">${Math.round(rpm)} RPM</div>`
            : ''

        const gearRow = gear
            ? `<div class="gc-speedometer-gear">${this.escape(gear)}</div>`
            : ''

        this.innerHTML = `
            <svg class="gc-speedometer-svg" viewBox="0 0 100 70" aria-hidden="true">
                <path d="${trackPath}" class="gc-speedometer-track" stroke-width="${stroke * 100}" />
                <path d="${fillPath}" class="gc-speedometer-fill" stroke-width="${stroke * 100}" />
                ${ticks}
            </svg>
            <div class="gc-speedometer-readout">
                ${gearRow}
                <div class="gc-speedometer-value">${Math.round(value)}</div>
                <div class="gc-speedometer-unit">${this.escape(unit)}</div>
                ${rpmRow}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Speedometer
    }
}

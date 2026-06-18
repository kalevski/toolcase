const TAG_NAME = 'tc-speedometer'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class Speedometer extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['value', 'max', 'rpm', 'unit', 'gear', 'size']
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

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set value(v: number) { this.setAttribute('value', String(v)) }

    get max(): number {
        const raw = this.getAttribute('max')
        if (raw == null) return 220
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 220 : parsed
    }
    set max(v: number) { this.setAttribute('max', String(v)) }

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
    set unit(v: string) { this.setAttribute('unit', v) }

    get gear(): string {
        return this.getAttribute('gear') ?? ''
    }
    set gear(v: string) {
        if (v) this.setAttribute('gear', v)
        else this.removeAttribute('gear')
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 160
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 160 : parsed
    }
    set size(v: number) { this.setAttribute('size', String(v)) }

    private render(): void {
        const value = this.value
        const max = this.max
        const pct = Math.max(0, Math.min(1, value / max))
        const danger = pct >= 0.85

        this.classList.add('tc-speedometer')
        this.dataset.danger = String(danger)

        const size = this.size
        this.style.setProperty('--bs-speedometer-size', `${size}px`)
        // Scale value font size proportionally to the gauge diameter.
        this.style.setProperty('--bs-speedometer-value-font-size', `${Math.max(Math.round(size * 0.2), 14)}px`)
        this.style.setProperty('--bs-speedometer-gear-font-size', `${Math.max(Math.round(size * 0.125), 11)}px`)

        const rpm = this.rpm
        const unit = this.unit
        const gear = this.gear

        // SVG geometry: semicircle arc opening upward.
        // viewBox="0 0 100 70", arc centre at (50,60), radius=45.
        // The arc sweeps counterclockwise (sweep=0) from (5,60) through (50,15) to (95,60)
        // so it opens upward and stays inside the viewBox.
        // SANCTIONED CIRCLES: the arc track and fill are genuinely circular shapes.
        const r = 45
        const cx = 50
        const cy = 60
        const sw = 7 // stroke-width in viewBox units

        const trackPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`

        // Fill arc sweeps from the left end counterclockwise to the speed endpoint.
        // Angle parametrization: fillX = cx - r*cos(PI*pct), fillY = cy - r*sin(PI*pct)
        // gives positions on the upper semicircle as pct goes from 0 (left) to 1 (right).
        let fillPathHtml = ''
        if (pct > 0.001) {
            const fillX = (cx - r * Math.cos(Math.PI * pct)).toFixed(2)
            const fillY = (cy - r * Math.sin(Math.PI * pct)).toFixed(2)
            fillPathHtml = `<path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${fillX} ${fillY}" class="tc-speedometer__fill" stroke-width="${sw}" fill="none" stroke-linecap="round" />`
        }

        // 9 tick marks at equal intervals along the arc.
        const ticks = Array.from({ length: 9 }, (_, i) => {
            const t = i / 8
            const c = Math.cos(Math.PI * t)
            const s = Math.sin(Math.PI * t)
            const x1 = (cx - r * c).toFixed(2)
            const y1 = (cy - r * s).toFixed(2)
            const x2 = (cx - (r - 5) * c).toFixed(2)
            const y2 = (cy - (r - 5) * s).toFixed(2)
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="tc-speedometer__tick" />`
        }).join('')

        const gearHtml = gear
            ? `<div class="tc-speedometer__gear">${esc(gear)}</div>`
            : ''

        const rpmHtml = rpm != null
            ? `<div class="tc-speedometer__rpm">${Math.round(rpm)} RPM</div>`
            : ''

        const ariaLabel = `${Math.round(value)} ${esc(unit)}${rpm != null ? `, ${Math.round(rpm)} RPM` : ''}${gear ? `, gear ${esc(gear)}` : ''}`

        this.innerHTML = `<svg class="tc-speedometer__arc" viewBox="0 0 100 70" aria-hidden="true">
    <path d="${trackPath}" class="tc-speedometer__track" stroke-width="${sw}" fill="none" stroke-linecap="round" />
    ${fillPathHtml}
    ${ticks}
</svg>
<div class="tc-speedometer__readout" role="img" aria-label="${ariaLabel}">
    ${gearHtml}
    <div class="tc-speedometer__value">${Math.round(value)}</div>
    <div class="tc-speedometer__unit">${esc(unit)}</div>
    ${rpmHtml}
</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Speedometer
    }
}

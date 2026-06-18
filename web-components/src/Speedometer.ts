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

        // SVG geometry: a 180° gauge arc opening upward (a half-circle "bowl").
        //
        // The viewBox is sized to *tightly* bound the stroked arc so the gauge is
        // centred with no dead band: the arc centre sits at (cx, cy); the arc
        // spans the upper semicircle from the left endpoint (cx-r, cy) through the
        // apex (cx, cy-r) to the right endpoint (cx+r, cy). The stroke extends
        // sw/2 beyond the path on every side, so the visual bounds are:
        //   x: [cx-r-sw/2, cx+r+sw/2]   y: [cy-r-sw/2, cy+sw/2]
        // We pick a 4-unit margin on each side and derive the box from that, which
        // keeps the arc horizontally and vertically centred in the SVG.
        // SANCTIONED CIRCLES: the arc track, fill, and hub are genuinely circular.
        const r = 42
        const sw = 8 // stroke-width in viewBox units
        const m = 4 // uniform margin around the stroked arc
        const cx = r + sw / 2 + m // 50
        const cy = r + sw / 2 + m // 50 (apex sits m below the top edge)
        const vbW = 2 * cx // 100
        const vbH = cy + sw / 2 + m // 58 (centre + endpoint stroke + bottom margin)

        // Angle parametrisation for the upper semicircle: pct 0 → left endpoint
        // (angle π), pct 1 → right endpoint (angle 0). A point on the arc is
        // (cx - r·cos(πt), cy - r·sin(πt)), which traces the *top* half (y < cy).
        // In SVG's y-down space, going from the left endpoint to a top-arc point
        // needs sweep-flag 0 (the short way, up and over the top).
        const arcPoint = (t: number): [number, number] => [
            cx - r * Math.cos(Math.PI * t),
            cy - r * Math.sin(Math.PI * t),
        ]

        const [trackEndX, trackEndY] = arcPoint(1)
        const trackPath = `M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} A ${r} ${r} 0 0 0 ${trackEndX.toFixed(2)} ${trackEndY.toFixed(2)}`

        // Fill arc sweeps from the left endpoint along the top to the value point.
        let fillPathHtml = ''
        if (pct > 0.001) {
            const [fillX, fillY] = arcPoint(pct)
            fillPathHtml = `<path d="M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} A ${r} ${r} 0 0 0 ${fillX.toFixed(2)} ${fillY.toFixed(2)}" class="tc-speedometer__fill" stroke-width="${sw}" fill="none" stroke-linecap="round" />`
        }

        // 9 tick marks at equal intervals along the arc, pointing inward from the
        // outer radius toward the centre.
        const tickLen = 5
        const ticks = Array.from({ length: 9 }, (_, i) => {
            const t = i / 8
            const c = Math.cos(Math.PI * t)
            const s = Math.sin(Math.PI * t)
            const x1 = (cx - r * c).toFixed(2)
            const y1 = (cy - r * s).toFixed(2)
            const x2 = (cx - (r - tickLen) * c).toFixed(2)
            const y2 = (cy - (r - tickLen) * s).toFixed(2)
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="tc-speedometer__tick" />`
        }).join('')

        // Needle pivots from the true arc centre (cx, cy) and points at the value
        // angle (the same parametrisation as the fill). A small hub circle sits at
        // the pivot. The needle stays in the outer band (≈ 65 % of the radius) so
        // the inner bowl is left clear for the readout.
        const needleLen = r * 0.65
        const ntx = cx - needleLen * Math.cos(Math.PI * pct)
        const nty = cy - needleLen * Math.sin(Math.PI * pct)
        const needleHtml =
            `<line x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${ntx.toFixed(2)}" y2="${nty.toFixed(2)}" class="tc-speedometer__needle" stroke-linecap="round" />` +
            `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="3.5" class="tc-speedometer__hub" />`

        const gearHtml = gear
            ? `<div class="tc-speedometer__gear">${esc(gear)}</div>`
            : ''

        const rpmHtml = rpm != null
            ? `<div class="tc-speedometer__rpm">${Math.round(rpm)} RPM</div>`
            : ''

        const ariaLabel = `${Math.round(value)} ${esc(unit)}${rpm != null ? `, ${Math.round(rpm)} RPM` : ''}${gear ? `, gear ${esc(gear)}` : ''}`

        // Expose the SVG aspect ratio and the arc-centre offset (as a fraction of
        // the SVG height) so the SCSS can pin the readout to the true arc centre
        // regardless of the chosen size. cy/vbH is the centre's vertical position.
        this.style.setProperty('--bs-speedometer-aspect', `${vbW} / ${vbH}`)
        this.style.setProperty('--bs-speedometer-center-y', `${((cy / vbH) * 100).toFixed(2)}%`)

        this.innerHTML = `<svg class="tc-speedometer__arc" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <path d="${trackPath}" class="tc-speedometer__track" stroke-width="${sw}" fill="none" stroke-linecap="round" />
    ${fillPathHtml}
    ${ticks}
    ${needleHtml}
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

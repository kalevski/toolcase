const TAG_NAME = 'tc-compass-rose'

/**
 * tc-compass-rose — radial compass rose showing a facing direction. The needle
 * rotates to the current `heading`; static N/E/S/W cardinals frame a flat slate
 * face. Ported from the game-components `gc-compass-rose` and re-skinned to the
 * toolcase design system (flat surface, 1px hairline ring, mono cardinals, slate
 * ink north needle). Purely presentational: no events, no slots.
 */
export class CompassRose extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['heading', 'size']
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
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : 0
    }
    set heading(value: number) {
        this.setAttribute('heading', String(value))
    }

    get size(): number | null {
        const raw = this.getAttribute('size')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set size(value: number | null) {
        if (value == null) this.removeAttribute('size')
        else this.setAttribute('size', String(value))
    }

    private normalizeDeg(deg: number): number {
        let d = deg % 360
        if (d < 0) d += 360
        return d
    }

    private render(): void {
        // size is purely numeric (px); omit to fall back to the partial default.
        const size = this.size
        if (size != null) this.style.setProperty('--bs-compass-rose-size', `${size}px`)
        else this.style.removeProperty('--bs-compass-rose-size')

        // The needle rotates by the heading; the partial reads this property and
        // applies (and transitions) the rotation.
        const heading = this.heading
        this.style.setProperty('--bs-compass-rose-rotation', `${heading}deg`)

        const readout = this.normalizeDeg(heading).toFixed(0).padStart(3, '0')

        // Host-owned class managed surgically so author classes survive.
        this.classList.add('tc-compass-rose')
        this.setAttribute('role', 'img')
        this.setAttribute('aria-label', `Compass rose — heading ${readout}°`)

        this.innerHTML = `
            <svg class="tc-compass-rose__face" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="47" class="tc-compass-rose__ring" />
                <line x1="50" y1="6" x2="50" y2="14" class="tc-compass-rose__tick" />
                <line x1="94" y1="50" x2="86" y2="50" class="tc-compass-rose__tick" />
                <line x1="50" y1="94" x2="50" y2="86" class="tc-compass-rose__tick" />
                <line x1="6" y1="50" x2="14" y2="50" class="tc-compass-rose__tick" />
                <g class="tc-compass-rose__needle">
                    <polygon points="50,11 56,50 50,42 44,50" class="tc-compass-rose__needle-n" />
                    <polygon points="50,89 56,50 50,58 44,50" class="tc-compass-rose__needle-s" />
                </g>
                <circle cx="50" cy="50" r="3" class="tc-compass-rose__hub" />
                <text x="50" y="25" text-anchor="middle" dominant-baseline="middle" class="tc-compass-rose__label tc-compass-rose__label--n">N</text>
                <text x="77" y="51" text-anchor="middle" dominant-baseline="middle" class="tc-compass-rose__label">E</text>
                <text x="50" y="78" text-anchor="middle" dominant-baseline="middle" class="tc-compass-rose__label">S</text>
                <text x="23" y="51" text-anchor="middle" dominant-baseline="middle" class="tc-compass-rose__label">W</text>
            </svg>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CompassRose
    }
}

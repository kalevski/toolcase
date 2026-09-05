const TAG_NAME = 'tc-vignette-overlay'

/**
 * tc-vignette-overlay — edge vignette overlay for low-health / damage feedback.
 * Ported from `gc-vignette-overlay` but voiced for the web-components design
 * system: no shadow DOM, no game chrome — a `::after` radial-gradient pseudo-
 * element painted on top of slotted content with `pointer-events: none`. The
 * pseudo-element is on the HOST, so the element creates no node and moves none of
 * the consumer's children (rule 1).
 *
 * All cosmetics flow through `--bs-vignette-overlay-*` custom properties.
 * `intensity` (0–1) and `vignette-color` (any CSS color) are reflected as
 * inline style overrides so authors can drive them from JS or animation.
 *
 * Slot: default — the content to vignette.
 */
export class VignetteOverlay extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['intensity', 'vignette-color']
    }

    connectedCallback(): void {
        this._initialised = true
        this._applyTokens()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._applyTokens()
    }

    get intensity(): number {
        const v = parseFloat(this.getAttribute('intensity') ?? '0.6')
        return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6
    }
    set intensity(v: number) {
        this.setAttribute('intensity', String(v))
    }

    get vignetteColor(): string {
        return this.getAttribute('vignette-color') ?? '#000000'
    }
    set vignetteColor(v: string) {
        if (v) this.setAttribute('vignette-color', v)
        else this.removeAttribute('vignette-color')
    }

    private _applyTokens(): void {
        const intensity = this.getAttribute('intensity')
        if (intensity !== null) {
            this.style.setProperty('--bs-vignette-overlay-intensity', String(this.intensity))
        } else {
            this.style.removeProperty('--bs-vignette-overlay-intensity')
        }

        const color = this.getAttribute('vignette-color')
        if (color) {
            this.style.setProperty('--bs-vignette-overlay-color', color)
        } else {
            this.style.removeProperty('--bs-vignette-overlay-color')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VignetteOverlay
    }
}

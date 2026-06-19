import { Skull } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-hit-marker'

const DEFAULT_SIZE = 24
const DEFAULT_DURATION = 350

export class HitMarker extends HTMLElement {
    private _initialised = false
    private _timer: ReturnType<typeof setTimeout> | null = null

    // Optional callback fired alongside the `tc-done` event.
    ondone: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['show', 'crit', 'kill', 'size', 'duration']
    }

    connectedCallback(): void {
        // Purely presentational confirmation reticle — keep it out of the
        // accessibility tree (it is a decorative hit marker, not a control).
        this.setAttribute('aria-hidden', 'true')
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        if (this.show) this._schedule()
    }

    disconnectedCallback(): void {
        this._clearTimer()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'show') {
            if (this.show) this._schedule()
            else this._clearTimer()
        }
        this.render()
    }

    get show(): boolean {
        return this.hasAttribute('show')
    }
    set show(v: boolean) {
        if (v) this.setAttribute('show', '')
        else this.removeAttribute('show')
    }

    get crit(): boolean {
        return this.hasAttribute('crit')
    }
    set crit(v: boolean) {
        if (v) this.setAttribute('crit', '')
        else this.removeAttribute('crit')
    }

    get kill(): boolean {
        return this.hasAttribute('kill')
    }
    set kill(v: boolean) {
        if (v) this.setAttribute('kill', '')
        else this.removeAttribute('kill')
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return DEFAULT_SIZE
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? DEFAULT_SIZE : parsed
    }
    set size(v: number) {
        this.setAttribute('size', String(v))
    }

    get duration(): number {
        const raw = this.getAttribute('duration')
        if (raw == null) return DEFAULT_DURATION
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? DEFAULT_DURATION : parsed
    }
    set duration(v: number) {
        this.setAttribute('duration', String(v))
    }

    private _clearTimer(): void {
        if (this._timer != null) {
            clearTimeout(this._timer)
            this._timer = null
        }
    }

    private _schedule(): void {
        this._clearTimer()
        this._timer = setTimeout(() => {
            this._timer = null
            // Auto-hide, then announce completion so the host can recycle/remove.
            this.show = false
            this.dispatchEvent(
                new CustomEvent('tc-done', {
                    bubbles: true,
                    composed: true,
                    detail: {},
                }),
            )
            if (typeof this.ondone === 'function') this.ondone()
        }, this.duration)
    }

    private render(): void {
        // Size and lifetime flow to the stylesheet as inline custom properties;
        // the pop-and-fade animation is kept in sync with the `tc-done` timer.
        this.style.setProperty('--bs-hit-marker-size', `${this.size}px`)
        this.style.setProperty('--bs-hit-marker-duration', `${this.duration}ms`)

        const variant = this.kill ? 'kill' : this.crit ? 'crit' : 'normal'
        // Kill swaps the fantasy ☠ emoji for a slate-skinned lucide Skull glyph.
        const glyph = this.kill ? icon(Skull, 'tc-hit-marker-glyph') : ''

        this.innerHTML =
            `<span class="tc-hit-marker" data-variant="${variant}">` +
            `<svg class="tc-hit-marker-svg" viewBox="0 0 24 24" aria-hidden="true">` +
            `<line class="tc-hit-marker-line" x1="4" y1="4" x2="9" y2="9"></line>` +
            `<line class="tc-hit-marker-line" x1="20" y1="4" x2="15" y2="9"></line>` +
            `<line class="tc-hit-marker-line" x1="4" y1="20" x2="9" y2="15"></line>` +
            `<line class="tc-hit-marker-line" x1="20" y1="20" x2="15" y2="15"></line>` +
            `</svg>` +
            glyph +
            `</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: HitMarker
    }
}

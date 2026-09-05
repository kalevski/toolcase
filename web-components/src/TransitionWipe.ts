import { patchHtml } from './internal/patch-html'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-transition-wipe'

export type TransitionWipeDirection = 'fade' | 'left' | 'right' | 'up' | 'down' | 'iris'

const DIRECTIONS: TransitionWipeDirection[] = ['fade', 'left', 'right', 'up', 'down', 'iris']

/**
 * tc-transition-wipe — full-screen scene-wipe transition overlay. Ported from
 * `gc-transition-wipe` but voiced for the web-components design system: no
 * shadow DOM, no fantasy chrome — a single flat-fill `<div>` that CSS transitions
 * in/out via the `[show]` attribute. Directions: fade, left, right, up, down, iris.
 *
 * When `[show]` is set the fill animates into view; a `tc-complete` event fires
 * after `duration` ms (matching the CSS transition length) to signal the host
 * layer that the scene can change. Removing `[show]` animates the fill back
 * out. pointer-events are blocked during the wipe so the scene beneath is
 * non-interactive while the transition runs.
 *
 * No shadow root, no slots. All cosmetics flow through `--bs-transition-wipe-*`
 * custom properties; `wipe-color` and `duration` write through to those props
 * inline following the arbitrary-CSS-value pattern.
 *
 * Events: `tc-complete` (bubbles, composed) fires after `duration` ms whenever
 * `[show]` is set.
 */
export class TransitionWipe extends HTMLElement {
    private _initialised = false
    private _timer: ReturnType<typeof setTimeout> | null = null

    /** Optional callback fired alongside the `tc-complete` CustomEvent. */
    onComplete: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['show', 'direction', 'duration', 'wipe-color']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            patchHtml(this, '<div class="tc-transition-wipe-fill"></div>')
            this._initialised = true
        }
        this._applyState()
        if (this.show) this._scheduleComplete()
    }

    disconnectedCallback(): void {
        this._clearTimer()
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'show') {
            if (next !== null) this._scheduleComplete()
            else this._clearTimer()
        }
        this._applyState()
    }

    get show(): boolean {
        return this.hasAttribute('show')
    }
    set show(v: boolean) {
        if (v) this.setAttribute('show', '')
        else this.removeAttribute('show')
    }

    get direction(): TransitionWipeDirection {
        const raw = this.getAttribute('direction') as TransitionWipeDirection
        return DIRECTIONS.includes(raw) ? raw : 'fade'
    }
    set direction(v: TransitionWipeDirection) {
        setAttr(this, 'direction', v)
    }

    get duration(): number {
        const raw = this.getAttribute('duration')
        if (raw == null) return 400
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 400 : parsed
    }
    set duration(v: number) {
        this.setAttribute('duration', String(v))
    }

    get wipeColor(): string {
        return this.getAttribute('wipe-color') ?? 'var(--tc-ink)'
    }
    set wipeColor(v: string) {
        setAttr(this, 'wipe-color', v)
    }

    private _clearTimer(): void {
        if (this._timer != null) {
            clearTimeout(this._timer)
            this._timer = null
        }
    }

    private _scheduleComplete(): void {
        this._clearTimer()
        this._timer = setTimeout(() => {
            this._timer = null
            this._emitComplete()
        }, this.duration)
    }

    private _emitComplete(): void {
        this.dispatchEvent(
            new CustomEvent('tc-complete', {
                bubbles: true,
                composed: true,
                detail: {},
            }),
        )
        if (typeof this.onComplete === 'function') this.onComplete()
    }

    private _applyState(): void {
        const fill = this.querySelector<HTMLElement>('.tc-transition-wipe-fill')
        if (!fill) return

        // data-direction drives the CSS selector for transition type.
        fill.dataset.direction = this.direction

        // wipe-color and duration write through as inline CSS custom properties
        // on the host; the SCSS partial reads them via var(--bs-transition-wipe-*).
        const color = this.getAttribute('wipe-color')
        if (color) this.style.setProperty('--bs-transition-wipe-color', color)
        else this.style.removeProperty('--bs-transition-wipe-color')

        this.style.setProperty('--bs-transition-wipe-duration', `${this.duration}ms`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TransitionWipe
    }
}

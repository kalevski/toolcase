import { patchHtml } from './internal/patch-html'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-screen-flash'

/**
 * tc-screen-flash — full-screen flash effect for damage hits and scene
 * transitions. Ported from `gc-screen-flash` but voiced for the web-components
 * design system: no shadow DOM, no game chrome. A single fill `<div>` animates
 * its opacity on demand via JS when the `trigger` attribute changes or the
 * `flash()` method is called imperatively.
 *
 * The host sits `position: fixed; inset: 0` with `pointer-events: none` so it
 * covers the viewport without blocking interaction. The fill starts transparent
 * and is briefly set to `flashOpacity`, then faded back to 0 over `duration` ms.
 *
 * No shadow root, no slots. All cosmetics flow through `--bs-screen-flash-*`
 * custom properties; free-form CSS value attributes (`flash-color`) write through
 * as inline styles following the arbitrary-CSS-value pattern.
 *
 * Events: `tc-done` fires (bubbles, composed) when the fade-out completes.
 */
export class ScreenFlash extends HTMLElement {
    private _initialised = false
    private _timer: ReturnType<typeof setTimeout> | null = null
    private _lastTrigger: string | null = null

    /** Optional callback fired alongside the `tc-done` CustomEvent. */
    onDone: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['flash-color', 'flash-opacity', 'duration', 'trigger']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            patchHtml(this, '<div class="tc-screen-flash-fill"></div>')
            this._initialised = true
        }
        this._applyColor()
        this._lastTrigger = this.getAttribute('trigger')
    }

    disconnectedCallback(): void {
        this._clearTimer()
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'trigger') {
            // Only flash when `trigger` changes to a new non-null value — matches
            // the gc-screen-flash contract (setting the same value twice is a no-op).
            if (next !== null && next !== this._lastTrigger) {
                this._lastTrigger = next
                this._flash()
            }
            return
        }
        if (name === 'flash-color') {
            this._applyColor()
        }
        // flash-opacity and duration are read at flash-time; no re-render needed.
    }

    get flashColor(): string {
        return this.getAttribute('flash-color') ?? '#ffffff'
    }
    set flashColor(v: string) {
        setAttr(this, 'flash-color', v)
    }

    get flashOpacity(): number {
        const raw = this.getAttribute('flash-opacity')
        if (raw == null) return 1
        const parsed = parseFloat(raw)
        if (Number.isNaN(parsed)) return 1
        return Math.max(0, Math.min(1, parsed))
    }
    set flashOpacity(v: number) {
        this.setAttribute('flash-opacity', String(v))
    }

    get duration(): number {
        const raw = this.getAttribute('duration')
        if (raw == null) return 200
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 200 : parsed
    }
    set duration(v: number) {
        this.setAttribute('duration', String(v))
    }

    get trigger(): string | null {
        return this.getAttribute('trigger')
    }
    set trigger(v: string | null) {
        if (v == null) this.removeAttribute('trigger')
        else this.setAttribute('trigger', v)
    }

    /** Imperatively trigger a flash without changing the `trigger` attribute. */
    flash(): void {
        this._flash()
    }

    private _applyColor(): void {
        const fill = this.querySelector<HTMLElement>('.tc-screen-flash-fill')
        if (!fill) return
        const color = this.getAttribute('flash-color')
        if (color) fill.style.background = color
        else fill.style.removeProperty('background')
    }

    private _clearTimer(): void {
        if (this._timer != null) {
            clearTimeout(this._timer)
            this._timer = null
        }
    }

    private _flash(): void {
        const fill = this.querySelector<HTMLElement>('.tc-screen-flash-fill')
        if (!fill) return
        this._clearTimer()

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduced) {
            // Skip the fade entirely — flash on then immediately off.
            fill.style.transition = 'none'
            fill.style.opacity = String(this.flashOpacity)
            void fill.offsetWidth // force reflow so the opacity registers
            fill.style.opacity = '0'
            this._emitDone()
            return
        }

        const dur = this.duration
        fill.style.transition = 'none'
        fill.style.opacity = String(this.flashOpacity)
        void fill.offsetWidth // force reflow to commit the starting opacity
        fill.style.transition = `opacity ${dur}ms ease-out`
        fill.style.opacity = '0'
        this._timer = setTimeout(() => {
            this._timer = null
            this._emitDone()
        }, dur)
    }

    private _emitDone(): void {
        this.dispatchEvent(
            new CustomEvent('tc-done', {
                bubbles: true,
                composed: true,
                detail: {},
            }),
        )
        if (typeof this.onDone === 'function') this.onDone()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ScreenFlash
    }
}

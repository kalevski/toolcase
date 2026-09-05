const TAG_NAME = 'tc-shake-container'

/**
 * tc-shake-container — rAF-driven camera-shake wrapper that translates its
 * slotted content with a decaying random offset. Ported from `gc-shake-container`
 * but voiced for the web-components design system: no Shadow DOM, no game chrome
 * and — since 5.1 — no wrap element at all: the transform is applied to the HOST,
 * so the consumer's children are never re-parented (rule 1).
 *
 * A new shake is triggered whenever the `trigger` attribute is set to a value
 * that differs from the last-seen value. The shake amplitude decays linearly
 * from `intensity` px to 0 over `duration` ms.
 *
 * The imperative `shake()` method re-triggers the animation without mutating the
 * `trigger` attribute — useful for JS-driven orchestration.
 *
 * No events are fired (matches the gc-shake-container contract). When
 * `prefers-reduced-motion: reduce` is active the shake is skipped entirely.
 *
 * Slot: default — the content to shake.
 */
export class ShakeContainer extends HTMLElement {
    private _initialised = false
    private _rafHandle: number | null = null
    private _startedAt: number = 0
    private _lastTrigger: string | null = null

    static get observedAttributes(): string[] {
        return ['trigger', 'intensity', 'duration']
    }

    connectedCallback(): void {
        this._initialised = true
        this._lastTrigger = this.getAttribute('trigger')
    }

    disconnectedCallback(): void {
        this._stopShake()
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected) return
        if (name === 'trigger') {
            if (!this._initialised) return
            if (next !== null && next !== this._lastTrigger) {
                this._lastTrigger = next
                this._startShake()
            }
            return
        }
        // intensity and duration are read at shake-time; no re-render needed.
    }

    get trigger(): string | null {
        return this.getAttribute('trigger')
    }
    set trigger(value: string | null) {
        if (value == null) this.removeAttribute('trigger')
        else this.setAttribute('trigger', value)
    }

    get intensity(): number {
        const raw = this.getAttribute('intensity')
        if (raw == null) return 8
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed < 0 ? 8 : parsed
    }
    set intensity(value: number) {
        this.setAttribute('intensity', String(value))
    }

    get duration(): number {
        const raw = this.getAttribute('duration')
        if (raw == null) return 350
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 350 : parsed
    }
    set duration(value: number) {
        this.setAttribute('duration', String(value))
    }

    /** Imperatively trigger a shake without changing the `trigger` attribute. */
    shake(): void {
        this._startShake()
    }

    private _stopShake(): void {
        if (this._rafHandle != null) {
            cancelAnimationFrame(this._rafHandle)
            this._rafHandle = null
        }
        this.style.transform = ''
    }

    private _startShake(): void {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        this._stopShake()
        this._startedAt = performance.now()

        const tick = (now: number) => {
            const elapsed = now - this._startedAt
            const total = this.duration
            if (elapsed >= total) {
                this.style.transform = ''
                this._rafHandle = null
                return
            }
            const decay = 1 - elapsed / total
            const range = this.intensity * decay
            const x = (Math.random() * 2 - 1) * range
            const y = (Math.random() * 2 - 1) * range
            this.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`
            this._rafHandle = requestAnimationFrame(tick)
        }
        this._rafHandle = requestAnimationFrame(tick)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ShakeContainer
    }
}

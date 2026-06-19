import { esc } from './internal/esc'
const TAG_NAME = 'tc-damage-number'

export type DamageNumberVariant = 'normal' | 'crit' | 'heal' | 'miss'

const DEFAULT_DURATION = 700

export class DamageNumber extends HTMLElement {
    private _initialised = false
    private _timer: ReturnType<typeof setTimeout> | null = null

    // Optional callback fired alongside the `tc-done` event.
    ondone: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'crit', 'heal', 'miss', 'duration']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._schedule()
    }

    disconnectedCallback(): void {
        this._clearTimer()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get value(): string {
        return this.getAttribute('value') || ''
    }
    set value(v: string) {
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get crit(): boolean {
        return this.hasAttribute('crit')
    }
    set crit(v: boolean) {
        if (v) this.setAttribute('crit', '')
        else this.removeAttribute('crit')
    }

    get heal(): boolean {
        return this.hasAttribute('heal')
    }
    set heal(v: boolean) {
        if (v) this.setAttribute('heal', '')
        else this.removeAttribute('heal')
    }

    get miss(): boolean {
        return this.hasAttribute('miss')
    }
    set miss(v: boolean) {
        if (v) this.setAttribute('miss', '')
        else this.removeAttribute('miss')
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
        const variant: DamageNumberVariant = this.miss
            ? 'miss'
            : this.heal
              ? 'heal'
              : this.crit
                ? 'crit'
                : 'normal'
        const text = this.miss ? 'MISS' : this.value
        const prefix = this.heal ? '+' : ''

        // Drives the CSS float-up animation duration; kept in sync with the
        // `done` timer so the visual and the event end together.
        this.style.setProperty('--bs-damage-number-duration', `${this.duration}ms`)

        this.innerHTML =
            `<span class="tc-damage-number-text" data-variant="${variant}" role="status">` +
            `${prefix}${esc(text)}` +
            `</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DamageNumber
    }
}

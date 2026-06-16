import { escapeHtml, renderResourceBarTrack } from './internal/resourceBar'

const TAG_NAME = 'tc-health-bar'

export class HealthBar extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['value', 'max', 'ghost', 'segments', 'show-text', 'label']
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
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get max(): number {
        const raw = this.getAttribute('max')
        if (raw == null) return 100
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 100 : parsed
    }
    set max(v: number) {
        this.setAttribute('max', String(v))
    }

    get ghost(): number | null {
        const raw = this.getAttribute('ghost')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? null : parsed
    }
    set ghost(v: number | null) {
        if (v == null) this.removeAttribute('ghost')
        else this.setAttribute('ghost', String(v))
    }

    get segments(): number {
        const raw = this.getAttribute('segments')
        if (raw == null) return 1
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed
    }
    set segments(v: number) {
        this.setAttribute('segments', String(v))
    }

    get showText(): boolean {
        return this.hasAttribute('show-text')
    }
    set showText(v: boolean) {
        if (v) this.setAttribute('show-text', '')
        else this.removeAttribute('show-text')
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        this.setAttribute('label', v)
    }

    private render(): void {
        const max = this.max
        const value = Math.max(0, Math.min(max, this.value))
        const label = this.label
        const showText = this.showText
        const segments = this.segments

        // Component-owned host class via classList so author-supplied classes survive.
        this.classList.add('tc-health-bar')

        const numericText = `${Math.round(value)} / ${Math.round(max)}`

        // Evenly-spaced segment dividers become tick fractions in (0, 1).
        const ticks =
            segments > 1
                ? Array.from({ length: segments - 1 }, (_, i) => (i + 1) / segments)
                : []

        const labelRow = label
            ? `<div class="tc-health-bar__label-row">` +
              `<span class="tc-health-bar__label">${escapeHtml(label)}</span>` +
              `<span class="tc-health-bar__label-value">${numericText}</span>` +
              `</div>`
            : ''

        const track = renderResourceBarTrack({
            prefix: 'tc-health-bar',
            value,
            max,
            ghost: this.ghost,
            ticks,
            label: label || 'Health',
            inlineText: showText && !label ? numericText : null,
        })

        this.innerHTML = labelRow + track
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: HealthBar
    }
}

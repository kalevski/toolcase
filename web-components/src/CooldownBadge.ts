import { esc } from './internal/esc'
const TAG_NAME = 'tc-cooldown-badge'

// Format the remaining cooldown the way the game-components source does: m:ss
// above a minute, whole seconds from 10s up, one decimal under 10s.
function formatTime(seconds: number): string {
    if (seconds >= 60) {
        const m = Math.floor(seconds / 60)
        const s = Math.floor(seconds % 60)
        return `${m}:${String(s).padStart(2, '0')}`
    }
    if (seconds >= 10) return String(Math.ceil(seconds))
    return seconds.toFixed(1)
}

export class CooldownBadge extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['value', 'max', 'size', 'label', 'show-label']
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
    set value(value: number) {
        this.setAttribute('value', String(value))
    }

    get max(): number {
        const raw = this.getAttribute('max')
        if (raw == null) return 1
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed
    }
    set max(value: number) {
        this.setAttribute('max', String(value))
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 48
        const parsed = parseFloat(raw)
        if (Number.isNaN(parsed)) return 48
        return Math.max(32, Math.min(64, parsed))
    }
    set size(value: number) {
        this.setAttribute('size', String(value))
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(value: string) {
        if (value) this.setAttribute('label', value)
        else this.removeAttribute('label')
    }

    get showLabel(): boolean {
        return this.hasAttribute('show-label')
    }
    set showLabel(value: boolean) {
        if (value) this.setAttribute('show-label', '')
        else this.removeAttribute('show-label')
    }

    private render(): void {
        const size = this.size
        const max = this.max
        const value = Math.max(0, Math.min(max, this.value))
        const remaining = max - value
        const pct = max > 0 ? remaining / max : 0
        const ready = pct <= 0

        // Ring geometry — an SVG stroke disc (one of the sanctioned circular
        // shapes). Thickness scales with the diameter so the hairline reads at
        // any size; colours flow through the --bs-cooldown-badge-* contract.
        const thickness = Math.max(3, Math.round(size * 0.1))
        const r = Math.max(0, (size - thickness) / 2)
        const cx = size / 2
        const cy = size / 2
        const circumference = 2 * Math.PI * r
        // Ready shows a complete ring (the "available" signal); while cooling the
        // arc depletes clockwise as `value` climbs toward `max`.
        const arcPct = ready ? 1 : pct
        const dashOffset = circumference * (1 - arcPct)

        this.style.setProperty('--bs-cooldown-badge-size', `${size}px`)

        const customLabel = this.label
        const showLabel = this.showLabel || this.hasAttribute('label')
        const labelText =
            customLabel !== '' ? esc(customLabel) : remaining > 0 ? formatTime(remaining) : ''
        const labelHtml =
            showLabel && labelText !== ''
                ? `<span class="tc-cooldown-badge__label" aria-hidden="true">${labelText}</span>`
                : ''

        // Accessible name: the badge is a presentational status, so describe its
        // state on the wrapper and hide the decorative SVG + visual label.
        const aria = ready
            ? customLabel || 'Ready'
            : customLabel
              ? `${customLabel}: ${formatTime(remaining)} remaining`
              : `Cooldown ${formatTime(remaining)} remaining`

        const readyClass = ready ? ' tc-cooldown-badge--ready' : ''

        this.innerHTML = `
            <span class="tc-cooldown-badge${readyClass}" role="img" aria-label="${esc(aria)}">
                <svg class="tc-cooldown-badge__svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true" focusable="false">
                    <circle class="tc-cooldown-badge__track" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${thickness}" fill="none"></circle>
                    <circle class="tc-cooldown-badge__fill" cx="${cx}" cy="${cy}" r="${r}" stroke-width="${thickness}" fill="none" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"></circle>
                </svg>
                ${labelHtml}
            </span>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CooldownBadge
    }
}

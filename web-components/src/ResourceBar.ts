import { escapeHtml, renderResourceBarTrack } from './internal/resourceBar'

const TAG_NAME = 'tc-resource-bar'

// Default variant per registered tag. The three preset aliases
// (tc-health-bar / tc-mana-bar / tc-stamina-bar) derive their fill color and
// accessible-label fallback from the tag they were defined as, so legacy markup
// keeps working without ever setting a `variant` attribute. The canonical
// tc-resource-bar tag has no implicit variant — it reads the `variant` attr.
const TAG_VARIANTS: Record<string, string> = {
    'tc-health-bar': 'health',
    'tc-mana-bar': 'mana',
    'tc-stamina-bar': 'stamina',
}

// Accessible-label fallback per known variant when no `label` attribute is set.
const VARIANT_LABELS: Record<string, string> = {
    health: 'Health',
    mana: 'Mana',
    stamina: 'Stamina',
}

// Variants that carry a SCSS fill-color modifier. Anything else is treated as a
// custom variant: theme it via the --bs-resource-bar-fill-bg custom property.
const KNOWN_VARIANTS = ['health', 'mana', 'stamina']

/**
 * tc-resource-bar — value/max resource bar for a game HUD (HP / mana / stamina
 * and friends). An ink fill over a flat slate track with an optional label row
 * (label + mono `value / max` readout), a ghost band behind the fill for recent
 * loss, inline mono text inside the track, and evenly-spaced segment dividers.
 * Purely presentational — no events, no slots; the fill is clamped to [0, max].
 *
 * The `variant` attribute (`health` | `mana` | `stamina` | custom) selects the
 * fill color. tc-health-bar / tc-mana-bar / tc-stamina-bar are aliases of this
 * element that default `variant` from their tag name. The shared track / fill /
 * ghost / tick DOM is produced by the internal/resourceBar helper.
 */
export class ResourceBar extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['value', 'max', 'ghost', 'segments', 'show-text', 'label', 'variant']
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

    get variant(): string {
        return this.getAttribute('variant') ?? TAG_VARIANTS[this.localName] ?? ''
    }
    set variant(v: string) {
        this.setAttribute('variant', v)
    }

    private render(): void {
        const max = this.max
        const value = Math.max(0, Math.min(max, this.value))
        const label = this.label
        const showText = this.showText
        const segments = this.segments
        const variant = this.variant

        // Component-owned host classes via classList so author-supplied classes
        // survive. The --{variant} modifier carries the per-variant fill color.
        this.classList.add('tc-resource-bar')
        for (const v of KNOWN_VARIANTS) {
            this.classList.toggle(`tc-resource-bar--${v}`, v === variant)
        }

        const numericText = `${Math.round(value)} / ${Math.round(max)}`

        // Evenly-spaced segment dividers become tick fractions in (0, 1).
        const ticks =
            segments > 1
                ? Array.from({ length: segments - 1 }, (_, i) => (i + 1) / segments)
                : []

        const labelRow = label
            ? `<div class="tc-resource-bar__label-row">` +
              `<span class="tc-resource-bar__label">${escapeHtml(label)}</span>` +
              `<span class="tc-resource-bar__label-value">${numericText}</span>` +
              `</div>`
            : ''

        const track = renderResourceBarTrack({
            prefix: 'tc-resource-bar',
            value,
            max,
            ghost: this.ghost,
            ticks,
            label: label || VARIANT_LABELS[variant] || 'Resource',
            inlineText: showText && !label ? numericText : null,
        })

        this.innerHTML = labelRow + track
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ResourceBar
        'tc-health-bar': ResourceBar
        'tc-mana-bar': ResourceBar
        'tc-stamina-bar': ResourceBar
    }
}

import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-emission-badge'

// tc-emission-badge — compact emissions credential for a vehicle catalog row
// (the `emission_category` lookup label plus the variant's measurement
// context). Renders the category label behind a 4px colored left stripe that
// encodes the emission class — derived from the first digit found in `label`
// (Euro 6 → high tier), overridable via the `tier` attribute for labels that
// carry no digit. Optional extras: a NEDC/WLTP measurement-standard mono tag
// (`standard`, the literal "NA" is omitted — unknown is NULL, never a
// sentinel) and a mono CO₂ figure (`co2-text`). The stripe is the only
// colored element; the body stays neutral per the "color is information,
// spent sparingly" rule.
export class EmissionBadge extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['label', 'standard', 'co2-text', 'tier']
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

    // ── Props ────────────────────────────────────────────────────────────────

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        setAttr(this, 'label', v)
    }

    get tier(): number | null {
        const parsed = parseInt(this.getAttribute('tier') ?? '', 10)
        return isNaN(parsed) ? null : parsed
    }
    set tier(v: number | null) {
        if (v == null) this.removeAttribute('tier')
        else this.setAttribute('tier', String(v))
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    // 6/5 → success, 4/3 → warning, 2/1 → danger, no digit → neutral stripe.
    private _tierClass(): string {
        const override = this.tier
        const fromLabel = this.label.match(/\d/)
        const tier = override ?? (fromLabel ? parseInt(fromLabel[0], 10) : NaN)
        if (isNaN(tier)) return ''
        if (tier >= 5) return ' tc-emission-badge--tier-high'
        if (tier >= 3) return ' tc-emission-badge--tier-mid'
        if (tier >= 1) return ' tc-emission-badge--tier-low'
        return ''
    }

    private render(): void {
        const standard = this.getAttribute('standard')
        const co2Text = this.getAttribute('co2-text')
        const standardHtml =
            standard && standard !== 'NA'
                ? `<span class="tc-emission-badge-standard">${esc(standard)}</span>`
                : ''
        const co2Html = co2Text ? `<span class="tc-emission-badge-co2">${esc(co2Text)}</span>` : ''
        patchHtml(
            this,
            `<span class="tc-emission-badge${this._tierClass()}">` +
                `<span class="tc-emission-badge-label">${esc(this.label)}</span>` +
                standardHtml +
                co2Html +
                `</span>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EmissionBadge
    }
}

import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-manufacturer-tile'

// tc-manufacturer-tile — a brand tile for manufacturer grids and filter
// rails (the `manufacturer` lookup table of a vehicle catalog: one name per
// row). Renders a square brand mark (logo image, or an auto-monogram built
// from the name's initials when no logo is available — a sharp square well,
// deliberately NOT the circular avatar treatment), an optional mono
// micro-label eyebrow (`eyebrow`, e.g. "MARQUE"), the manufacturer name and
// an optional count line ("128 models").
//
// When `href` is set the whole tile is a link. The `active` boolean attribute
// marks the selected-filter state and paints the tile with the solid-ink
// active treatment from the styleguide state ladder.
export class ManufacturerTile extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['name', 'logo-src', 'href', 'count-text', 'active', 'eyebrow']
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

    get active(): boolean {
        return this.hasAttribute('active')
    }
    set active(v: boolean) {
        if (v) this.setAttribute('active', '')
        else this.removeAttribute('active')
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    // "Alfa Romeo" → "AR", "BMW" → "B" — initials of the first two words.
    private _monogram(name: string): string {
        const words = name.trim().split(/\s+/).filter(Boolean)
        if (words.length === 0) return ''
        return words
            .slice(0, 2)
            .map((w) => w.charAt(0).toUpperCase())
            .join('')
    }

    private render(): void {
        const name = this.getAttribute('name') ?? ''
        const logoSrc = this.getAttribute('logo-src')
        const href = this.getAttribute('href')
        const countText = this.getAttribute('count-text')
        const eyebrow = this.getAttribute('eyebrow')
        const active = this.active

        const markHtml = logoSrc
            ? `<span class="tc-manufacturer-tile-mark">` +
              `<img class="tc-manufacturer-tile-logo" src="${esc(logoSrc)}" alt="" loading="lazy" />` +
              `</span>`
            : `<span class="tc-manufacturer-tile-mark tc-manufacturer-tile-mark--monogram" aria-hidden="true">` +
              esc(this._monogram(name)) +
              `</span>`

        const bodyHtml =
            `<span class="tc-manufacturer-tile-body">` +
            (eyebrow ? `<span class="tc-manufacturer-tile-eyebrow">${esc(eyebrow)}</span>` : '') +
            `<span class="tc-manufacturer-tile-name">${esc(name)}</span>` +
            (countText ? `<span class="tc-manufacturer-tile-count">${esc(countText)}</span>` : '') +
            `</span>`

        const cls = active
            ? 'tc-manufacturer-tile tc-manufacturer-tile--active'
            : 'tc-manufacturer-tile'
        patchHtml(
            this,
            href
                ? `<a class="${cls}" href="${esc(href)}"` +
                      (active ? ' aria-current="true"' : '') +
                      `>${markHtml}${bodyHtml}</a>`
                : `<span class="${cls}">${markHtml}${bodyHtml}</span>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ManufacturerTile
    }
}

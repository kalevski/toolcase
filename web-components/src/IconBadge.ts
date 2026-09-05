import { patchHtml } from './internal/patch-html'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { escapeHtml } from './internal/resourceBar'

const TAG_NAME = 'tc-icon-badge'

// The `glyph` value is a lucide icon name (e.g. "Star", "Shield"). Resolve it to
// an inline SVG; an unknown name falls through to escaped text so single-letter
// / numeric badges still render. (The gc-icon-badge accepted Bootstrap Icon
// classnames — dropped here, since web-components sources all glyphs from
// lucide-static, mirroring tc-icon / tc-buff-icon.)
function resolveIcon(name: string): string {
    const svgStr = (LucideIcons as Record<string, string>)[name]
    if (!svgStr) return ''
    return icon(svgStr)
}

export class IconBadge extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['glyph', 'size', 'color', 'bg']
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

    // --- Public API (mirrors gc-icon-badge) ---

    get glyph(): string {
        return this.getAttribute('glyph') || ''
    }
    set glyph(value: string) {
        if (value) this.setAttribute('glyph', value)
        else this.removeAttribute('glyph')
    }

    get size(): number | null {
        const value = this.getAttribute('size')
        if (value == null) return null
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    set size(value: number | null) {
        if (value == null) this.removeAttribute('size')
        else this.setAttribute('size', String(value))
    }

    get color(): string {
        return this.getAttribute('color') || ''
    }
    set color(value: string) {
        if (value) this.setAttribute('color', value)
        else this.removeAttribute('color')
    }

    get bg(): string {
        return this.getAttribute('bg') || ''
    }
    set bg(value: string) {
        if (value) this.setAttribute('bg', value)
        else this.removeAttribute('bg')
    }

    private render(): void {
        // size is a bare-number px value → inline custom property on the host.
        // Absent leaves the SCSS default in place; the glyph scales off the tile
        // size via calc(), so no separate glyph-size property is needed.
        const size = this.size
        if (size != null) this.style.setProperty('--bs-icon-badge-size', `${size}px`)
        else this.style.removeProperty('--bs-icon-badge-size')

        // color (glyph) and bg (tile) are free-form CSS values → inline overrides.
        const color = this.color
        if (color) this.style.setProperty('--bs-icon-badge-color', color)
        else this.style.removeProperty('--bs-icon-badge-color')

        const bg = this.bg
        if (bg) this.style.setProperty('--bs-icon-badge-bg', bg)
        else this.style.removeProperty('--bs-icon-badge-bg')

        const glyph = this.glyph
        const iconSvg = glyph ? resolveIcon(glyph) : ''
        const glyphMarkup = iconSvg || (glyph ? escapeHtml(glyph) : '')

        patchHtml(
            this,
            `<span class="tc-icon-badge__glyph" aria-hidden="true">${glyphMarkup}</span>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: IconBadge
    }
}

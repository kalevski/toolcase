import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { escapeHtml } from './internal/resourceBar'

const TAG_NAME = 'tc-buff-icon'

export type BuffIconKind = 'buff' | 'debuff'

// The `glyph` value is a lucide icon name (e.g. "Flame", "Shield"). Resolve it
// to an inline SVG; an unknown name falls through to escaped text so single
// letter / numeric buffs still render.
function resolveIcon(name: string): string {
    const svgStr = (LucideIcons as Record<string, string>)[name]
    if (!svgStr) return ''
    return icon(svgStr)
}

export class BuffIcon extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['glyph', 'time', 'kind', 'color', 'size']
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

    // --- Public API (mirrors gc-buff-icon) ---

    get glyph(): string {
        return this.getAttribute('glyph') ?? ''
    }
    set glyph(v: string) {
        if (v) this.setAttribute('glyph', v)
        else this.removeAttribute('glyph')
    }

    get time(): string {
        return this.getAttribute('time') ?? ''
    }
    set time(v: string) {
        if (v) this.setAttribute('time', v)
        else this.removeAttribute('time')
    }

    get kind(): BuffIconKind {
        return this.getAttribute('kind') === 'debuff' ? 'debuff' : 'buff'
    }
    set kind(v: BuffIconKind) {
        this.setAttribute('kind', v)
    }

    get color(): string {
        return this.getAttribute('color') ?? ''
    }
    set color(v: string) {
        if (v) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 36
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 36 : parsed
    }
    set size(v: number) {
        this.setAttribute('size', String(v))
    }

    private render(): void {
        // size is a bare-number px value → inline custom property on the host.
        this.style.setProperty('--bs-buff-icon-size', `${this.size}px`)
        // Reflect the status kind so themes / the SCSS accent stripe can target it.
        this.dataset.kind = this.kind

        // color is a free-form CSS color → inline override of the glyph color var.
        const color = this.color
        if (color) this.style.setProperty('--bs-buff-icon-glyph-color', color)
        else this.style.removeProperty('--bs-buff-icon-glyph-color')

        const glyph = this.glyph
        const iconSvg = glyph ? resolveIcon(glyph) : ''
        const glyphMarkup = iconSvg || (glyph ? escapeHtml(glyph) : '')

        const time = this.time
        const timeMarkup = time
            ? `<span class="tc-buff-icon__time">${escapeHtml(time)}</span>`
            : ''

        this.innerHTML =
            `<span class="tc-buff-icon__glyph" aria-hidden="true">${glyphMarkup}</span>` +
            timeMarkup
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BuffIcon
    }
}

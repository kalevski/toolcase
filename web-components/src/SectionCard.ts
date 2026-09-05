import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-section-card'

export type SectionCardVariant = 'default' | 'danger'
const VARIANTS: SectionCardVariant[] = ['default', 'danger']

export class SectionCard extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['title', 'icon', 'variant']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        setAttr(this, 'title', v)
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get variant(): SectionCardVariant {
        const v = this.getAttribute('variant') as SectionCardVariant
        return VARIANTS.includes(v) ? v : 'default'
    }
    set variant(v: SectionCardVariant) {
        setAttr(this, 'variant', v)
    }

    /** THE HOST IS THE CARD — a grid whose first row carries the owned header and
     *  any `slot="action"` child the consumer wrote, and whose later rows are their
     *  remaining children. Both are placed by CSS; neither is moved (rule 1). */
    private render(): void {
        const titleAttr = this.getAttribute('title') ?? ''
        const iconName = this.getAttribute('icon')

        const svgStr = iconName ? (LucideIcons as Record<string, string>)[iconName] : null
        const iconSvg = svgStr ? icon(svgStr, 'tc-section-card-icon-svg') : ''
        const iconHtml = iconSvg
            ? `<span class="tc-section-card-icon" aria-hidden="true">${iconSvg}</span>`
            : ''

        setHostClass(this, `tc-section-card tc-section-card--${esc(this.variant)}`)
        patchHtml(
            this,
            `<div class="tc-section-card-header">${iconHtml}` +
                `<h3 class="tc-section-card-title">${esc(titleAttr)}</h3></div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SectionCard
    }
}

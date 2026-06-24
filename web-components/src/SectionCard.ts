import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-section-card'

export type SectionCardVariant = 'default' | 'danger'
const VARIANTS: SectionCardVariant[] = ['default', 'danger']

export class SectionCard extends HTMLElement {
    private _initialised = false
    private _actionSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['title', 'icon', 'variant']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._actionSlotNodes = Array.from(this.querySelectorAll('[slot="action"]'))
            const bodyNodes = Array.from(this.childNodes).filter(
                (n) => !(n instanceof Element && n.getAttribute('slot') === 'action'),
            )

            this.render()

            if (this._actionSlotNodes.length > 0) {
                const actionEl = this.querySelector('.tc-section-card-action')
                if (actionEl) this._actionSlotNodes.forEach((n) => actionEl.appendChild(n))
            }

            const bodyEl = this.querySelector('.tc-section-card-body')
            if (bodyEl) bodyNodes.forEach((n) => bodyEl.appendChild(n))

            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return

        // Re-capture action slot nodes from their inner container
        const actionEl = this.querySelector('.tc-section-card-action')
        if (actionEl) {
            const inAction = Array.from(actionEl.querySelectorAll('[slot="action"]'))
            if (inAction.length > 0) this._actionSlotNodes = inAction
        }

        // Re-capture body nodes before innerHTML wipe
        const bodyEl = this.querySelector('.tc-section-card-body')
        const bodyNodes = bodyEl ? Array.from(bodyEl.childNodes) : []

        this.render()

        // Re-distribute action slot nodes
        if (this._actionSlotNodes.length > 0) {
            const newActionEl = this.querySelector('.tc-section-card-action')
            if (newActionEl) this._actionSlotNodes.forEach((n) => newActionEl.appendChild(n))
        }

        // Re-distribute body nodes
        const newBodyEl = this.querySelector('.tc-section-card-body')
        if (newBodyEl) bodyNodes.forEach((n) => newBodyEl.appendChild(n))
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        this.setAttribute('title', v)
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
        this.setAttribute('variant', v)
    }

    private render(): void {
        const titleAttr = this.getAttribute('title') ?? ''
        const iconName = this.getAttribute('icon')
        const variant = this.variant
        const hasAction = this._actionSlotNodes.length > 0

        const svgStr = iconName ? (LucideIcons as Record<string, string>)[iconName] : null
        const iconSvg = svgStr ? icon(svgStr, 'tc-section-card-icon-svg') : ''
        const iconHtml = iconSvg
            ? `<span class="tc-section-card-icon" aria-hidden="true">${iconSvg}</span>`
            : ''
        const actionHtml = hasAction ? `<div class="tc-section-card-action"></div>` : ''

        this.innerHTML = [
            `<div class="tc-section-card tc-section-card--${esc(variant)}">`,
            `<div class="tc-section-card-header">`,
            iconHtml,
            `<h3 class="tc-section-card-title">${esc(titleAttr)}</h3>`,
            actionHtml,
            `</div>`,
            `<div class="tc-section-card-body"></div>`,
            `</div>`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SectionCard
    }
}

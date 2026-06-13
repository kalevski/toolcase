import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-feature-card'

export type FeatureCardSize = 'default' | 'wide' | 'full'
const SIZES: FeatureCardSize[] = ['default', 'wide', 'full']

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function resolveIcon(name: string): string {
    const svgStr = (LucideIcons as Record<string, string>)[name]
    if (!svgStr) return ''
    return icon(svgStr)
}

export class FeatureCard extends HTMLElement {
    private _initialised = false
    private _iconSlot: Element[] = []
    private _eyebrowSlot: Element[] = []
    private _titleSlot: Element[] = []
    private _descriptionSlot: Element[] = []
    private _visualSlot: Element[] = []

    static get observedAttributes(): string[] {
        return ['icon', 'eyebrow', 'title', 'description', 'size', 'inline']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture named-slot children before render() wipes innerHTML
            this._iconSlot = Array.from(this.querySelectorAll('[slot="icon"]'))
            this._eyebrowSlot = Array.from(this.querySelectorAll('[slot="eyebrow"]'))
            this._titleSlot = Array.from(this.querySelectorAll('[slot="title"]'))
            this._descriptionSlot = Array.from(this.querySelectorAll('[slot="description"]'))
            this._visualSlot = Array.from(this.querySelectorAll('[slot="visual"]'))
            this.render()
            this._distributeSlots()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        // Re-capture from their inner containers (already moved there)
        this._iconSlot = Array.from(this.querySelectorAll('.tc-feature-card-icon [slot="icon"]'))
        this._eyebrowSlot = Array.from(this.querySelectorAll('.tc-feature-card-eyebrow [slot="eyebrow"]'))
        this._titleSlot = Array.from(this.querySelectorAll('.tc-feature-card-title [slot="title"]'))
        this._descriptionSlot = Array.from(this.querySelectorAll('.tc-feature-card-description [slot="description"]'))
        this._visualSlot = Array.from(this.querySelectorAll('.tc-feature-card-visual [slot="visual"]'))
        this.render()
        this._distributeSlots()
    }

    private _distributeSlots(): void {
        const iconEl = this.querySelector('.tc-feature-card-icon')
        if (iconEl) this._iconSlot.forEach(n => iconEl.appendChild(n))
        const eyebrowEl = this.querySelector('.tc-feature-card-eyebrow')
        if (eyebrowEl) this._eyebrowSlot.forEach(n => eyebrowEl.appendChild(n))
        const titleEl = this.querySelector('.tc-feature-card-title')
        if (titleEl) this._titleSlot.forEach(n => titleEl.appendChild(n))
        const descEl = this.querySelector('.tc-feature-card-description')
        if (descEl) this._descriptionSlot.forEach(n => descEl.appendChild(n))
        const visualEl = this.querySelector('.tc-feature-card-visual')
        if (visualEl) this._visualSlot.forEach(n => visualEl.appendChild(n))
    }

    // --- Public API ---

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get eyebrow(): string | null {
        return this.getAttribute('eyebrow')
    }
    set eyebrow(v: string | null) {
        if (v != null) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    // Override HTMLElement.title (string, not string|null) to reflect the attribute.
    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get description(): string | null {
        return this.getAttribute('description')
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    get size(): FeatureCardSize {
        const v = this.getAttribute('size') as FeatureCardSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: FeatureCardSize) {
        this.setAttribute('size', v)
    }

    get inline(): boolean {
        return this.hasAttribute('inline')
    }
    set inline(v: boolean) {
        if (v) this.setAttribute('inline', '')
        else this.removeAttribute('inline')
    }

    private render(): void {
        const sizeVal = this.size
        const isInline = this.inline

        const sizeClass = sizeVal !== 'default' ? ` tc-feature-card--${sizeVal}` : ''
        const inlineClass = isInline ? ' tc-feature-card--inline' : ''

        // Icon region: prefer slotted child, then attribute (lucide name → SVG)
        const hasIconSlot = this._iconSlot.length > 0
        const iconAttr = this.getAttribute('icon')
        const iconInner = hasIconSlot ? '' : (iconAttr ? resolveIcon(iconAttr) : '')

        // Eyebrow: prefer slotted child, then attribute text
        const hasEyebrowSlot = this._eyebrowSlot.length > 0
        const eyebrowAttr = this.getAttribute('eyebrow')
        const eyebrowInner = hasEyebrowSlot ? '' : (eyebrowAttr ? esc(eyebrowAttr) : '')

        // Title: prefer slotted child, then attribute text
        const hasTitleSlot = this._titleSlot.length > 0
        const titleAttr = this.getAttribute('title')
        const titleInner = hasTitleSlot ? '' : (titleAttr ? esc(titleAttr) : '')

        // Description: prefer slotted child, then attribute text
        const hasDescSlot = this._descriptionSlot.length > 0
        const descAttr = this.getAttribute('description')
        const descInner = hasDescSlot ? '' : (descAttr ? esc(descAttr) : '')

        this.innerHTML = [
            `<div class="tc-feature-card${sizeClass}${inlineClass}">`,
            '<div class="tc-feature-card-head">',
            `<div class="tc-feature-card-icon" aria-hidden="true">${iconInner}</div>`,
            '<div class="tc-feature-card-copy">',
            `<div class="tc-feature-card-eyebrow">${eyebrowInner}</div>`,
            `<div class="tc-feature-card-title">${titleInner}</div>`,
            `<div class="tc-feature-card-description">${descInner}</div>`,
            '</div>',
            '</div>',
            '<div class="tc-feature-card-visual"></div>',
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FeatureCard
    }
}

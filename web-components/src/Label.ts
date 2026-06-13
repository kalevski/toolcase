import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-label'

export type LabelSize = 'small' | 'default' | 'large'

const SIZES: LabelSize[] = ['small', 'default', 'large']

const infoIcon = icon((LucideIcons as Record<string, string>)['Info'] ?? '')

export class Label extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['required', 'tooltip', 'size']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-label-content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-label-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-label-content')
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
    }

    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    get tooltip(): string | null {
        return this.getAttribute('tooltip')
    }
    set tooltip(v: string | null) {
        if (v != null) this.setAttribute('tooltip', v)
        else this.removeAttribute('tooltip')
    }

    get size(): LabelSize {
        const v = this.getAttribute('size') as LabelSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: LabelSize) {
        this.setAttribute('size', v)
    }

    private render(): void {
        const required = this.required
        const tooltip = this.tooltip
        const size = this.size
        const forAttr = this.getAttribute('for')

        const sizeClass = size === 'small' ? ' tc-label-sm' : size === 'large' ? ' tc-label-lg' : ''
        const forHtml = forAttr ? ` for="${forAttr}"` : ''

        const requiredHtml = required
            ? `<span class="tc-label-required" aria-hidden="true">*</span>`
            : ''

        const tooltipHtml = tooltip
            ? `<button type="button" class="tc-label-info" aria-label="${tooltip}" title="${tooltip}">${infoIcon}</button>`
            : ''

        this.innerHTML = `<label class="form-label tc-label${sizeClass}"${forHtml}><span class="tc-label-content"></span>${requiredHtml}${tooltipHtml}</label>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Label
    }
}

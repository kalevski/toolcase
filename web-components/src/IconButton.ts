import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-icon-button'

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type IconButtonVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
export type IconButtonSize = 'small' | 'default' | 'large'

const VARIANTS: IconButtonVariant[] = ['primary', 'secondary', 'info', 'success', 'warning', 'danger']
const SIZES: IconButtonSize[] = ['small', 'default', 'large']

export class IconButton extends HTMLElement {

    private _initialised = false

    onClick: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['icon', 'size', 'variant', 'outline', 'label', 'disabled']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.addEventListener('click', this._handleClick)
            this._initialised = true
        }
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get icon(): string {
        return this.getAttribute('icon') ?? ''
    }
    set icon(v: string) {
        this.setAttribute('icon', v)
    }

    get size(): IconButtonSize {
        const v = this.getAttribute('size') as IconButtonSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: IconButtonSize) {
        this.setAttribute('size', v)
    }

    get variant(): IconButtonVariant {
        const v = this.getAttribute('variant') as IconButtonVariant
        return VARIANTS.includes(v) ? v : 'secondary'
    }
    set variant(v: IconButtonVariant) {
        this.setAttribute('variant', v)
    }

    get outline(): boolean {
        return this.hasAttribute('outline')
    }
    set outline(v: boolean) {
        if (v) this.setAttribute('outline', '')
        else this.removeAttribute('outline')
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        this.setAttribute('label', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private _handleClick = (): void => {
        if (this.disabled) return
        this.dispatchEvent(new CustomEvent('tc-click', { bubbles: true, composed: true }))
        if (typeof this.onClick === 'function') this.onClick()
    }

    private _resolveIcon(name: string): string {
        if (!name) return ''
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (!svgStr) return ''
        return icon(svgStr)
    }

    private render(): void {
        const variant = this.variant
        const size = this.size
        const outline = this.outline
        const disabled = this.disabled
        const label = this.label
        const iconName = this.getAttribute('icon') ?? ''

        const variantClass = outline ? `btn-outline-${variant}` : `btn-${variant}`
        const disabledAttr = disabled ? ' disabled' : ''
        const labelAttr = label ? ` aria-label="${esc(label)}"` : ''
        const iconHtml = this._resolveIcon(iconName)

        this.innerHTML = `<button type="button" class="tc-icon-button tc-icon-button--${size} btn ${variantClass}"${labelAttr}${disabledAttr}>${iconHtml}</button>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: IconButton
    }
}

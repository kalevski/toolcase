import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-icon-button'

export type IconButtonVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
export type IconButtonSize = 'small' | 'default' | 'large'

const VARIANTS: IconButtonVariant[] = [
    'primary',
    'secondary',
    'info',
    'success',
    'warning',
    'danger',
]
const SIZES: IconButtonSize[] = ['small', 'default', 'large']

/** Visible-label mode: `''`/`always` renders the label text beside the icon;
 *  `coarse` renders it only for coarse pointers (touch), where there is no
 *  hover tooltip to reveal what the icon does. */
export type IconButtonShowLabel = 'always' | 'coarse'

export class IconButton extends HTMLElement {
    private _initialised = false

    onClick: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['icon', 'size', 'variant', 'outline', 'label', 'disabled', 'show-label']
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

    /** `show-label` → 'always'; `show-label="coarse"` → 'coarse'; absent → null. */
    get showLabel(): IconButtonShowLabel | null {
        const v = this.getAttribute('show-label')
        if (v === null) return null
        return v === 'coarse' ? 'coarse' : 'always'
    }
    set showLabel(v: IconButtonShowLabel | null) {
        if (v === 'coarse') this.setAttribute('show-label', 'coarse')
        else if (v != null) this.setAttribute('show-label', '')
        else this.removeAttribute('show-label')
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
        const showLabel = this.showLabel
        const iconName = this.getAttribute('icon') ?? ''

        const variantClass = outline ? `btn-outline-${variant}` : `btn-${variant}`
        const disabledAttr = disabled ? ' disabled' : ''
        const labelAttr = label ? ` aria-label="${esc(label)}"` : ''
        const iconHtml = this._resolveIcon(iconName)

        // Visible label: the button grows into a normal labeled button. In
        // 'coarse' mode the text is display-gated to (pointer: coarse) by CSS —
        // desktop keeps the compact icon, touch gets words.
        const labeled = showLabel != null && label !== ''
        const labelHtml = labeled ? `<span class="tc-icon-button-label">${esc(label)}</span>` : ''
        const labeledClass = labeled
            ? showLabel === 'coarse'
                ? ' tc-icon-button--labeled-coarse'
                : ' tc-icon-button--labeled'
            : ''

        this.innerHTML = `<button type="button" class="tc-icon-button tc-icon-button--${size}${labeledClass} btn ${variantClass}"${labelAttr}${disabledAttr}>${iconHtml}${labelHtml}</button>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: IconButton
    }
}

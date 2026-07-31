import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-icon-button'

export type IconButtonVariant =
    | 'primary'
    | 'secondary'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    // The two NEUTRAL variants, added for app chrome. They are not theme colours,
    // so they render no `btn-*` class at all — `_icon-button.scss` drives them
    // through --bs-btn-* directly. `variant="outline"` therefore SUPERSEDES the
    // `outline` boolean modifier (which only means "the outline form of a theme
    // colour"); setting both is not an error, the boolean is simply ignored.
    | 'ghost'
    | 'outline'
export type IconButtonSize = 'small' | 'default' | 'large'

const VARIANTS: IconButtonVariant[] = [
    'primary',
    'secondary',
    'info',
    'success',
    'warning',
    'danger',
    'ghost',
    'outline',
]
/** Variants painted by this component rather than by a `btn-<variant>` class. */
const NEUTRAL_VARIANTS: IconButtonVariant[] = ['ghost', 'outline']
const SIZES: IconButtonSize[] = ['small', 'default', 'large']

// An icon-only control with no accessible name is invisible to a screen reader —
// it announces as "button" and nothing else. Warned once PER ICON NAME rather than
// per instance: a list of 40 rows renders 40 copies of the same unlabelled delete
// button, and 40 identical warnings hide the other 3 problems. Capped so a large
// app cannot flood the console either way.
const warnedIcons = new Set<string>()
const WARN_CAP = 24

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

    /**
     * A glyph with no words is not a control anyone can name. `label` is the
     * component's own way to supply the accessible name; an `aria-label` /
     * `aria-labelledby` / `title` written straight onto the host counts too, since
     * the host is what a consumer reaches for first.
     */
    private _warnIfUnlabelled(label: string, iconName: string): void {
        if (label) return
        if (
            this.hasAttribute('aria-label') ||
            this.hasAttribute('aria-labelledby') ||
            this.hasAttribute('title')
        ) {
            return
        }
        const key = iconName || '(no icon)'
        if (warnedIcons.has(key) || warnedIcons.size >= WARN_CAP) return
        warnedIcons.add(key)
        console.warn(
            `[${TAG_NAME}] icon="${key}" has no accessible name — a screen reader announces it as "button" and nothing else. Add label="…" (it becomes aria-label), or aria-labelledby / title on the host.`,
        )
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

        // `ghost` / `outline` are neutral chrome, not theme colours — they carry no
        // `btn-<variant>` class and are painted by the partial instead.
        const neutral = NEUTRAL_VARIANTS.includes(variant)
        const variantClass = neutral
            ? `tc-icon-button--${variant}`
            : outline
              ? `btn-outline-${variant}`
              : `btn-${variant}`
        const disabledAttr = disabled ? ' disabled' : ''
        const labelAttr = label ? ` aria-label="${esc(label)}"` : ''
        const iconHtml = this._resolveIcon(iconName)
        this._warnIfUnlabelled(label, iconName)

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

const TAG_NAME = 'tc-cool-button'

export type CoolButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
export type CoolButtonSize = 'small' | 'default' | 'large'
export type CoolButtonAddonPosition = 'left' | 'right'

const VARIANTS: CoolButtonVariant[] = ['primary', 'secondary', 'success', 'danger', 'warning', 'info']
const SIZES: CoolButtonSize[] = ['small', 'default', 'large']
const ADDON_POSITIONS: CoolButtonAddonPosition[] = ['left', 'right']

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export class CoolButton extends HTMLElement {

    private _initialised = false
    private _mainNodes: Node[] = []
    private _addonNodes: Node[] = []

    onClick: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['variant', 'size', 'outline', 'loading', 'label', 'addon', 'addon-position', 'disabled']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.addEventListener('click', this._handleClick)
        if (!this._initialised) {
            // Capture named addon-slot nodes and default slot nodes separately.
            this._addonNodes = this.hasAttribute('addon')
                ? []
                : Array.from(this.querySelectorAll('[slot="addon"]'))
            if (!this.hasAttribute('label')) {
                this._mainNodes = Array.from(this.childNodes).filter(
                    n => !(n instanceof Element && (n as Element).getAttribute('slot') === 'addon'),
                )
            }
            this.render()
            this._distributeSlots()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._handleClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        // Re-capture slot nodes from their current DOM containers before re-render.
        if (!this.hasAttribute('label')) {
            const contentEl = this.querySelector('.tc-cool-button-content')
            if (contentEl) this._mainNodes = Array.from(contentEl.childNodes).filter(n => !this._isSpinner(n))
        }
        if (!this.hasAttribute('addon')) {
            const addonEl = this.querySelector('.tc-cool-button-addon')
            if (addonEl) this._addonNodes = Array.from(addonEl.childNodes).filter(n => !this._isSpinner(n))
        }
        this.render()
        this._distributeSlots()
    }

    private _isSpinner(n: Node): boolean {
        return n instanceof Element && n.classList.contains('tc-cool-button-spinner')
    }

    private _handleClick = () => {
        const btn = this.querySelector<HTMLButtonElement>('button')
        if (btn && btn.disabled) return
        this.dispatchEvent(new CustomEvent('tc-click', {
            bubbles: true,
            composed: true,
            detail: {},
        }))
        if (typeof this.onClick === 'function') this.onClick()
    }

    private _distributeSlots(): void {
        if (!this.hasAttribute('label')) {
            const contentEl = this.querySelector('.tc-cool-button-content')
            if (contentEl) this._mainNodes.forEach(n => contentEl.appendChild(n))
        }
        if (!this.hasAttribute('addon')) {
            const addonEl = this.querySelector('.tc-cool-button-addon')
            if (addonEl) this._addonNodes.forEach(n => addonEl.appendChild(n))
        }
    }

    get variant(): CoolButtonVariant {
        const v = this.getAttribute('variant') as CoolButtonVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: CoolButtonVariant) { this.setAttribute('variant', v) }

    get size(): CoolButtonSize {
        const v = this.getAttribute('size') as CoolButtonSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: CoolButtonSize) { this.setAttribute('size', v) }

    get outline(): boolean { return this.hasAttribute('outline') }
    set outline(v: boolean) {
        if (v) this.setAttribute('outline', '')
        else this.removeAttribute('outline')
    }

    get loading(): boolean { return this.hasAttribute('loading') }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get disabled(): boolean { return this.hasAttribute('disabled') }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get label(): string | null { return this.getAttribute('label') }
    set label(v: string | null) {
        if (v !== null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get addon(): string | null { return this.getAttribute('addon') }
    set addon(v: string | null) {
        if (v !== null) this.setAttribute('addon', v)
        else this.removeAttribute('addon')
    }

    get addonPosition(): CoolButtonAddonPosition {
        const v = this.getAttribute('addon-position') as CoolButtonAddonPosition
        return ADDON_POSITIONS.includes(v) ? v : 'right'
    }
    set addonPosition(v: CoolButtonAddonPosition) { this.setAttribute('addon-position', v) }

    private render(): void {
        const variant = this.variant
        const outline = this.outline
        const size = this.size
        const disabled = this.disabled
        const loading = this.loading
        const addonPosition = this.addonPosition
        const isDisabled = disabled || loading

        const variantClass = outline ? `btn-outline-${variant}` : `btn-${variant}`
        const sizeClassMap: Record<CoolButtonSize, string> = { small: 'btn-sm', default: '', large: 'btn-lg' }
        const sizeClass = sizeClassMap[size] ? ` ${sizeClassMap[size]}` : ''
        const loadingClass = loading ? ' tc-cool-button--loading' : ''

        const hasAddon = this.hasAttribute('addon') || this._addonNodes.length > 0

        // When loading, the spinner is centred over the content region (or over the
        // addon when the addon is the leading slot). The label/glyph it covers is
        // hidden in place (kept in flow) so the button keeps its resting width — no
        // collapse, no jump. The spinner ring may use border-radius (sanctioned circle).
        const spinnerHtml = `<span class="tc-cool-button-spinner spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`
        const liveRegion = loading ? `<span class="visually-hidden" role="status">Loading…</span>` : ''

        // Label attribute text is written directly into the content span;
        // when absent the span is empty and slot children are appended after render.
        const labelText = this.hasAttribute('label') ? esc(this.label ?? '') : ''
        const contentSpan = `<span class="tc-cool-button-content">${labelText}${loading && !(hasAddon && addonPosition === 'left') ? spinnerHtml : ''}</span>`

        const addonText = this.hasAttribute('addon') ? esc(this.addon ?? '') : ''
        // While loading, the spinner replaces the leading addon glyph (sits where
        // the icon was); a trailing addon keeps its glyph and the spinner overlays
        // the label instead.
        const addonSpinner = loading && addonPosition === 'left' ? spinnerHtml : ''
        const addonSpan = `<span class="tc-cool-button-addon">${addonText}${addonSpinner}</span>`
        const dividerSpan = `<span class="tc-cool-button-divider" aria-hidden="true"></span>`

        let innerHtml: string
        if (hasAddon) {
            if (addonPosition === 'left') {
                // addon (spinner overlays glyph) | divider | content
                innerHtml = `${addonSpan}${dividerSpan}${contentSpan}`
            } else {
                // content (spinner overlays label) | divider | addon
                innerHtml = `${contentSpan}${dividerSpan}${addonSpan}`
            }
        } else {
            innerHtml = contentSpan
        }

        const disabledAttr = isDisabled ? ' disabled' : ''
        this.innerHTML = `<button type="button" class="btn ${variantClass}${sizeClass} tc-cool-button${loadingClass}"${disabledAttr}>${innerHtml}${liveRegion}</button>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CoolButton
    }
}

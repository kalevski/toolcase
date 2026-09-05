import { patchHtml } from './internal/patch-html'
import { consumerText, observeContent } from './internal/content-observer'
import { setHostClass } from './internal/host-class'
import { VARIANTS_CORE } from './internal/variants'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-cool-button'

export type CoolButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'
export type CoolButtonSize = 'small' | 'default' | 'large'
export type CoolButtonAddonPosition = 'left' | 'right'

const VARIANTS: CoolButtonVariant[] = [...VARIANTS_CORE]
const SIZES: CoolButtonSize[] = ['small', 'default', 'large']
const ADDON_POSITIONS: CoolButtonAddonPosition[] = ['left', 'right']

export class CoolButton extends HTMLElement {
    private _initialised = false

    onClick: (() => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'variant',
            'size',
            'outline',
            'loading',
            'label',
            'addon',
            'addon-position',
            'disabled',
        ]
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
        // The accessible name is a copy of the consumer's label text, so it has to
        // follow that text when React rewrites it — see content-observer.ts.
        observeContent(this, () => this.render())
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get variant(): CoolButtonVariant {
        const v = this.getAttribute('variant') as CoolButtonVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: CoolButtonVariant) {
        setAttr(this, 'variant', v)
    }

    get size(): CoolButtonSize {
        const v = this.getAttribute('size') as CoolButtonSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: CoolButtonSize) {
        setAttr(this, 'size', v)
    }

    get outline(): boolean {
        return this.hasAttribute('outline')
    }
    set outline(v: boolean) {
        if (v) this.setAttribute('outline', '')
        else this.removeAttribute('outline')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v !== null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get addon(): string | null {
        return this.getAttribute('addon')
    }
    set addon(v: string | null) {
        if (v !== null) this.setAttribute('addon', v)
        else this.removeAttribute('addon')
    }

    get addonPosition(): CoolButtonAddonPosition {
        const v = this.getAttribute('addon-position') as CoolButtonAddonPosition
        return ADDON_POSITIONS.includes(v) ? v : 'right'
    }
    set addonPosition(v: CoolButtonAddonPosition) {
        setAttr(this, 'addon-position', v)
    }

    private render(): void {
        const variant = this.variant
        const outline = this.outline
        const size = this.size
        const disabled = this.disabled
        const loading = this.loading
        const addonPosition = this.addonPosition
        const isDisabled = disabled || loading

        const variantClass = outline ? `btn-outline-${variant}` : `btn-${variant}`
        const sizeClassMap: Record<CoolButtonSize, string> = {
            small: 'btn-sm',
            default: '',
            large: 'btn-lg',
        }
        const sizeClass = sizeClassMap[size] ? ` ${sizeClassMap[size]}` : ''
        const loadingClass = loading ? ' tc-cool-button--loading' : ''

        const hasAddon =
            this.hasAttribute('addon') || this.querySelector(':scope > [slot="addon"]') != null

        // When loading, the spinner is centred over the content region (or over the
        // addon when the addon is the leading slot). The label/glyph it covers is
        // hidden in place (kept in flow) so the button keeps its resting width — no
        // collapse, no jump. The spinner ring may use border-radius (sanctioned circle).
        const spinnerHtml = `<span class="tc-cool-button-spinner spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`
        const liveRegion = loading
            ? `<span class="visually-hidden" role="status">Loading…</span>`
            : ''

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
        const disabledClass = isDisabled ? ' disabled' : ''
        // THE HOST IS THE BUTTON BOX and the control is stretched over it as a hit
        // overlay — the same shape tc-button uses — so the inner regions and any
        // slotted `slot="addon"` element lay out in the host's own flow and nothing
        // the consumer wrote is ever moved into the button (rule 1).
        const label = consumerText(this)
        const nameAttr = label ? ` aria-label="${esc(label)}"` : ''
        setHostClass(
            this,
            `tc-button-host tc-cool-button-host btn ${variantClass}${sizeClass} tc-cool-button${loadingClass}${disabledClass}`,
        )
        patchHtml(
            this,
            `<button type="button" class="tc-button-hit tc-hit-overlay"${disabledAttr}${nameAttr}></button>`,
            { region: 'control' },
        )
        patchHtml(this, `${innerHtml}${liveRegion}`, { region: 'label' })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CoolButton
    }
}

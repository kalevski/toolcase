import { VARIANTS_FULL } from './internal/variants'
const TAG_NAME = 'tc-button'

export type ButtonVariant =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'light'
    | 'dark'
export type ButtonSize = 'sm' | 'lg'
export type ButtonType = 'button' | 'submit' | 'reset'

const VARIANTS: ButtonVariant[] = [...VARIANTS_FULL]
const SIZES: ButtonSize[] = ['sm', 'lg']

export class Button extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'outline', 'size', 'disabled', 'loading', 'href', 'type', 'skin']
    }

    // `skin="metal"` (and the tc-metal-button alias) render the brushed-metal
    // button skin — its own `tc-metal-button__btn` class scheme with the
    // default/primary/danger/ghost variants and sm/md/lg sizes.
    get skin(): 'default' | 'metal' {
        return this.getAttribute('skin') === 'metal' || this.localName === 'tc-metal-button'
            ? 'metal'
            : 'default'
    }
    set skin(v: 'default' | 'metal') {
        if (v === 'metal') this.setAttribute('skin', 'metal')
        else this.removeAttribute('skin')
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-button-content')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const control = this.firstElementChild as HTMLElement | null
        const content = this.querySelector('.tc-button-content')
        const wantAnchor = this.href != null
        const isAnchor = control?.tagName === 'A'

        // Structural changes (metal skin, or switching between <a> and <button>)
        // can't be patched in place — fall back to a full re-render, preserving the
        // slotted content's child nodes across it.
        if (!control || !content || this.skin === 'metal' || wantAnchor !== isAnchor) {
            const slotContent = content ? Array.from(content.childNodes) : []
            this.render()
            const newInner = this.querySelector('.tc-button-content')
            if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
            return
        }

        // Cosmetic/state attribute change (variant, outline, size, disabled,
        // loading, type): patch the existing control IN PLACE. Rewriting innerHTML
        // here would detach the `.tc-button-content` node — and any framework-managed
        // children inside it (e.g. React's text/elements) — which then fights the
        // host's DOM reconciliation and blanks the button on the next render.
        const variant = this.variant
        const outline = this.outline
        const size = this.size
        const isDisabled = this.disabled || this.loading
        control.className =
            `btn ${outline ? `btn-outline-${variant}` : `btn-${variant}`}${size ? ` btn-${size}` : ''}` +
            (wantAnchor && isDisabled ? ' disabled' : '')

        if (wantAnchor) {
            control.setAttribute('href', this.href as string)
            if (isDisabled) {
                control.setAttribute('aria-disabled', 'true')
                control.setAttribute('tabindex', '-1')
            } else {
                control.removeAttribute('aria-disabled')
                control.removeAttribute('tabindex')
            }
        } else {
            control.setAttribute('type', this.type)
            if (isDisabled) control.setAttribute('disabled', '')
            else control.removeAttribute('disabled')
        }

        // The loading spinner sits just before `.tc-button-content`.
        const spinner = control.querySelector(':scope > .spinner-border')
        if (this.loading && !spinner) {
            const s = document.createElement('span')
            s.className = 'spinner-border spinner-border-sm'
            s.setAttribute('role', 'status')
            s.setAttribute('aria-hidden', 'true')
            control.insertBefore(s, content)
        } else if (!this.loading && spinner) {
            spinner.remove()
        }
    }

    get variant(): ButtonVariant {
        const v = this.getAttribute('variant') as ButtonVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: ButtonVariant) {
        this.setAttribute('variant', v)
    }

    get outline(): boolean {
        return this.hasAttribute('outline')
    }
    set outline(v: boolean) {
        if (v) this.setAttribute('outline', '')
        else this.removeAttribute('outline')
    }

    get size(): ButtonSize | null {
        const v = this.getAttribute('size') as ButtonSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: ButtonSize | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get href(): string | null {
        return this.getAttribute('href')
    }
    set href(v: string | null) {
        if (v != null) this.setAttribute('href', v)
        else this.removeAttribute('href')
    }

    get type(): ButtonType {
        const v = this.getAttribute('type') as ButtonType
        return v === 'submit' || v === 'reset' ? v : 'button'
    }
    set type(v: ButtonType) {
        this.setAttribute('type', v)
    }

    private render(): void {
        // Metal skin — distinct class scheme; its own variant/size sets. Shares the
        // `.tc-button-content` slot wrapper so the base slot-capture still works.
        if (this.skin === 'metal') {
            const metalVariants = ['default', 'primary', 'danger', 'ghost']
            const rawV = this.getAttribute('variant') ?? ''
            const mv = metalVariants.includes(rawV) ? rawV : 'default'
            const metalSizes = ['sm', 'md', 'lg']
            const rawS = this.getAttribute('size') ?? ''
            const ms = metalSizes.includes(rawS) ? rawS : 'md'
            const sizeClass = ms !== 'md' ? ` tc-metal-button__btn--${ms}` : ''
            const disabledAttr = this.disabled ? ' disabled' : ''
            this.innerHTML = `<button type="button" class="tc-metal-button__btn tc-metal-button__btn--${mv}${sizeClass}"${disabledAttr}><span class="tc-button-content"></span></button>`
            return
        }

        const variant = this.variant
        const outline = this.outline
        const size = this.size
        const disabled = this.disabled
        const loading = this.loading
        const href = this.href
        const isDisabled = disabled || loading

        const variantClass = outline ? `btn-outline-${variant}` : `btn-${variant}`
        const sizeClass = size ? ` btn-${size}` : ''
        const classes = `btn ${variantClass}${sizeClass}`

        const spinnerHtml = loading
            ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`
            : ''

        if (href != null) {
            const disabledAttr = isDisabled ? ' aria-disabled="true" tabindex="-1"' : ''
            const disabledClass = isDisabled ? ' disabled' : ''
            this.innerHTML = `<a href="${href}" class="${classes}${disabledClass}" role="button"${disabledAttr}>${spinnerHtml}<span class="tc-button-content"></span></a>`
        } else {
            const disabledAttr = isDisabled ? ' disabled' : ''
            const typeAttr = this.type
            this.innerHTML = `<button type="${typeAttr}" class="${classes}"${disabledAttr}>${spinnerHtml}<span class="tc-button-content"></span></button>`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Button
    }
}

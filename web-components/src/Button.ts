import { VARIANTS_FULL } from './internal/variants'
import { fieldMessageHtml, type FieldMessageState } from './internal/field-message'
const TAG_NAME = 'tc-button'

const has = (v: string | null | undefined): v is string => v != null && v !== ''

export type ButtonVariant =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'light'
    | 'dark'
// `xl` is the 66px thumb tier — the phone design's step-advance target. A NEW tier
// rather than a taller `lg`, which is the CTA size on every landing page consuming
// this library; see the note in style/components/_button.scss.
export type ButtonSize = 'sm' | 'lg' | 'xl'
export type ButtonType = 'button' | 'submit' | 'reset'

const VARIANTS: ButtonVariant[] = [...VARIANTS_FULL]
const SIZES: ButtonSize[] = ['sm', 'lg', 'xl']

const WRAPPER_SELECTOR = ':scope > .btn, :scope > .tc-metal-button__btn'

export class Button extends HTMLElement {
    private _initialised = false
    // Watches the host's direct children. React renders button text as a single
    // host text child; when that text changes it does `host.textContent = …`, which
    // nukes our rendered `.btn` wrapper. The observer detects that reset and
    // rebuilds the wrapper, re-homing the live content into `.tc-button-content`.
    private _observer: MutationObserver | null = null

    static get observedAttributes(): string[] {
        return [
            'variant', 'outline', 'size', 'disabled', 'loading', 'href', 'type', 'skin',
            // Full-width mode. Pure CSS state (see _button.scss) — observed only so
            // scripts/gen-react-types.mjs types it as a JSX prop; it reads this list.
            'block',
            // Reserved field-message slot (shared form-field contract) — lets a button
            // align with adjacent tc-input/tc-select in a form row.
            'field', 'help', 'error', 'state',
        ]
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
            this._renderWith(Array.from(this.childNodes))
            this._initialised = true
            this._observer = new MutationObserver(() => this._resync())
        }
        // (Re)start observing on connect / reconnect (React may move the node).
        this._observer?.observe(this, { childList: true })
    }

    disconnectedCallback(): void {
        this._observer?.disconnect()
    }

    /** Render the wrapper, then move `content` into `.tc-button-content`, with the
     *  observer paused so our own writes don't re-trigger `_resync`. */
    private _renderWith(content: Node[]): void {
        this._observer?.disconnect()
        this.render()
        const inner = this.querySelector('.tc-button-content')
        if (inner) content.forEach((n) => inner.appendChild(n))
        this._observer?.takeRecords() // discard the mutations we just caused
        if (this.isConnected) this._observer?.observe(this, { childList: true })
    }

    /** Called when the host's direct children change from outside (React). If the
     *  framework wiped our wrapper (e.g. via `textContent`) or dropped a stray node
     *  beside it, recapture the real content and rebuild. */
    private _resync(): void {
        const wrapper = this.querySelector(WRAPPER_SELECTOR)
        const inner = this.querySelector('.tc-button-content')
        if (wrapper && inner) {
            // The reserved `.tc-field-message` slot is a legitimate sibling of the
            // control — never fold it into the content.
            const strays = Array.from(this.childNodes).filter(
                (n) => n !== wrapper && !(n instanceof Element && n.classList.contains('tc-field-message')),
            )
            if (!strays.length) return
            // A child landed directly under the host — fold it into the content slot.
            this._observer?.disconnect()
            strays.forEach((n) => inner.appendChild(n))
            this._observer?.takeRecords()
            if (this.isConnected) this._observer?.observe(this, { childList: true })
            return
        }
        // Wrapper gone — the current direct children ARE the live content.
        this._renderWith(Array.from(this.childNodes))
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
            this._renderWith(slotContent)
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

        // Reserved field-message slot (field / help / error / state changes).
        this._syncFieldMessage()
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

    /** Full-width, centred content — the shape of every action-bar and sheet-footer
     *  action in the phone design. Pure CSS state; no re-render needed. */
    get block(): boolean {
        return this.hasAttribute('block')
    }
    set block(v: boolean) {
        if (v) this.setAttribute('block', '')
        else this.removeAttribute('block')
    }

    // ── reserved field-message slot (shared form-field contract) ────────────────
    // Always reserves one line of height when present, so a button lines up with
    // adjacent form inputs without a margin hack. Opt in with the `field` boolean,
    // or implicitly by setting `help` / `error` / `state`.

    get field(): boolean {
        return this.hasAttribute('field')
    }
    set field(v: boolean) {
        if (v) this.setAttribute('field', '')
        else this.removeAttribute('field')
    }

    get help(): string | null {
        return this.getAttribute('help')
    }
    set help(v: string | null) {
        if (v != null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    get state(): FieldMessageState {
        const v = this.getAttribute('state')
        return v === 'valid' || v === 'invalid' ? v : null
    }
    set state(v: FieldMessageState) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    /** The reserved `.tc-field-message` markup, or `''` when the button isn't a field. */
    private _fieldMessageMarkup(): string {
        const show = this.field || has(this.help) || has(this.error) || this.state != null
        if (!show) return ''
        return fieldMessageHtml({
            hint: this.help ?? undefined,
            error: this.error ?? undefined,
            state: this.state,
        })
    }

    /** Patch the message slot in place (observer paused) on a field-attr change. */
    private _syncFieldMessage(): void {
        const desired = this._fieldMessageMarkup()
        const existing = this.querySelector(':scope > .tc-field-message')
        this._observer?.disconnect()
        if (!desired) existing?.remove()
        else if (existing) existing.outerHTML = desired
        else this.insertAdjacentHTML('beforeend', desired)
        this._observer?.takeRecords()
        if (this.isConnected) this._observer?.observe(this, { childList: true })
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
            this.innerHTML = `<button type="button" class="tc-metal-button__btn tc-metal-button__btn--${mv}${sizeClass}"${disabledAttr}><span class="tc-button-content"></span></button>${this._fieldMessageMarkup()}`
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
            this.innerHTML = `<a href="${href}" class="${classes}${disabledClass}" role="button"${disabledAttr}>${spinnerHtml}<span class="tc-button-content"></span></a>${this._fieldMessageMarkup()}`
        } else {
            const disabledAttr = isDisabled ? ' disabled' : ''
            const typeAttr = this.type
            this.innerHTML = `<button type="${typeAttr}" class="${classes}"${disabledAttr}>${spinnerHtml}<span class="tc-button-content"></span></button>${this._fieldMessageMarkup()}`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Button
    }
}

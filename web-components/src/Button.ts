import { patchHtml } from './internal/patch-html'
import { consumerText, observeContent } from './internal/content-observer'
import { esc } from './internal/esc'
import { setHostClass } from './internal/host-class'
import { VARIANTS_FULL } from './internal/variants'
import { fieldMessageHtml, type FieldMessageState } from './internal/field-message'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-button'

const has = (v: string | null | undefined): v is string => v != null && v !== ''

export type ButtonVariant =
    'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'
// `xl` is the 66px thumb tier — the phone design's step-advance target. A NEW tier
// rather than a taller `lg`, which is the CTA size on every landing page consuming
// this library; see the note in style/components/_button.scss.
export type ButtonSize = 'sm' | 'lg' | 'xl'
export type ButtonType = 'button' | 'submit' | 'reset'

const VARIANTS: ButtonVariant[] = [...VARIANTS_FULL]
const SIZES: ButtonSize[] = ['sm', 'lg', 'xl']

export class Button extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return [
            'variant',
            'outline',
            'size',
            'disabled',
            'loading',
            'href',
            'type',
            'skin',
            // Full-width mode. Pure CSS state (see _button.scss) — observed only so
            // scripts/gen-react-types.mjs types it as a JSX prop; it reads this list.
            'block',
            // Reserved field-message slot (shared form-field contract) — lets a button
            // align with adjacent tc-input/tc-select in a form row.
            'field',
            'help',
            'error',
            'state',
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

    get variant(): ButtonVariant {
        const v = this.getAttribute('variant') as ButtonVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: ButtonVariant) {
        setAttr(this, 'variant', v)
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
        setAttr(this, 'type', v)
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

    /**
     * THE HOST IS THE BUTTON BOX. The real `<button>`/`<a>` is stretched over it as
     * a hit overlay (`.tc-hit-overlay`) instead of wrapping the consumer's children
     * — the same shape tc-link, tc-nav-item and tc-list-group-item use. The host
     * carries the `.btn` chrome, so the label lays out in the host's own flow and
     * stays exactly where react-dom put it (rule 1).
     *
     * The chrome cannot live on the control and the label cannot be overlaid on top
     * of it: `<tc-button>Save</tc-button>` is a BARE TEXT node, an anonymous box no
     * selector can reach, so it can never be given the control's grid cell or an
     * absolute position — it would simply land beside the button.
     */
    private render(): void {
        const label = consumerText(this)
        const nameAttr = label ? ` aria-label="${esc(label)}"` : ''

        // Metal skin — distinct class scheme; its own variant/size sets.
        if (this.skin === 'metal') {
            const metalVariants = ['default', 'primary', 'danger', 'ghost']
            const rawV = this.getAttribute('variant') ?? ''
            const mv = metalVariants.includes(rawV) ? rawV : 'default'
            const metalSizes = ['sm', 'md', 'lg']
            const rawS = this.getAttribute('size') ?? ''
            const ms = metalSizes.includes(rawS) ? rawS : 'md'
            const sizeClass = ms !== 'md' ? ` tc-metal-button__btn--${ms}` : ''
            const disabledAttr = this.disabled ? ' disabled' : ''
            // `disabled` as a CLASS as well as an attribute: the attribute is on the
            // overlay, but the box that has to dim and stop swallowing the pointer is
            // the host.
            const disabledClass = this.disabled ? ' disabled' : ''
            setHostClass(
                this,
                `tc-button-host tc-metal-button__btn tc-metal-button__btn--${mv}${sizeClass}${disabledClass}`,
            )
            patchHtml(
                this,
                `<button type="button" class="tc-button-hit tc-hit-overlay"${disabledAttr}${nameAttr}></button>`,
                { region: 'control' },
            )
            patchHtml(this, this._fieldMessageMarkup(), { region: 'message', at: 'end' })
            return
        }

        const variant = this.variant
        const outline = this.outline
        const size = this.size
        const isDisabled = this.disabled || this.loading
        const href = this.href

        const variantClass = outline ? `btn-outline-${variant}` : `btn-${variant}`
        const sizeClass = size ? ` btn-${size}` : ''
        const disabledClass = isDisabled ? ' disabled' : ''

        const spinnerHtml = this.loading
            ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`
            : ''

        setHostClass(this, `tc-button-host btn ${variantClass}${sizeClass}${disabledClass}`)
        if (href != null) {
            const disabledAttr = isDisabled ? ' aria-disabled="true" tabindex="-1"' : ''
            patchHtml(
                this,
                `<a href="${esc(href)}" class="tc-button-hit tc-hit-overlay" role="button"${disabledAttr}${nameAttr}></a>`,
                { region: 'control' },
            )
        } else {
            const disabledAttr = isDisabled ? ' disabled' : ''
            patchHtml(
                this,
                `<button type="${this.type}" class="tc-button-hit tc-hit-overlay"${disabledAttr}${nameAttr}></button>`,
                { region: 'control' },
            )
        }
        // The spinner is the element's own and sits in the host's flow beside the
        // consumer's label, not inside the overlay.
        patchHtml(this, spinnerHtml, { region: 'spinner' })
        patchHtml(this, this._fieldMessageMarkup(), { region: 'message', at: 'end' })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Button
    }
}

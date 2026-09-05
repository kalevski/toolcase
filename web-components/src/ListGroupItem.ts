import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { VARIANTS_FULL } from './internal/variants'
import { setHostClass } from './internal/host-class'
const TAG_NAME = 'tc-list-group-item'

export type ListGroupItemVariant =
    'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'

const VARIANTS: ListGroupItemVariant[] = [...VARIANTS_FULL]

export class ListGroupItem extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['active', 'disabled', 'variant', 'action', 'href']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get active(): boolean {
        return this.hasAttribute('active')
    }
    set active(v: boolean) {
        if (v) this.setAttribute('active', '')
        else this.removeAttribute('active')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get variant(): ListGroupItemVariant | null {
        const v = this.getAttribute('variant') as ListGroupItemVariant
        return VARIANTS.includes(v) ? v : null
    }
    set variant(v: ListGroupItemVariant | null) {
        if (v != null) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }

    get action(): boolean {
        return this.hasAttribute('action')
    }
    set action(v: boolean) {
        if (v) this.setAttribute('action', '')
        else this.removeAttribute('action')
    }

    get href(): string | null {
        return this.getAttribute('href')
    }
    set href(v: string | null) {
        if (v != null) this.setAttribute('href', v)
        else this.removeAttribute('href')
    }

    private render(): void {
        const active = this.hasAttribute('active')
        const disabled = this.hasAttribute('disabled')
        const variant = this.getAttribute('variant') as ListGroupItemVariant
        const action = this.hasAttribute('action')
        const href = this.getAttribute('href')
        const isInteractive = href != null || action

        const classes = ['list-group-item']
        if (isInteractive) classes.push('list-group-item-action')
        if (variant && VARIANTS.includes(variant)) classes.push(`list-group-item-${variant}`)
        if (active) classes.push('active')
        if (disabled) classes.push('disabled')

        setHostClass(this, classes.join(' '))

        if (active) {
            this.setAttribute('aria-current', 'true')
        } else {
            this.removeAttribute('aria-current')
        }

        if (disabled) {
            this.setAttribute('aria-disabled', 'true')
        } else {
            this.removeAttribute('aria-disabled')
        }

        // The interactive affordance is a stretched overlay rather than a wrapper:
        // the consumer's children stay direct children of the host (rule 1) and the
        // real <a>/<button> still owns keyboard focus, middle-click and the context
        // menu. Its accessible name comes from the content it covers.
        const label = (this.textContent ?? '').trim()
        const nameAttr = label ? ` aria-label="${esc(label)}"` : ''
        if (href != null) {
            const disabledAttr = disabled ? ' tabindex="-1"' : ''
            patchHtml(
                this,
                `<a href="${esc(href)}" class="tc-lgi-content tc-lgi-hit"${disabledAttr}${nameAttr}></a>`,
            )
        } else if (action) {
            const disabledAttr = disabled ? ' disabled' : ''
            patchHtml(
                this,
                `<button type="button" class="tc-lgi-content tc-lgi-hit"${disabledAttr}${nameAttr}></button>`,
            )
        } else {
            patchHtml(this, '')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ListGroupItem
    }
}

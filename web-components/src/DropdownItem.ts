import { patchHtml } from './internal/patch-html'
import { consumerText } from './internal/content-observer'
import { esc } from './internal/esc'
import { setHostClass } from './internal/host-class'
import { LinkItemBase } from './internal/link-item'

const TAG_NAME = 'tc-dropdown-item'

/**
 * tc-dropdown-item — a single dropdown menu entry on the shared
 * {@link LinkItemBase} slot-wrapping scaffold. Renders an `<li>`-wrapped `<a>`
 * (when `href` is set) or `<button>`, honouring `active` / `disabled`, or a
 * `<hr class="dropdown-divider">` when `divider` is present.
 */
export class DropdownItem extends LinkItemBase {
    static get observedAttributes(): string[] {
        return ['href', 'active', 'disabled', 'divider']
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get divider(): boolean {
        return this.hasAttribute('divider')
    }
    set divider(v: boolean) {
        if (v) this.setAttribute('divider', '')
        else this.removeAttribute('divider')
    }

    protected _unusedGetContentEl(): HTMLElement | null {
        if (this.hasAttribute('divider')) return null
        return this.querySelector<HTMLElement>('a, button')
    }

    protected render(): void {
        if (this.hasAttribute('divider')) {
            // Clear any `dropdown-item …` classes a previous (non-divider) render
            // left on the host — otherwise toggling `divider` on at runtime leaves
            // the flex/padding/colour treatment applied to the <hr>.
            setHostClass(this, '')
            patchHtml(this, `<hr class="dropdown-divider">`)
            return
        }

        const href = this.getAttribute('href')
        const isActive = this.hasAttribute('active')
        const isDisabled = this.hasAttribute('disabled')
        const activeClass = isActive ? ' active' : ''
        const disabledClass = isDisabled ? ' disabled' : ''
        const classes = `dropdown-item${activeClass}${disabledClass}`

        // The control is stretched over the row instead of wrapped around the
        // consumer's label (rule 1); the host itself is the row, so the real
        // `.dropdown-item` (flex layout, padding, colour, hover/active/disabled
        // states, the 44px coarse-pointer touch target) goes on the HOST, not on
        // the overlay — the overlay has no visible content of its own, and giving
        // it the same class would paint its hover/active background OVER the
        // label, since an absolutely-positioned box always paints after in-flow
        // content regardless of DOM order (matches tc-list-group-item /
        // tc-nav-item, which put their real Bootstrap class on the host too).
        const label = consumerText(this)
        const nameAttr = label ? ` aria-label="${esc(label)}"` : ''
        setHostClass(this, classes)
        if (href != null) {
            const ariaDisabled = isDisabled ? ' aria-disabled="true" tabindex="-1"' : ''
            const ariaCurrent = isActive ? ' aria-current="true"' : ''
            patchHtml(
                this,
                `<a href="${esc(href)}" class="tc-hit-overlay"${ariaDisabled}${ariaCurrent}${nameAttr}></a>`,
            )
        } else {
            const disabledAttr = isDisabled ? ' disabled' : ''
            patchHtml(
                this,
                `<button type="button" class="tc-hit-overlay"${disabledAttr}${nameAttr}></button>`,
            )
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DropdownItem
    }
}

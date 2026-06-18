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

    protected getContentEl(): HTMLElement | null {
        if (this.hasAttribute('divider')) return null
        return this.querySelector<HTMLElement>('a, button')
    }

    protected render(): void {
        if (this.hasAttribute('divider')) {
            this.innerHTML = `<li><hr class="dropdown-divider"></li>`
            return
        }

        const href = this.getAttribute('href')
        const isActive = this.hasAttribute('active')
        const isDisabled = this.hasAttribute('disabled')
        const activeClass = isActive ? ' active' : ''
        const disabledClass = isDisabled ? ' disabled' : ''
        const classes = `dropdown-item${activeClass}${disabledClass}`

        if (href != null) {
            const ariaDisabled = isDisabled ? ' aria-disabled="true" tabindex="-1"' : ''
            const ariaCurrent = isActive ? ' aria-current="true"' : ''
            this.innerHTML = `<li><a href="${href}" class="${classes}"${ariaDisabled}${ariaCurrent}></a></li>`
        } else {
            const disabledAttr = isDisabled ? ' disabled' : ''
            this.innerHTML = `<li><button type="button" class="${classes}"${disabledAttr}></button></li>`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DropdownItem
    }
}

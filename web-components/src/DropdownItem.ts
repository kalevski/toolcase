const TAG_NAME = 'tc-dropdown-item'

export class DropdownItem extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['href', 'active', 'disabled', 'divider']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            if (!this.hasAttribute('divider')) {
                const inner = this.querySelector<HTMLElement>('a, button')
                if (inner) slotContent.forEach(n => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector<HTMLElement>('a, button')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        if (!this.hasAttribute('divider')) {
            const newInner = this.querySelector<HTMLElement>('a, button')
            if (newInner) slotContent.forEach(n => newInner.appendChild(n))
        }
    }

    get href(): string | null {
        return this.getAttribute('href')
    }
    set href(v: string | null) {
        if (v != null) this.setAttribute('href', v)
        else this.removeAttribute('href')
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

    get divider(): boolean {
        return this.hasAttribute('divider')
    }
    set divider(v: boolean) {
        if (v) this.setAttribute('divider', '')
        else this.removeAttribute('divider')
    }

    private render(): void {
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

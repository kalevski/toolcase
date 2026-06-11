const TAG_NAME = 'tc-breadcrumb-item'

export class BreadcrumbItem extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['href', 'active']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-breadcrumb-item-content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-breadcrumb-item-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-breadcrumb-item-content')
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
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

    private render(): void {
        const active = this.active
        const href = this.getAttribute('href')

        this.classList.add('breadcrumb-item')
        this.classList.toggle('active', active)

        if (active) {
            this.setAttribute('aria-current', 'page')
        } else {
            this.removeAttribute('aria-current')
        }

        if (!active && href != null) {
            this.innerHTML = `<a href="${href}" class="tc-breadcrumb-item-content"></a>`
        } else {
            this.innerHTML = `<span class="tc-breadcrumb-item-content"></span>`
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BreadcrumbItem
    }
}

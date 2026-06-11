const TAG_NAME = 'tc-nav'

export class Nav extends HTMLElement {

    private _ul: HTMLUListElement | null = null
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'fill', 'justified', 'vertical']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const ul = this._ul
            if (ul) slotContent.forEach(n => ul.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const ul = this._ul
        const slotContent = ul ? Array.from(ul.childNodes) : []
        this.render()
        const newUl = this._ul
        if (newUl) slotContent.forEach(n => newUl.appendChild(n))
        this._syncNavItems()
    }

    get variant(): string {
        return this.getAttribute('variant') ?? ''
    }
    set variant(v: string) {
        this.setAttribute('variant', v)
    }

    get fill(): boolean {
        return this.hasAttribute('fill')
    }
    set fill(v: boolean) {
        if (v) this.setAttribute('fill', '')
        else this.removeAttribute('fill')
    }

    get justified(): boolean {
        return this.hasAttribute('justified')
    }
    set justified(v: boolean) {
        if (v) this.setAttribute('justified', '')
        else this.removeAttribute('justified')
    }

    get vertical(): boolean {
        return this.hasAttribute('vertical')
    }
    set vertical(v: boolean) {
        if (v) this.setAttribute('vertical', '')
        else this.removeAttribute('vertical')
    }

    private _syncNavItems(): void {
        this._ul?.querySelectorAll('tc-nav-item').forEach((item: any) => {
            item._parentVariantChanged?.()
        })
    }

    private render(): void {
        const variant = this.getAttribute('variant')
        const classes = ['nav']
        if (variant === 'tabs') classes.push('nav-tabs')
        else if (variant === 'pills') classes.push('nav-pills')
        else if (variant === 'underline') classes.push('nav-underline')
        if (this.hasAttribute('fill')) classes.push('nav-fill')
        if (this.hasAttribute('justified')) classes.push('nav-justified')
        if (this.hasAttribute('vertical')) classes.push('flex-column')

        const ul = document.createElement('ul')
        ul.className = classes.join(' ')
        this.innerHTML = ''
        this.appendChild(ul)
        this._ul = ul
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Nav
    }
}

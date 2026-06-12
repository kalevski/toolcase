import { Collapse as BsCollapse } from './internal/Collapse'

const TAG_NAME = 'tc-navbar'

let _uid = 0

export class Navbar extends HTMLElement {

    private _bsCollapse: BsCollapse | null = null
    private _collapseEl: HTMLElement | null = null
    private _navContent: Node[] = []
    private _initialised = false
    private _collapseId: string

    static get observedAttributes(): string[] {
        return ['brand', 'expand', 'variant', 'bg', 'fixed', 'sticky']
    }

    constructor() {
        super()
        this._collapseId = `tc-navbar-collapse-${++_uid}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._navContent = Array.from(this.childNodes)
            this._initialised = true
        }
        this.render()
        this._initPlugin()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._teardown()
        this.render()
        this._initPlugin()
    }

    get brand(): string {
        return this.getAttribute('brand') ?? ''
    }
    set brand(v: string) {
        this.setAttribute('brand', v)
    }

    get expand(): string {
        return this.getAttribute('expand') ?? 'lg'
    }
    set expand(v: string) {
        this.setAttribute('expand', v)
    }

    get variant(): string {
        return this.getAttribute('variant') ?? ''
    }
    set variant(v: string) {
        if (v) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }

    get bg(): string {
        return this.getAttribute('bg') ?? ''
    }
    set bg(v: string) {
        if (v) this.setAttribute('bg', v)
        else this.removeAttribute('bg')
    }

    get fixed(): string {
        return this.getAttribute('fixed') ?? ''
    }
    set fixed(v: string) {
        if (v) this.setAttribute('fixed', v)
        else this.removeAttribute('fixed')
    }

    get sticky(): string {
        return this.getAttribute('sticky') ?? ''
    }
    set sticky(v: string) {
        if (v) this.setAttribute('sticky', v)
        else this.removeAttribute('sticky')
    }

    private render(): void {
        const brand = this.getAttribute('brand') ?? ''
        const expand = this.getAttribute('expand') ?? 'lg'
        const variant = this.getAttribute('variant')
        const bg = this.getAttribute('bg')
        const fixed = this.getAttribute('fixed')
        const sticky = this.getAttribute('sticky')

        const classes = ['navbar', `navbar-expand-${expand}`]
        if (bg) classes.push(`bg-${bg}`)
        if (fixed) classes.push(`fixed-${fixed}`)
        if (sticky) classes.push(`sticky-${sticky}`)

        this.className = classes.join(' ')
        if (variant) {
            this.setAttribute('data-bs-theme', variant)
        } else {
            this.removeAttribute('data-bs-theme')
        }

        const brandHtml = brand
            ? `<a class="navbar-brand" href="#">` +
              `<span class="navbar-brand-dot"></span>` +
              `${this._escape(brand)}</a>`
            : ''
        const id = this._collapseId

        this.innerHTML =
            `<div class="container-fluid">` +
            brandHtml +
            `<button class="navbar-toggler" type="button" data-bs-toggle="collapse"` +
            ` data-bs-target="#${id}" aria-controls="${id}"` +
            ` aria-expanded="false" aria-label="Toggle navigation">` +
            `<span class="navbar-toggler-icon"></span>` +
            `</button>` +
            `<div class="collapse navbar-collapse" id="${id}"></div>` +
            `</div>`

        const collapseEl = this.querySelector<HTMLElement>(`#${id}`)
        this._collapseEl = collapseEl
        if (collapseEl) {
            this._navContent.forEach(n => collapseEl.appendChild(n))
        }
    }

    private _initPlugin(): void {
        const el = this._collapseEl
        if (!el) return
        this._bsCollapse = new BsCollapse(el, { toggle: false })
    }

    private _teardown(): void {
        if (this._bsCollapse) {
            this._bsCollapse.dispose()
            this._bsCollapse = null
        }
    }

    private _escape(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Navbar
    }
}

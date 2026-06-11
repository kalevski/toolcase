import { Collapse as BsCollapse } from 'bootstrap'

const TAG_NAME = 'tc-collapse'

export class Collapse extends HTMLElement {

    private _bsCollapse: BsCollapse | null = null
    private _collapseEl: HTMLElement | null = null
    private _initialised = false
    private _syncing = false

    static get observedAttributes(): string[] {
        return ['open', 'horizontal']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this._collapseEl
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
        this._initPlugin()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised || this._syncing) return
        if (name === 'horizontal') {
            const inner = this._collapseEl
            const slotContent = inner ? Array.from(inner.childNodes) : []
            this._teardown()
            this.render()
            const newInner = this._collapseEl
            if (newInner) slotContent.forEach(n => newInner.appendChild(n))
            this._initPlugin()
        } else if (name === 'open') {
            if (this.open) {
                this._bsCollapse?.show()
            } else {
                this._bsCollapse?.hide()
            }
        }
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get horizontal(): boolean {
        return this.hasAttribute('horizontal')
    }
    set horizontal(v: boolean) {
        if (v) this.setAttribute('horizontal', '')
        else this.removeAttribute('horizontal')
    }

    show(): void {
        this._bsCollapse?.show()
    }

    hide(): void {
        this._bsCollapse?.hide()
    }

    toggle(): void {
        this._bsCollapse?.toggle()
    }

    private _onShow = (): void => {
        this._syncing = true
        this.setAttribute('open', '')
        this._syncing = false
        this.dispatchEvent(new CustomEvent('tc-show', { bubbles: true, composed: true }))
    }

    private _onShown = (): void => {
        this.dispatchEvent(new CustomEvent('tc-shown', { bubbles: true, composed: true }))
    }

    private _onHide = (): void => {
        this._syncing = true
        this.removeAttribute('open')
        this._syncing = false
        this.dispatchEvent(new CustomEvent('tc-hide', { bubbles: true, composed: true }))
    }

    private _onHidden = (): void => {
        this.dispatchEvent(new CustomEvent('tc-hidden', { bubbles: true, composed: true }))
    }

    private render(): void {
        const isOpen = this.hasAttribute('open')
        const isHorizontal = this.hasAttribute('horizontal')
        const classes = ['collapse', isHorizontal ? 'collapse-horizontal' : '', isOpen ? 'show' : '']
            .filter(Boolean).join(' ')
        const div = document.createElement('div')
        div.className = classes
        this.innerHTML = ''
        this.appendChild(div)
        this._collapseEl = div
    }

    private _initPlugin(): void {
        const el = this._collapseEl
        if (!el) return
        this._bsCollapse = new BsCollapse(el, { toggle: false })
        el.addEventListener('show.bs.collapse', this._onShow)
        el.addEventListener('shown.bs.collapse', this._onShown)
        el.addEventListener('hide.bs.collapse', this._onHide)
        el.addEventListener('hidden.bs.collapse', this._onHidden)
    }

    private _teardown(): void {
        const el = this._collapseEl
        if (el) {
            el.removeEventListener('show.bs.collapse', this._onShow)
            el.removeEventListener('shown.bs.collapse', this._onShown)
            el.removeEventListener('hide.bs.collapse', this._onHide)
            el.removeEventListener('hidden.bs.collapse', this._onHidden)
        }
        if (this._bsCollapse) {
            this._bsCollapse.dispose()
            this._bsCollapse = null
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Collapse
    }
}

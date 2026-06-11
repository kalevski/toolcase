import { Offcanvas as BsOffcanvas } from 'bootstrap'

const TAG_NAME = 'tc-offcanvas'

type BackdropValue = boolean | 'static'

export class Offcanvas extends HTMLElement {

    private _bsOffcanvas: BsOffcanvas | null = null
    private _bodyNodes: Node[] = []
    private _initialised = false
    private _syncing = false

    static get observedAttributes(): string[] {
        return ['open', 'placement', 'title', 'backdrop', 'scroll']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._bodyNodes = Array.from(this.childNodes)
            this._initialised = true
        }
        this.render()
        this._initPlugin()
        if (this.open) this._bsOffcanvas?.show()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised || this._syncing) return
        if (name === 'open') {
            if (this.open) {
                this._bsOffcanvas?.show()
            } else {
                this._bsOffcanvas?.hide()
            }
        } else {
            this._teardown()
            this.render()
            this._initPlugin()
        }
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get placement(): string {
        return this.getAttribute('placement') ?? 'start'
    }
    set placement(v: string) {
        this.setAttribute('placement', v)
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        this.setAttribute('title', v)
    }

    get backdrop(): string {
        return this.getAttribute('backdrop') ?? 'true'
    }
    set backdrop(v: string) {
        this.setAttribute('backdrop', v)
    }

    get scroll(): boolean {
        return this.hasAttribute('scroll')
    }
    set scroll(v: boolean) {
        if (v) this.setAttribute('scroll', '')
        else this.removeAttribute('scroll')
    }

    show(): void {
        this._bsOffcanvas?.show()
    }

    hide(): void {
        this._bsOffcanvas?.hide()
    }

    toggle(): void {
        this._bsOffcanvas?.toggle()
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

    private _resolveBackdrop(): BackdropValue {
        const val = this.getAttribute('backdrop')
        if (val === 'false') return false
        if (val === 'static') return 'static'
        return true
    }

    private render(): void {
        const placement = this.getAttribute('placement') ?? 'start'
        const validPlacements = ['start', 'end', 'top', 'bottom']
        const safePlacement = validPlacements.includes(placement) ? placement : 'start'

        this.className = `offcanvas offcanvas-${safePlacement}`
        this.setAttribute('tabindex', '-1')

        const titleText = this._escapeHtml(this.getAttribute('title') ?? '')

        this.innerHTML =
            `<div class="offcanvas-header">` +
            `<h5 class="offcanvas-title">${titleText}</h5>` +
            `<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>` +
            `</div>` +
            `<div class="offcanvas-body"></div>`

        const body = this.querySelector('.offcanvas-body')
        if (body) this._bodyNodes.forEach(n => body.appendChild(n))
    }

    private _escapeHtml(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }

    private _initPlugin(): void {
        this._bsOffcanvas = new BsOffcanvas(this, {
            backdrop: this._resolveBackdrop(),
            scroll: this.scroll,
        })
        this.addEventListener('show.bs.offcanvas', this._onShow)
        this.addEventListener('shown.bs.offcanvas', this._onShown)
        this.addEventListener('hide.bs.offcanvas', this._onHide)
        this.addEventListener('hidden.bs.offcanvas', this._onHidden)
    }

    private _teardown(): void {
        this.removeEventListener('show.bs.offcanvas', this._onShow)
        this.removeEventListener('shown.bs.offcanvas', this._onShown)
        this.removeEventListener('hide.bs.offcanvas', this._onHide)
        this.removeEventListener('hidden.bs.offcanvas', this._onHidden)
        if (this._bsOffcanvas) {
            this._bsOffcanvas.dispose()
            this._bsOffcanvas = null
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Offcanvas
    }
}

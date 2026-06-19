import { esc } from './internal/esc'
import { Toast as BsToast } from './internal/Toast'
import { closeIcon } from './icons'

const TAG_NAME = 'tc-toast'

export class Toast extends HTMLElement {
    private _bsToast: BsToast | null = null
    private _bodyNodes: Node[] = []
    private _initialised = false
    private _syncing = false

    static get observedAttributes(): string[] {
        return ['open', 'autohide', 'delay', 'variant', 'title']
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
        if (this.open) this._bsToast?.show()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised || this._syncing) return
        if (name === 'open') {
            if (this.open) {
                this._bsToast?.show()
            } else {
                this._bsToast?.hide()
            }
        } else {
            this._teardown()
            this.render()
            this._initPlugin()
            if (this.open) this._bsToast?.show()
        }
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get autohide(): boolean {
        return this.getAttribute('autohide') !== 'false'
    }
    set autohide(v: boolean) {
        this.setAttribute('autohide', String(v))
    }

    get delay(): number {
        const d = parseInt(this.getAttribute('delay') ?? '', 10)
        return isNaN(d) ? 5000 : d
    }
    set delay(v: number) {
        this.setAttribute('delay', String(v))
    }

    get variant(): string {
        return this.getAttribute('variant') ?? ''
    }
    set variant(v: string) {
        if (v) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        this.setAttribute('title', v)
    }

    show(): void {
        this._bsToast?.show()
    }

    hide(): void {
        this._bsToast?.hide()
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
        const variant = this.getAttribute('variant')
        const titleText = esc(this.getAttribute('title') ?? '')
        const hasTitle = titleText.length > 0

        const classes = ['toast', 'fade']
        if (variant) classes.push(`text-bg-${variant}`)
        this.className = classes.join(' ')

        this.setAttribute('role', 'alert')
        this.setAttribute('aria-live', 'assertive')
        this.setAttribute('aria-atomic', 'true')

        const headerHtml = hasTitle
            ? `<div class="toast-header">` +
              `<strong class="me-auto">${titleText}</strong>` +
              `<button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close">${closeIcon}</button>` +
              `</div>`
            : ''

        this.innerHTML = headerHtml + `<div class="toast-body"></div>`

        const body = this.querySelector('.toast-body')
        if (body) this._bodyNodes.forEach((n) => body.appendChild(n))
    }

    private _initPlugin(): void {
        this._bsToast = new BsToast(this, {
            autohide: this.autohide,
            delay: this.delay,
        })
        this.addEventListener('show.bs.toast', this._onShow)
        this.addEventListener('shown.bs.toast', this._onShown)
        this.addEventListener('hide.bs.toast', this._onHide)
        this.addEventListener('hidden.bs.toast', this._onHidden)
    }

    private _teardown(): void {
        this.removeEventListener('show.bs.toast', this._onShow)
        this.removeEventListener('shown.bs.toast', this._onShown)
        this.removeEventListener('hide.bs.toast', this._onHide)
        this.removeEventListener('hidden.bs.toast', this._onHidden)
        if (this._bsToast) {
            this._bsToast.dispose()
            this._bsToast = null
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Toast
    }
}

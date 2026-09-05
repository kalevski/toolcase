import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { bool, setAttr } from './internal/tc-element'
import { setHostClass } from './internal/host-class'
import { msg } from './messages'
import { Toast as BsToast } from './internal/Toast'
import { closeIcon } from './icons'

const TAG_NAME = 'tc-toast'

export class Toast extends HTMLElement {
    private _bsToast: BsToast | null = null
    private _initialised = false
    private _syncing = false

    static get observedAttributes(): string[] {
        return ['open', 'autohide', 'delay', 'variant', 'title']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
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

    /** Tri-state: default ON, so the attribute carries `"false"` to turn it off
     *  rather than being presence-based. `bool()` is what makes `autohide={false}`,
     *  `autohide="false"`, `autohide={0}` and `autohide=""` all mean the same thing
     *  — React writes any of them depending on how the prop was spelled. */
    get autohide(): boolean {
        return this.getAttribute('autohide') !== 'false'
    }
    set autohide(v: boolean) {
        this.setAttribute('autohide', bool(v) ? 'true' : 'false')
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
        setAttr(this, 'title', v)
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
        setHostClass(this, classes.join(' '))

        const urgent = ['error', 'danger', 'warning'].includes(variant ?? '')
        this.setAttribute('role', urgent ? 'alert' : 'status')
        this.setAttribute('aria-live', urgent ? 'assertive' : 'polite')
        this.setAttribute('aria-atomic', 'true')

        const headerHtml = hasTitle
            ? `<div class="toast-header">` +
              `<strong class="me-auto">${titleText}</strong>` +
              `<button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="${esc(msg('close'))}">${closeIcon}</button>` +
              `</div>`
            : ''

        // The header is the element's own; the body is whatever the consumer wrote,
        // left where they wrote it and given the body padding by CSS (rule 1).
        patchHtml(this, headerHtml)
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

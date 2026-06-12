import { Modal as BsModal } from './internal/Modal'
import { closeIcon } from './icons'

const TAG_NAME = 'tc-modal'

export class Modal extends HTMLElement {

    private _bsModal: BsModal | null = null
    private _bodyNodes: Node[] = []
    private _footerNodes: Node[] = []
    private _initialised = false
    private _syncing = false

    static get observedAttributes(): string[] {
        return ['open', 'title', 'size', 'centered', 'scrollable', 'static-backdrop', 'fullscreen']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._bodyNodes = Array.from(this.childNodes).filter(
                n => !(n instanceof Element && n.getAttribute('slot') === 'footer'),
            )
            this._footerNodes = Array.from(this.childNodes).filter(
                n => n instanceof Element && n.getAttribute('slot') === 'footer',
            )
            this._initialised = true
        }
        this.render()
        this._initPlugin()
        if (this.open) this._bsModal?.show()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised || this._syncing) return
        if (name === 'open') {
            if (this.open) {
                this._bsModal?.show()
            } else {
                this._bsModal?.hide()
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

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        this.setAttribute('title', v)
    }

    get size(): string {
        return this.getAttribute('size') ?? ''
    }
    set size(v: string) {
        this.setAttribute('size', v)
    }

    get centered(): boolean {
        return this.hasAttribute('centered')
    }
    set centered(v: boolean) {
        if (v) this.setAttribute('centered', '')
        else this.removeAttribute('centered')
    }

    get scrollable(): boolean {
        return this.hasAttribute('scrollable')
    }
    set scrollable(v: boolean) {
        if (v) this.setAttribute('scrollable', '')
        else this.removeAttribute('scrollable')
    }

    get staticBackdrop(): boolean {
        return this.hasAttribute('static-backdrop')
    }
    set staticBackdrop(v: boolean) {
        if (v) this.setAttribute('static-backdrop', '')
        else this.removeAttribute('static-backdrop')
    }

    get fullscreen(): string {
        return this.getAttribute('fullscreen') ?? ''
    }
    set fullscreen(v: string) {
        this.setAttribute('fullscreen', v)
    }

    show(): void {
        this._bsModal?.show()
    }

    hide(): void {
        this._bsModal?.hide()
    }

    toggle(): void {
        this._bsModal?.toggle()
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
        const dialogClasses = ['modal-dialog']

        if (this.centered) dialogClasses.push('modal-dialog-centered')
        if (this.scrollable) dialogClasses.push('modal-dialog-scrollable')

        const size = this.getAttribute('size')
        if (size === 'sm' || size === 'lg' || size === 'xl') {
            dialogClasses.push(`modal-${size}`)
        }

        const fs = this.getAttribute('fullscreen')
        if (fs === 'true' || fs === '') {
            dialogClasses.push('modal-fullscreen')
        } else if (fs === 'sm' || fs === 'md' || fs === 'lg' || fs === 'xl' || fs === 'xxl') {
            dialogClasses.push(`modal-fullscreen-${fs}-down`)
        }

        this.className = 'modal fade'
        this.setAttribute('tabindex', '-1')
        if (this.staticBackdrop) {
            this.setAttribute('data-bs-backdrop', 'static')
        } else {
            this.removeAttribute('data-bs-backdrop')
        }

        const hasFooter = this._footerNodes.length > 0
        const footerHtml = hasFooter ? '<div class="modal-footer"></div>' : ''
        const titleText = this._escapeHtml(this.getAttribute('title') ?? '')

        this.innerHTML = `<div class="${dialogClasses.join(' ')}">` +
            `<div class="modal-content">` +
            `<div class="modal-header">` +
            `<h5 class="modal-title">${titleText}</h5>` +
            `<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">${closeIcon}</button>` +
            `</div>` +
            `<div class="modal-body"></div>` +
            footerHtml +
            `</div>` +
            `</div>`

        const body = this.querySelector('.modal-body')
        if (body) this._bodyNodes.forEach(n => body.appendChild(n))

        if (hasFooter) {
            const footer = this.querySelector('.modal-footer')
            if (footer) this._footerNodes.forEach(n => footer.appendChild(n))
        }
    }

    private _escapeHtml(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }

    private _initPlugin(): void {
        const backdrop: boolean | 'static' = this.staticBackdrop ? 'static' : true
        this._bsModal = new BsModal(this, { backdrop })
        this.addEventListener('show.bs.modal', this._onShow)
        this.addEventListener('shown.bs.modal', this._onShown)
        this.addEventListener('hide.bs.modal', this._onHide)
        this.addEventListener('hidden.bs.modal', this._onHidden)
    }

    private _teardown(): void {
        this.removeEventListener('show.bs.modal', this._onShow)
        this.removeEventListener('shown.bs.modal', this._onShown)
        this.removeEventListener('hide.bs.modal', this._onHide)
        this.removeEventListener('hidden.bs.modal', this._onHidden)
        if (this._bsModal) {
            this._bsModal.dispose()
            this._bsModal = null
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Modal
    }
}

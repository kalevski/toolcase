import { Modal as BsModal } from './internal/Modal'
import { BsOverlay, escapeHtml, type OverlayPlugin } from './internal/bs-overlay'
import { closeIcon } from './icons'
import { msg } from './messages'
import { setHostClass } from './internal/host-class'

const TAG_NAME = 'tc-modal'

/**
 * tc-modal — a Bootstrap modal wrapper on the shared {@link BsOverlay} scaffold.
 * Modal specifics: the `.modal` dialog markup with size / centered / scrollable /
 * fullscreen options, a `footer` slot, the static-backdrop option, and the
 * `.bs.modal` event namespace.
 *
 * `lazy`: the captured body/footer content only enters the DOM on first open —
 * pages keeping several hidden modals mounted stop leaking their content into
 * selectors/ids/queries. Independent of `lazy`, a closed modal is `inert`, so
 * its content never sits in the tab order or accessibility tree while hidden.
 */
export class Modal extends BsOverlay {
    private _bodyNodes: Node[] = []
    private _footerNodes: Node[] = []
    // With `lazy`, flips true on first show; content stays mounted afterwards
    // so open → close → open keeps form state.
    private _contentMounted = false

    static get observedAttributes(): string[] {
        return [
            'open',
            'title',
            'size',
            'centered',
            'scrollable',
            'static-backdrop',
            'fullscreen',
            'lazy',
        ]
    }

    protected get eventNs(): string {
        return 'modal'
    }

    connectedCallback(): void {
        super.connectedCallback()
        this.addEventListener('show.bs.modal', this._onShowMount)
        this.addEventListener('hidden.bs.modal', this._onHiddenInert)
        if (!this.open) this.setAttribute('inert', '')
    }

    disconnectedCallback(): void {
        super.disconnectedCallback()
        this.removeEventListener('show.bs.modal', this._onShowMount)
        this.removeEventListener('hidden.bs.modal', this._onHiddenInert)
    }

    private _onShowMount = (): void => {
        this.removeAttribute('inert')
        if (this.lazy && !this._contentMounted) {
            this._contentMounted = true
            this._mountContent()
        }
    }

    private _onHiddenInert = (): void => {
        if (!this.open) this.setAttribute('inert', '')
    }

    get lazy(): boolean {
        return this.hasAttribute('lazy')
    }
    set lazy(v: boolean) {
        if (v) this.setAttribute('lazy', '')
        else this.removeAttribute('lazy')
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

    protected captureSlots(): void {
        this._bodyNodes = Array.from(this.childNodes).filter(
            (n) => !(n instanceof Element && n.getAttribute('slot') === 'footer'),
        )
        this._footerNodes = Array.from(this.childNodes).filter(
            (n) => n instanceof Element && n.getAttribute('slot') === 'footer',
        )
    }

    protected createPlugin(): OverlayPlugin {
        const backdrop: boolean | 'static' = this.staticBackdrop ? 'static' : true
        return new BsModal(this, { backdrop }) as unknown as OverlayPlugin
    }

    protected render(): void {
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

        setHostClass(this, 'modal fade')
        this.setAttribute('tabindex', '-1')
        if (this.staticBackdrop) {
            this.setAttribute('data-bs-backdrop', 'static')
        } else {
            this.removeAttribute('data-bs-backdrop')
        }

        const hasFooter = this._footerNodes.length > 0
        const footerHtml = hasFooter ? '<div class="modal-footer"></div>' : ''
        const titleText = escapeHtml(this.getAttribute('title') ?? '')

        this.innerHTML =
            `<div class="${dialogClasses.join(' ')}">` +
            `<div class="modal-content">` +
            `<div class="modal-header">` +
            `<h5 class="modal-title">${titleText}</h5>` +
            `<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="${escapeHtml(msg('close'))}">${closeIcon}</button>` +
            `</div>` +
            `<div class="modal-body"></div>` +
            footerHtml +
            `</div>` +
            `</div>`

        // Lazy + never opened: keep the captured content out of the DOM until
        // the first show.bs.modal (see _onShowMount).
        if (!this.lazy || this._contentMounted) this._mountContent()
    }

    private _mountContent(): void {
        const body = this.querySelector('.modal-body')
        if (body) this._bodyNodes.forEach((n) => body.appendChild(n))
        const footer = this.querySelector('.modal-footer')
        if (footer) this._footerNodes.forEach((n) => footer.appendChild(n))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Modal
    }
}

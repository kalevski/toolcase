import { Modal as BsModal } from './internal/Modal'
import { BsOverlay, escapeHtml, type OverlayPlugin } from './internal/bs-overlay'
import { closeIcon } from './icons'

const TAG_NAME = 'tc-modal'

/**
 * tc-modal — a Bootstrap modal wrapper on the shared {@link BsOverlay} scaffold.
 * Modal specifics: the `.modal` dialog markup with size / centered / scrollable /
 * fullscreen options, a `footer` slot, the static-backdrop option, and the
 * `.bs.modal` event namespace.
 */
export class Modal extends BsOverlay {
    private _bodyNodes: Node[] = []
    private _footerNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['open', 'title', 'size', 'centered', 'scrollable', 'static-backdrop', 'fullscreen']
    }

    protected get eventNs(): string {
        return 'modal'
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
            n => !(n instanceof Element && n.getAttribute('slot') === 'footer'),
        )
        this._footerNodes = Array.from(this.childNodes).filter(
            n => n instanceof Element && n.getAttribute('slot') === 'footer',
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

        this.className = 'modal fade'
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
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Modal
    }
}

import { patchHtml } from './internal/patch-html'
import { Offcanvas as BsOffcanvas } from './internal/Offcanvas'
import { setHostClass } from './internal/host-class'
import { BsOverlay, escapeHtml, type OverlayPlugin } from './internal/bs-overlay'
import { msg } from './messages'
import { closeIcon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-offcanvas'

type BackdropValue = boolean | 'static'

/**
 * tc-offcanvas — a Bootstrap offcanvas wrapper on the shared {@link BsOverlay}
 * scaffold. Offcanvas specifics: edge `placement`, the `backdrop` (true / false /
 * static) + `scroll` options, the `.offcanvas` header/body markup, and the
 * `.bs.offcanvas` event namespace.
 */
export class Offcanvas extends BsOverlay {

    static get observedAttributes(): string[] {
        return ['open', 'placement', 'title', 'backdrop', 'scroll']
    }

    protected get eventNs(): string {
        return 'offcanvas'
    }

    get placement(): string {
        return this.getAttribute('placement') ?? 'start'
    }
    set placement(v: string) {
        setAttr(this, 'placement', v)
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        setAttr(this, 'title', v)
    }

    get backdrop(): string {
        return this.getAttribute('backdrop') ?? 'true'
    }
    set backdrop(v: string) {
        this.setAttribute('backdrop', v)
    }

    // The `scroll` attribute (allow body scrolling while open) intentionally
    // shadows HTMLElement.scroll(); the accessor pair is part of the public
    // tc-offcanvas API.
    // @ts-expect-error TS2416/TS2423 — boolean accessor over an inherited method
    get scroll(): boolean {
        return this.hasAttribute('scroll')
    }
    // @ts-expect-error TS2416 — see getter above
    set scroll(v: boolean) {
        if (v) this.setAttribute('scroll', '')
        else this.removeAttribute('scroll')
    }

    private _resolveBackdrop(): BackdropValue {
        const val = this.getAttribute('backdrop')
        if (val === 'false') return false
        if (val === 'static') return 'static'
        return true
    }

    protected createPlugin(): OverlayPlugin {
        return new BsOffcanvas(this as unknown as Element, {
            backdrop: this._resolveBackdrop(),
            scroll: this.scroll,
        }) as unknown as OverlayPlugin
    }

    protected render(): void {
        const placement = this.getAttribute('placement') ?? 'start'
        const validPlacements = ['start', 'end', 'top', 'bottom']
        const safePlacement = validPlacements.includes(placement) ? placement : 'start'

        setHostClass(this, `offcanvas offcanvas-${safePlacement}`)
        this.setAttribute('tabindex', '-1')

        const titleText = escapeHtml(this.getAttribute('title') ?? '')

        // The header is the element's own; the body is the consumer's children,
        // padded where they stand rather than moved into `.offcanvas-body` (rule 1).
        patchHtml(
            this,
            `<div class="offcanvas-header">` +
                `<h5 class="offcanvas-title">${titleText}</h5>` +
                `<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="${escapeHtml(msg('close'))}">${closeIcon}</button>` +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Offcanvas
    }
}

import { ScrollSpy as BsScrollSpy } from 'bootstrap'

const TAG_NAME = 'tc-scrollspy'

export class Scrollspy extends HTMLElement {

    private _bsScrollspy: BsScrollSpy | null = null

    static get observedAttributes(): string[] {
        return ['target', 'offset', 'smooth-scroll']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._applyAttrs()
        this._initPlugin()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected) return
        this._teardown()
        this._applyAttrs()
        this._initPlugin()
    }

    get target(): string {
        return this.getAttribute('target') ?? ''
    }
    set target(v: string) {
        this.setAttribute('target', v)
    }

    get offset(): number {
        return parseInt(this.getAttribute('offset') ?? '0', 10)
    }
    set offset(v: number) {
        this.setAttribute('offset', String(v))
    }

    get smoothScroll(): boolean {
        return this.hasAttribute('smooth-scroll')
    }
    set smoothScroll(v: boolean) {
        if (v) this.setAttribute('smooth-scroll', '')
        else this.removeAttribute('smooth-scroll')
    }

    private _onActivate = (event: Event): void => {
        const relatedTarget = (event as any).relatedTarget
        this.dispatchEvent(new CustomEvent('tc-activate', {
            bubbles: true,
            composed: true,
            detail: { relatedTarget },
        }))
    }

    private _applyAttrs(): void {
        this.setAttribute('data-bs-spy', 'scroll')
        const target = this.getAttribute('target')
        if (target) {
            this.setAttribute('data-bs-target', target)
        } else {
            this.removeAttribute('data-bs-target')
        }
        if (this.hasAttribute('smooth-scroll')) {
            this.setAttribute('data-bs-smooth-scroll', 'true')
        } else {
            this.removeAttribute('data-bs-smooth-scroll')
        }
        if (!this.hasAttribute('tabindex')) {
            this.setAttribute('tabindex', '0')
        }
    }

    private _initPlugin(): void {
        const target = this.getAttribute('target') ?? ''
        const smoothScroll = this.hasAttribute('smooth-scroll')
        const offsetAttr = this.getAttribute('offset')
        const offsetPx = offsetAttr ? parseInt(offsetAttr, 10) : 0
        // Bootstrap 5.3 replaced the offset option with rootMargin (Intersection Observer).
        const rootMargin = offsetPx > 0 ? `0px 0px -${offsetPx}px 0px` : undefined

        this._bsScrollspy = new BsScrollSpy(this, { target, smoothScroll, ...(rootMargin ? { rootMargin } : {}) })
        this.addEventListener('activate.bs.scrollspy', this._onActivate)
    }

    private _teardown(): void {
        this.removeEventListener('activate.bs.scrollspy', this._onActivate)
        if (this._bsScrollspy) {
            this._bsScrollspy.dispose()
            this._bsScrollspy = null
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Scrollspy
    }
}

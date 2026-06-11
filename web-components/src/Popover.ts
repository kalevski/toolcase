import { Popover as BsPopover } from 'bootstrap'

const TAG_NAME = 'tc-popover'

const VALID_PLACEMENTS = ['top', 'right', 'bottom', 'left', 'auto']

export class Popover extends HTMLElement {

    private _bsPopover: BsPopover | null = null
    private _triggerEl: HTMLElement | null = null
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['title', 'content', 'placement', 'trigger', 'html']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._initialised = true
        }
        this._initPlugin()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._teardown()
        this._initPlugin()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        this.setAttribute('title', v)
    }

    get content(): string {
        return this.getAttribute('content') ?? ''
    }
    set content(v: string) {
        this.setAttribute('content', v)
    }

    get placement(): string {
        return this.getAttribute('placement') ?? 'auto'
    }
    set placement(v: string) {
        this.setAttribute('placement', v)
    }

    get trigger(): string {
        return this.getAttribute('trigger') ?? 'click'
    }
    set trigger(v: string) {
        this.setAttribute('trigger', v)
    }

    get html(): boolean {
        return this.hasAttribute('html')
    }
    set html(v: boolean) {
        if (v) this.setAttribute('html', '')
        else this.removeAttribute('html')
    }

    show(): void {
        this._bsPopover?.show()
    }

    hide(): void {
        this._bsPopover?.hide()
    }

    toggle(): void {
        this._bsPopover?.toggle()
    }

    private _onShow = (): void => {
        this.dispatchEvent(new CustomEvent('tc-show', { bubbles: true, composed: true }))
    }

    private _onShown = (): void => {
        this.dispatchEvent(new CustomEvent('tc-shown', { bubbles: true, composed: true }))
    }

    private _onHide = (): void => {
        this.dispatchEvent(new CustomEvent('tc-hide', { bubbles: true, composed: true }))
    }

    private _onHidden = (): void => {
        this.dispatchEvent(new CustomEvent('tc-hidden', { bubbles: true, composed: true }))
    }

    private _initPlugin(): void {
        const triggerEl = this.firstElementChild as HTMLElement | null
        if (!triggerEl) return
        this._triggerEl = triggerEl

        const rawPlacement = this.getAttribute('placement') ?? 'auto'
        const placement = VALID_PLACEMENTS.includes(rawPlacement) ? rawPlacement : 'auto'

        this._bsPopover = new BsPopover(triggerEl, {
            title: this.getAttribute('title') ?? '',
            content: this.getAttribute('content') ?? '',
            placement: placement as any,
            trigger: (this.getAttribute('trigger') ?? 'click') as any,
            html: this.hasAttribute('html'),
        })

        triggerEl.addEventListener('show.bs.popover', this._onShow)
        triggerEl.addEventListener('shown.bs.popover', this._onShown)
        triggerEl.addEventListener('hide.bs.popover', this._onHide)
        triggerEl.addEventListener('hidden.bs.popover', this._onHidden)
    }

    private _teardown(): void {
        const triggerEl = this._triggerEl
        if (triggerEl) {
            triggerEl.removeEventListener('show.bs.popover', this._onShow)
            triggerEl.removeEventListener('shown.bs.popover', this._onShown)
            triggerEl.removeEventListener('hide.bs.popover', this._onHide)
            triggerEl.removeEventListener('hidden.bs.popover', this._onHidden)
        }
        if (this._bsPopover) {
            this._bsPopover.dispose()
            this._bsPopover = null
        }
        this._triggerEl = null
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Popover
    }
}

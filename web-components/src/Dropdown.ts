import { bindOnce, patchHtml } from './internal/patch-html'
import { adoptChildren } from './internal/adopt-children'
import { Dropdown as BsDropdown } from './internal/Dropdown'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-dropdown'

export type DropdownVariant =
    'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'
export type DropdownDirection = 'down' | 'up' | 'start' | 'end'
export type DropdownAutoClose = 'true' | 'inside' | 'outside' | 'false'

const DIRECTION_CLASS: Record<DropdownDirection, string> = {
    down: 'dropdown',
    up: 'dropup',
    start: 'dropstart',
    end: 'dropend',
}

export class Dropdown extends HTMLElement {
    private _bsDropdown: BsDropdown | null = null
    private _toggleEl: HTMLElement | null = null
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['label', 'variant', 'split', 'direction', 'auto-close']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            this._adopt(slotContent)
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
        // patchHtml reuses the <ul> across renders, so the menu items are already
        // where they belong; re-pointing the route is all that is left to do.
        this.render()
        this._adopt()
        this._initPlugin()
    }

    /** The consumer's children are the menu's items — see adopt-children.ts. */
    private _adopt(nodes?: Node[]): void {
        const menu = this.querySelector('.dropdown-menu')
        if (menu) adoptChildren(this, () => menu, nodes)
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        setAttr(this, 'label', v)
    }

    get variant(): DropdownVariant {
        return (this.getAttribute('variant') as DropdownVariant) ?? 'primary'
    }
    set variant(v: DropdownVariant) {
        setAttr(this, 'variant', v)
    }

    get split(): boolean {
        return this.hasAttribute('split')
    }
    set split(v: boolean) {
        if (v) this.setAttribute('split', '')
        else this.removeAttribute('split')
    }

    get direction(): DropdownDirection {
        const v = this.getAttribute('direction') as DropdownDirection
        return v in DIRECTION_CLASS ? v : 'down'
    }
    set direction(v: DropdownDirection) {
        setAttr(this, 'direction', v)
    }

    get autoClose(): DropdownAutoClose {
        return (this.getAttribute('auto-close') as DropdownAutoClose) ?? 'true'
    }
    set autoClose(v: DropdownAutoClose) {
        this.setAttribute('auto-close', v)
    }

    show(): void {
        this._bsDropdown?.show()
    }

    hide(): void {
        this._bsDropdown?.hide()
    }

    toggle(): void {
        this._bsDropdown?.toggle()
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

    private render(): void {
        const label = this.getAttribute('label') ?? ''
        const variant = this.getAttribute('variant') ?? 'primary'
        const isSplit = this.hasAttribute('split')
        const direction = (this.getAttribute('direction') as DropdownDirection) || 'down'
        const dirClass = DIRECTION_CLASS[direction] ?? 'dropdown'
        const autoClose = this.getAttribute('auto-close') ?? 'true'

        const outerClass = isSplit ? `btn-group ${dirClass}` : dirClass

        let toggleHtml: string
        if (isSplit) {
            toggleHtml =
                `<button type="button" class="btn btn-${variant}">${label}</button>` +
                `<button type="button" class="btn btn-${variant} dropdown-toggle dropdown-toggle-split"` +
                ` data-bs-toggle="dropdown" data-bs-auto-close="${autoClose}" aria-expanded="false">` +
                `<span class="visually-hidden">Toggle Dropdown</span></button>`
        } else {
            toggleHtml =
                `<button type="button" class="btn btn-${variant} dropdown-toggle"` +
                ` data-bs-toggle="dropdown" data-bs-auto-close="${autoClose}" aria-expanded="false">` +
                `${label}</button>`
        }

        patchHtml(
            this,
            `<div class="${outerClass}">${toggleHtml}<ul class="dropdown-menu"></ul></div>`,
        )
    }

    private _initPlugin(): void {
        const toggle = this.querySelector<HTMLElement>('[data-bs-toggle="dropdown"]')
        if (!toggle) return
        this._toggleEl = toggle
        this._bsDropdown = new BsDropdown(toggle)
        bindOnce(toggle, 'show.bs.dropdown', this._onShow)
        bindOnce(toggle, 'shown.bs.dropdown', this._onShown)
        bindOnce(toggle, 'hide.bs.dropdown', this._onHide)
        bindOnce(toggle, 'hidden.bs.dropdown', this._onHidden)
    }

    private _teardown(): void {
        const toggle = this._toggleEl
        if (toggle) {
            toggle.removeEventListener('show.bs.dropdown', this._onShow)
            toggle.removeEventListener('shown.bs.dropdown', this._onShown)
            toggle.removeEventListener('hide.bs.dropdown', this._onHide)
            toggle.removeEventListener('hidden.bs.dropdown', this._onHidden)
        }
        if (this._bsDropdown) {
            this._bsDropdown.dispose()
            this._bsDropdown = null
        }
        this._toggleEl = null
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Dropdown
    }
}

import { closeIcon } from './icons'

const TAG_NAME = 'tc-drawer'

let _idCounter = 0

export type DrawerSide = 'left' | 'right' | 'top' | 'bottom'
export type DrawerSize = 'small' | 'default' | 'large'

const SIDES: DrawerSide[] = ['left', 'right', 'top', 'bottom']
const SIZES: DrawerSize[] = ['small', 'default', 'large']

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function getFocusable(root: Element): HTMLElement[] {
    return Array.from(
        root.querySelectorAll<HTMLElement>(
            'a[href],area[href],button:not([disabled]),details>summary,[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        ),
    ).filter(el => !el.closest('[hidden]') && el.tabIndex >= 0)
}

export class Drawer extends HTMLElement {
    private _initialised = false
    private _bodyNodes: Node[] = []
    private _previousFocus: Element | null = null
    private _idPrefix: string

    onClose: (() => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-drawer-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['open', 'side', 'size', 'title', 'pinned']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._bodyNodes = Array.from(this.childNodes)
            this.render()
            const body = this.querySelector('.tc-drawer__body')
            if (body) this._bodyNodes.forEach(n => body.appendChild(n))
            this._initialised = true
        }
        // Detach before attach to prevent double-registration on reconnect.
        this._detachHandlers()
        this._attachHandlers()
        if (this.open) this._applyOpenState(true)
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._restoreScroll()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'open') {
            this._applyOpenState(this.open)
            return
        }

        // Structural attribute changed — re-render preserving body children.
        const body = this.querySelector('.tc-drawer__body')
        const saved = body ? Array.from(body.childNodes) : []
        this.render()
        const newBody = this.querySelector('.tc-drawer__body')
        if (newBody) saved.forEach(n => newBody.appendChild(n))

        if (this.open) this._applyOpenState(true)
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get side(): DrawerSide {
        const v = this.getAttribute('side') as DrawerSide
        return SIDES.includes(v) ? v : 'right'
    }
    set side(v: DrawerSide) {
        this.setAttribute('side', v)
    }

    get size(): DrawerSize {
        const v = this.getAttribute('size') as DrawerSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: DrawerSize) {
        this.setAttribute('size', v)
    }

    // `title` is natively reflected by HTMLElement; no getter/setter defined.
    // Listed in observedAttributes so attributeChangedCallback fires on changes.
    // Read via this.getAttribute('title') inside render().

    get pinned(): boolean {
        return this.hasAttribute('pinned')
    }
    set pinned(v: boolean) {
        if (v) this.setAttribute('pinned', '')
        else this.removeAttribute('pinned')
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private _applyOpenState(opening: boolean): void {
        const panel = this.querySelector<HTMLElement>('.tc-drawer__panel')
        const backdrop = this.querySelector<HTMLElement>('.tc-drawer__backdrop')

        if (opening) {
            this._previousFocus = document.activeElement
            panel?.removeAttribute('hidden')
            backdrop?.removeAttribute('hidden')
            // Settle one frame before adding open class to trigger transition.
            requestAnimationFrame(() => {
                this.classList.add('tc-drawer--open')
                panel?.setAttribute('aria-hidden', 'false')
                if (!this.pinned) this._lockScroll()
                this._trapFocus(panel)
            })
        } else {
            this.classList.remove('tc-drawer--open')
            panel?.setAttribute('aria-hidden', 'true')
            if (!this.pinned) this._restoreScroll()
            this._restoreFocus()
            const delay = this._getTransitionDuration(panel)
            setTimeout(() => {
                if (!this.open) {
                    panel?.setAttribute('hidden', '')
                    backdrop?.setAttribute('hidden', '')
                }
            }, delay)
        }
    }

    private _getTransitionDuration(el: HTMLElement | null): number {
        if (!el) return 0
        const style = getComputedStyle(el)
        const raw = style.transitionDuration || '0s'
        let max = 0
        for (const p of raw.split(',')) {
            const sec = parseFloat(p.trim())
            if (!isNaN(sec)) max = Math.max(max, sec)
        }
        return max * 1000
    }

    private _lockScroll(): void {
        document.body.style.overflow = 'hidden'
    }

    private _restoreScroll(): void {
        document.body.style.overflow = ''
    }

    private _restoreFocus(): void {
        if (this._previousFocus instanceof HTMLElement) {
            this._previousFocus.focus()
        }
        this._previousFocus = null
    }

    private _trapFocus(panel: HTMLElement | null): void {
        if (!panel) return
        const focusable = getFocusable(panel)
        if (focusable.length > 0) {
            focusable[0].focus()
        } else {
            panel.focus()
        }
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return
        if (e.key === 'Escape') {
            e.preventDefault()
            this._requestClose()
            return
        }
        if (e.key === 'Tab') {
            const panel = this.querySelector<HTMLElement>('.tc-drawer__panel')
            if (!panel) return
            const focusable = getFocusable(panel)
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }
    }

    private _onBackdropClick = (e: MouseEvent): void => {
        if ((e.target as Element)?.classList.contains('tc-drawer__backdrop')) {
            this._requestClose()
        }
    }

    private _onCloseClick = (e: MouseEvent): void => {
        if ((e.target as Element)?.closest('.tc-drawer__close')) {
            this._requestClose()
        }
    }

    private _requestClose(): void {
        this.dispatchEvent(new CustomEvent('tc-close', {
            bubbles: true,
            composed: true,
            detail: {},
        }))
        if (typeof this.onClose === 'function') this.onClose()
    }

    private _attachHandlers(): void {
        document.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onBackdropClick)
        this.addEventListener('click', this._onCloseClick)
    }

    private _detachHandlers(): void {
        document.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onBackdropClick)
        this.removeEventListener('click', this._onCloseClick)
    }

    private render(): void {
        const side = this.side
        const size = this.size
        const pinned = this.pinned
        const titleText = esc(this.getAttribute('title') ?? '')
        const isOpen = this.open

        const ariaModal = pinned ? 'false' : 'true'
        const labelId = `${this._idPrefix}-title`
        const hiddenAttr = isOpen ? '' : ' hidden'
        const panelAriaHidden = isOpen ? 'false' : 'true'

        const backdropHtml = pinned
            ? ''
            : `<div class="tc-drawer__backdrop" aria-hidden="true"${hiddenAttr}></div>`

        this.innerHTML =
            backdropHtml +
            `<div class="tc-drawer__panel tc-drawer__panel--${side} tc-drawer__panel--${size}"` +
            ` role="dialog" aria-modal="${ariaModal}" aria-labelledby="${labelId}"` +
            ` tabindex="-1" aria-hidden="${panelAriaHidden}"${hiddenAttr}>` +
            `<div class="tc-drawer__header">` +
            `<span class="tc-drawer__title" id="${labelId}">${titleText}</span>` +
            `<button type="button" class="tc-drawer__close" aria-label="Close">${closeIcon}</button>` +
            `</div>` +
            `<div class="tc-drawer__body"></div>` +
            `</div>`

        if (isOpen) {
            this.classList.add('tc-drawer--open')
        } else {
            this.classList.remove('tc-drawer--open')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Drawer
    }
}

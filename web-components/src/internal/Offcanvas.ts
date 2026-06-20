import { Backdrop } from './backdrop'
import { executeAfterTransition, triggerEvent } from './transition'
import { lockBody, unlockBody } from './scroll-lock'

// Drop-in replacement for Bootstrap's Offcanvas plugin: backdrop
// (true | false | 'static'), optional body scroll, Escape handling,
// [data-bs-dismiss="offcanvas"] wiring and the .showing/.show/.hiding class
// protocol with *.bs.offcanvas events.

export interface OffcanvasOptions {
    backdrop?: boolean | 'static'
    scroll?: boolean
    keyboard?: boolean
}

export class Offcanvas {
    private _element: HTMLElement
    private _backdropOption: boolean | 'static'
    private _scroll: boolean
    private _keyboard: boolean
    private _backdrop = new Backdrop('offcanvas-backdrop')
    private _isShown = false
    private _transitioning = false

    // Accepts Element (like Bootstrap's signature) — tc-offcanvas shadows
    // HTMLElement.scroll() with a boolean accessor, so `this` is not
    // assignable to HTMLElement at the type level.
    constructor(element: Element, options: OffcanvasOptions = {}) {
        this._element = element as HTMLElement
        this._backdropOption = options.backdrop ?? true
        this._scroll = options.scroll ?? false
        this._keyboard = options.keyboard ?? true
        element.addEventListener('click', this._onDismissClick)
    }

    show(): void {
        if (this._isShown || this._transitioning) return
        const showEvent = triggerEvent(this._element, 'show.bs.offcanvas')
        if (showEvent.defaultPrevented) return

        this._isShown = true
        this._transitioning = true
        document.addEventListener('keydown', this._onKeydown)

        if (this._backdropOption !== false) {
            this._backdrop.show(() => {
                if (this._backdropOption === 'static') return
                this.hide()
            })
        }
        if (!this._scroll) lockBody()

        const el = this._element
        el.classList.add('showing')
        el.setAttribute('aria-modal', 'true')
        el.setAttribute('role', 'dialog')

        executeAfterTransition(el, () => {
            this._transitioning = false
            el.classList.remove('showing')
            el.classList.add('show')
            el.focus()
            triggerEvent(el, 'shown.bs.offcanvas')
        })
    }

    hide(): void {
        if (!this._isShown || this._transitioning) return
        const hideEvent = triggerEvent(this._element, 'hide.bs.offcanvas')
        if (hideEvent.defaultPrevented) return

        this._isShown = false
        this._transitioning = true
        document.removeEventListener('keydown', this._onKeydown)

        const el = this._element
        el.classList.add('hiding')
        el.classList.remove('show')

        executeAfterTransition(el, () => {
            this._transitioning = false
            el.classList.remove('hiding')
            el.removeAttribute('aria-modal')
            el.removeAttribute('role')
            this._backdrop.hide()
            if (!this._scroll) unlockBody()
            triggerEvent(el, 'hidden.bs.offcanvas')
        })
    }

    toggle(): void {
        if (this._isShown) this.hide()
        else this.show()
    }

    dispose(): void {
        this._element.removeEventListener('click', this._onDismissClick)
        document.removeEventListener('keydown', this._onKeydown)
        this._backdrop.dispose()
        if (this._isShown && !this._scroll) unlockBody()
    }

    private _onDismissClick = (event: Event): void => {
        const target = event.target as Element
        if (target.closest('[data-bs-dismiss="offcanvas"]')) this.hide()
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') return
        if (this._keyboard && this._backdropOption !== 'static') this.hide()
    }
}

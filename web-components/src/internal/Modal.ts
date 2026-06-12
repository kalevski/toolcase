import { Backdrop } from './backdrop'
import { executeAfterTransition, reflow, triggerEvent } from './transition'

// Drop-in replacement for Bootstrap's Modal plugin: backdrop (true | 'static'),
// Escape handling, body scroll lock, [data-bs-dismiss="modal"] wiring and the
// .fade/.show class protocol with *.bs.modal events.

export interface ModalOptions {
    backdrop?: boolean | 'static'
    keyboard?: boolean
}

export class Modal {
    private _element: HTMLElement
    private _backdropOption: boolean | 'static'
    private _keyboard: boolean
    private _backdrop = new Backdrop('modal-backdrop')
    private _isShown = false
    private _transitioning = false

    constructor(element: HTMLElement, options: ModalOptions = {}) {
        this._element = element
        this._backdropOption = options.backdrop ?? true
        this._keyboard = options.keyboard ?? true
        element.addEventListener('click', this._onDismissClick)
        element.addEventListener('mousedown', this._onElementMouseDown)
    }

    show(): void {
        if (this._isShown || this._transitioning) return
        const showEvent = triggerEvent(this._element, 'show.bs.modal')
        if (showEvent.defaultPrevented) return

        this._isShown = true
        this._transitioning = true
        document.body.classList.add('modal-open')
        document.addEventListener('keydown', this._onKeydown)

        if (this._backdropOption !== false) this._backdrop.show()

        const el = this._element
        el.style.display = 'block'
        el.removeAttribute('aria-hidden')
        el.setAttribute('aria-modal', 'true')
        el.setAttribute('role', 'dialog')
        el.scrollTop = 0
        reflow(el)
        el.classList.add('show')

        executeAfterTransition(el, () => {
            this._transitioning = false
            el.focus()
            triggerEvent(el, 'shown.bs.modal')
        })
    }

    hide(): void {
        if (!this._isShown || this._transitioning) return
        const hideEvent = triggerEvent(this._element, 'hide.bs.modal')
        if (hideEvent.defaultPrevented) return

        this._isShown = false
        this._transitioning = true
        document.removeEventListener('keydown', this._onKeydown)

        const el = this._element
        el.classList.remove('show')

        executeAfterTransition(el, () => {
            this._transitioning = false
            el.style.display = 'none'
            el.setAttribute('aria-hidden', 'true')
            el.removeAttribute('aria-modal')
            el.removeAttribute('role')
            this._backdrop.hide()
            document.body.classList.remove('modal-open')
            triggerEvent(el, 'hidden.bs.modal')
        })
    }

    toggle(): void {
        if (this._isShown) this.hide()
        else this.show()
    }

    dispose(): void {
        this._element.removeEventListener('click', this._onDismissClick)
        this._element.removeEventListener('mousedown', this._onElementMouseDown)
        document.removeEventListener('keydown', this._onKeydown)
        this._backdrop.dispose()
        if (this._isShown) document.body.classList.remove('modal-open')
    }

    private _onDismissClick = (event: Event): void => {
        const target = event.target as Element
        if (target.closest('[data-bs-dismiss="modal"]')) this.hide()
    }

    /** Click on the modal element itself (outside .modal-content) acts as backdrop click. */
    private _onElementMouseDown = (event: Event): void => {
        if (event.target !== this._element) return
        if (this._backdropOption === 'static') this._shake()
        else if (this._backdropOption !== false) this.hide()
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') return
        if (this._backdropOption === 'static' || !this._keyboard) this._shake()
        else this.hide()
    }

    private _shake(): void {
        const el = this._element
        if (el.classList.contains('modal-static')) return
        el.classList.add('modal-static')
        executeAfterTransition(el, () => el.classList.remove('modal-static'))
    }
}

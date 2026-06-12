import { executeAfterTransition, reflow, triggerEvent } from './transition'

// Drop-in replacement for Bootstrap's Toast plugin: autohide timer, the
// .showing/.show/.hide class protocol, [data-bs-dismiss="toast"] wiring and
// *.bs.toast events.

export interface ToastOptions {
    autohide?: boolean
    delay?: number
}

export class Toast {
    private _element: HTMLElement
    private _autohide: boolean
    private _delay: number
    private _timeout: number | null = null
    private _isShown = false

    constructor(element: HTMLElement, options: ToastOptions = {}) {
        this._element = element
        this._autohide = options.autohide ?? true
        this._delay = options.delay ?? 5000
        element.addEventListener('click', this._onDismissClick)
    }

    show(): void {
        if (this._isShown) return
        const showEvent = triggerEvent(this._element, 'show.bs.toast')
        if (showEvent.defaultPrevented) return

        this._isShown = true
        const el = this._element
        el.classList.remove('hide')
        el.classList.add('show', 'showing')
        reflow(el)
        el.classList.remove('showing')

        executeAfterTransition(el, () => {
            triggerEvent(el, 'shown.bs.toast')
            if (this._autohide) {
                this._clearTimeout()
                this._timeout = window.setTimeout(() => this.hide(), this._delay)
            }
        })
    }

    hide(): void {
        if (!this._isShown) return
        const hideEvent = triggerEvent(this._element, 'hide.bs.toast')
        if (hideEvent.defaultPrevented) return

        this._isShown = false
        this._clearTimeout()
        const el = this._element
        el.classList.add('showing')

        executeAfterTransition(el, () => {
            el.classList.remove('show', 'showing')
            el.classList.add('hide')
            triggerEvent(el, 'hidden.bs.toast')
        })
    }

    dispose(): void {
        this._clearTimeout()
        this._element.removeEventListener('click', this._onDismissClick)
    }

    private _clearTimeout(): void {
        if (this._timeout !== null) {
            window.clearTimeout(this._timeout)
            this._timeout = null
        }
    }

    private _onDismissClick = (event: Event): void => {
        const target = event.target as Element
        if (target.closest('[data-bs-dismiss="toast"]')) this.hide()
    }
}

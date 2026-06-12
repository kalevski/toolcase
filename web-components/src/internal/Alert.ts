import { executeAfterTransition, triggerEvent } from './transition'

// Drop-in replacement for Bootstrap's Alert plugin: close() fades the element
// out (.show removal on .fade) and removes it, firing close/closed.bs.alert.
// [data-bs-dismiss="alert"] buttons inside the element trigger close().

export class Alert {
    private _element: HTMLElement

    constructor(element: HTMLElement) {
        this._element = element
        element.addEventListener('click', this._onDismissClick)
    }

    close(): void {
        const el = this._element
        const closeEvent = triggerEvent(el, 'close.bs.alert')
        if (closeEvent.defaultPrevented) return

        el.classList.remove('show')
        executeAfterTransition(
            el,
            () => {
                el.remove()
                triggerEvent(el, 'closed.bs.alert')
            },
            el.classList.contains('fade'),
        )
    }

    dispose(): void {
        this._element.removeEventListener('click', this._onDismissClick)
    }

    private _onDismissClick = (event: Event): void => {
        const target = event.target as Element
        if (target.closest('[data-bs-dismiss="alert"]')) this.close()
    }
}

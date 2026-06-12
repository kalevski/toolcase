import { executeAfterTransition, reflow, triggerEvent } from './transition'

// Drop-in replacement for Bootstrap's Tab plugin: activates the clicked
// .nav-link, deactivates its siblings within the closest .nav, and toggles the
// matching .tab-pane (href / data-bs-target selector) with the .fade/.show
// protocol. Fires show/shown.bs.tab with relatedTarget.

export class Tab {
    private _element: HTMLElement

    constructor(element: HTMLElement) {
        this._element = element
        element.addEventListener('click', this._onClick)
    }

    show(): void {
        const el = this._element
        if (
            el.classList.contains('active') ||
            el.hasAttribute('disabled') ||
            el.classList.contains('disabled')
        )
            return

        const nav = el.closest('.nav, [role="tablist"]')
        const previous = nav?.querySelector<HTMLElement>('.nav-link.active') ?? null

        const showEvent = triggerEvent(el, 'show.bs.tab', { relatedTarget: previous })
        if (showEvent.defaultPrevented) return

        if (previous) {
            previous.classList.remove('active')
            previous.setAttribute('aria-selected', 'false')
            const previousPane = this._paneFor(previous)
            previousPane?.classList.remove('active', 'show')
        }

        el.classList.add('active')
        el.setAttribute('aria-selected', 'true')

        const pane = this._paneFor(el)
        if (pane) {
            pane.classList.add('active')
            if (pane.classList.contains('fade')) {
                reflow(pane)
                pane.classList.add('show')
                executeAfterTransition(pane, () => {
                    triggerEvent(el, 'shown.bs.tab', { relatedTarget: previous })
                })
                return
            }
        }
        triggerEvent(el, 'shown.bs.tab', { relatedTarget: previous })
    }

    dispose(): void {
        this._element.removeEventListener('click', this._onClick)
    }

    private _paneFor(link: HTMLElement): HTMLElement | null {
        const selector = link.getAttribute('data-bs-target') ?? link.getAttribute('href')
        if (!selector || !selector.startsWith('#') || selector.length < 2) return null
        return document.querySelector<HTMLElement>(selector)
    }

    private _onClick = (event: Event): void => {
        event.preventDefault()
        this.show()
    }
}

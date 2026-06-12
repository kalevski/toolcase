import { createPopper, Instance as PopperInstance, Placement } from '@popperjs/core'
import { triggerEvent } from './transition'

// Drop-in replacement for Bootstrap's Dropdown plugin: Popper-positioned menu,
// outside-click / Escape handling honouring data-bs-auto-close
// (true | inside | outside | false), and *.bs.dropdown events on the toggle.

type AutoClose = 'true' | 'inside' | 'outside' | 'false'

const PLACEMENT_BY_DIRECTION: Record<string, Placement> = {
    dropup: 'top-start',
    dropend: 'right-start',
    dropstart: 'left-start',
    dropdown: 'bottom-start',
}

export class Dropdown {
    private _toggle: HTMLElement
    private _menu: HTMLElement | null
    private _popper: PopperInstance | null = null
    private _isShown = false

    constructor(toggle: HTMLElement) {
        this._toggle = toggle
        const parent = toggle.closest('.dropdown, .dropup, .dropend, .dropstart, .btn-group')
        this._menu = parent?.querySelector<HTMLElement>('.dropdown-menu') ?? null
        toggle.addEventListener('click', this._onToggleClick)
    }

    show(): void {
        if (this._isShown || !this._menu) return
        const showEvent = triggerEvent(this._toggle, 'show.bs.dropdown')
        if (showEvent.defaultPrevented) return

        this._isShown = true
        this._popper = createPopper(this._toggle, this._menu, {
            placement: this._placement(),
            modifiers: [{ name: 'offset', options: { offset: [0, 2] } }],
        })
        this._menu.classList.add('show')
        this._menu.setAttribute('data-bs-popper', 'static')
        this._toggle.classList.add('show')
        this._toggle.setAttribute('aria-expanded', 'true')

        document.addEventListener('mousedown', this._onDocumentClick)
        document.addEventListener('keydown', this._onKeydown)
        triggerEvent(this._toggle, 'shown.bs.dropdown')
    }

    hide(): void {
        if (!this._isShown || !this._menu) return
        const hideEvent = triggerEvent(this._toggle, 'hide.bs.dropdown')
        if (hideEvent.defaultPrevented) return

        this._isShown = false
        this._menu.classList.remove('show')
        this._menu.removeAttribute('data-bs-popper')
        this._toggle.classList.remove('show')
        this._toggle.setAttribute('aria-expanded', 'false')
        this._popper?.destroy()
        this._popper = null

        document.removeEventListener('mousedown', this._onDocumentClick)
        document.removeEventListener('keydown', this._onKeydown)
        triggerEvent(this._toggle, 'hidden.bs.dropdown')
    }

    toggle(): void {
        if (this._isShown) this.hide()
        else this.show()
    }

    dispose(): void {
        this._toggle.removeEventListener('click', this._onToggleClick)
        document.removeEventListener('mousedown', this._onDocumentClick)
        document.removeEventListener('keydown', this._onKeydown)
        this._popper?.destroy()
        this._popper = null
    }

    private _autoClose(): AutoClose {
        const raw = this._toggle.getAttribute('data-bs-auto-close')
        return raw === 'inside' || raw === 'outside' || raw === 'false' ? raw : 'true'
    }

    private _placement(): Placement {
        const parent = this._toggle.closest('.dropup, .dropend, .dropstart, .dropdown')
        for (const cls of ['dropup', 'dropend', 'dropstart', 'dropdown']) {
            if (parent?.classList.contains(cls)) return PLACEMENT_BY_DIRECTION[cls]
        }
        return 'bottom-start'
    }

    private _onToggleClick = (event: Event): void => {
        event.preventDefault()
        this.toggle()
    }

    private _onDocumentClick = (event: MouseEvent): void => {
        const target = event.target as Element
        if (this._toggle.contains(target)) return

        const autoClose = this._autoClose()
        const insideMenu = this._menu?.contains(target) ?? false
        if (autoClose === 'false') return
        if (insideMenu && autoClose === 'outside') return
        if (!insideMenu && autoClose === 'inside') return

        // Let menu-item clicks complete before closing.
        if (insideMenu) {
            document.addEventListener('click', () => this.hide(), { once: true })
            return
        }
        this.hide()
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') return
        this.hide()
        this._toggle.focus()
    }
}

import { executeAfterTransition, reflow } from './transition'

// Shared <div class="modal-backdrop|offcanvas-backdrop"> helper for Modal and
// Offcanvas. One backdrop per plugin instance; fade in/out via .fade/.show.

export class Backdrop {
    private _element: HTMLDivElement | null = null
    private _className: string

    constructor(className: 'modal-backdrop' | 'offcanvas-backdrop') {
        this._className = className
    }

    show(onClick?: () => void): void {
        if (this._element) return
        const el = document.createElement('div')
        el.className = `${this._className} fade`
        if (onClick) el.addEventListener('mousedown', onClick)
        document.body.appendChild(el)
        reflow(el)
        el.classList.add('show')
        this._element = el
    }

    hide(): void {
        const el = this._element
        if (!el) return
        this._element = null
        el.classList.remove('show')
        executeAfterTransition(el, () => el.remove())
    }

    dispose(): void {
        this._element?.remove()
        this._element = null
    }
}

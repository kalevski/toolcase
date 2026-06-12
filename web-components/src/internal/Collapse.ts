import { executeAfterTransition, reflow, triggerEvent } from './transition'

// Drop-in replacement for Bootstrap's Collapse plugin covering the surface the
// tc-* components use: show/hide/toggle/dispose, the
// .collapse/.collapsing/.show class protocol (vertical + .collapse-horizontal),
// *.bs.collapse events, accordion exclusivity via data-bs-parent, and click
// wiring for [data-bs-toggle="collapse"] togglers (Bootstrap's data API did
// this globally; here each instance binds its own togglers).

export interface CollapseOptions {
    toggle?: boolean
    parent?: string | Element | null
}

const instances = new WeakMap<Element, Collapse>()

export class Collapse {
    private _element: HTMLElement
    private _parent: Element | null
    private _togglers: HTMLElement[]
    private _transitioning = false
    private _disposed = false

    constructor(element: HTMLElement, options: CollapseOptions = {}) {
        this._element = element
        this._parent = this._resolveParent(options.parent)
        this._togglers = this._findTogglers()
        for (const toggler of this._togglers) {
            toggler.addEventListener('click', this._onTogglerClick)
        }
        instances.set(element, this)
        this._syncTogglers(this._isShown())
        if (options.toggle) this.toggle()
    }

    static getInstance(element: Element | null): Collapse | null {
        return element ? (instances.get(element) ?? null) : null
    }

    static getOrCreateInstance(element: HTMLElement, options: CollapseOptions = {}): Collapse {
        return Collapse.getInstance(element) ?? new Collapse(element, options)
    }

    show(): void {
        if (this._transitioning || this._isShown()) return

        const showEvent = triggerEvent(this._element, 'show.bs.collapse')
        if (showEvent.defaultPrevented) return

        // Accordion behaviour: close every other open collapse under the parent.
        if (this._parent) {
            for (const sibling of this._parent.querySelectorAll<HTMLElement>(
                '.collapse.show, .collapse.collapsing',
            )) {
                if (sibling === this._element) continue
                const instance = Collapse.getInstance(sibling)
                if (instance) instance.hide()
            }
        }

        const dimension = this._dimension()
        const el = this._element
        el.classList.remove('collapse')
        el.classList.add('collapsing')
        el.style[dimension] = '0'
        this._syncTogglers(true)
        this._transitioning = true

        reflow(el)
        const scrollSize = dimension === 'height' ? el.scrollHeight : el.scrollWidth
        el.style[dimension] = `${scrollSize}px`

        executeAfterTransition(el, () => {
            this._transitioning = false
            el.classList.remove('collapsing')
            el.classList.add('collapse', 'show')
            el.style[dimension] = ''
            triggerEvent(el, 'shown.bs.collapse')
        })
    }

    hide(): void {
        if (this._transitioning || !this._isShown()) return

        const hideEvent = triggerEvent(this._element, 'hide.bs.collapse')
        if (hideEvent.defaultPrevented) return

        const dimension = this._dimension()
        const el = this._element
        el.style[dimension] = `${el.getBoundingClientRect()[dimension]}px`
        reflow(el)
        el.classList.add('collapsing')
        el.classList.remove('collapse', 'show')
        this._syncTogglers(false)
        this._transitioning = true

        el.style[dimension] = ''
        executeAfterTransition(el, () => {
            this._transitioning = false
            el.classList.remove('collapsing')
            el.classList.add('collapse')
            triggerEvent(el, 'hidden.bs.collapse')
        })
    }

    toggle(): void {
        if (this._isShown()) this.hide()
        else this.show()
    }

    dispose(): void {
        if (this._disposed) return
        this._disposed = true
        for (const toggler of this._togglers) {
            toggler.removeEventListener('click', this._onTogglerClick)
        }
        instances.delete(this._element)
    }

    private _onTogglerClick = (event: Event): void => {
        event.preventDefault()
        this.toggle()
    }

    private _isShown(): boolean {
        return this._element.classList.contains('show')
    }

    private _dimension(): 'width' | 'height' {
        return this._element.classList.contains('collapse-horizontal') ? 'width' : 'height'
    }

    private _resolveParent(parent: string | Element | null | undefined): Element | null {
        if (parent instanceof Element) return parent
        if (typeof parent === 'string') return document.querySelector(parent)
        const attr = this._element.getAttribute('data-bs-parent')
        return attr ? document.querySelector(attr) : null
    }

    private _findTogglers(): HTMLElement[] {
        const id = this._element.id
        if (!id) return []
        const selector = `[data-bs-toggle="collapse"][data-bs-target="#${CSS.escape(id)}"]`
        return Array.from(document.querySelectorAll<HTMLElement>(selector))
    }

    private _syncTogglers(shown: boolean): void {
        for (const toggler of this._togglers) {
            toggler.classList.toggle('collapsed', !shown)
            toggler.setAttribute('aria-expanded', String(shown))
        }
    }
}

import { createPopper, Instance as PopperInstance, Placement } from '@popperjs/core'
import { executeAfterTransition, reflow, triggerEvent } from './transition'

// Drop-in replacement for Bootstrap's Tooltip plugin (Popover subclasses it).
// Renders the Bootstrap 5.3 tip markup into document.body, positions it with
// Popper (arrow keyed off [data-popper-placement] like Bootstrap), and honours
// the trigger list ('hover focus', 'click', 'manual' combinations).

export interface TooltipOptions {
    title?: string
    content?: string
    placement?: 'auto' | 'top' | 'right' | 'bottom' | 'left'
    trigger?: string
    html?: boolean
}

export class Tooltip {
    protected _eventNamespace = 'tooltip'
    protected _element: HTMLElement
    protected _options: Required<Pick<TooltipOptions, 'placement' | 'trigger' | 'html'>> &
        TooltipOptions
    private _tip: HTMLElement | null = null
    private _popper: PopperInstance | null = null
    private _isShown = false

    constructor(element: HTMLElement, options: TooltipOptions = {}) {
        this._element = element
        this._options = {
            title: options.title ?? '',
            content: options.content ?? '',
            placement: options.placement ?? 'auto',
            trigger: options.trigger ?? 'hover focus',
            html: options.html ?? false,
        }
        this._bindTriggers()
    }

    show(): void {
        if (this._isShown || !this._hasContent()) return
        const showEvent = triggerEvent(this._element, `show.bs.${this._eventNamespace}`)
        if (showEvent.defaultPrevented) return

        this._isShown = true
        const tip = this._createTip()
        this._tip = tip
        document.body.appendChild(tip)

        this._popper = createPopper(this._element, tip, {
            placement: this._options.placement as Placement,
            modifiers: [
                { name: 'offset', options: { offset: [0, this._arrowOffset()] } },
                {
                    name: 'arrow',
                    options: { element: `.${this._eventNamespace}-arrow`, padding: 4 },
                },
            ],
        })

        reflow(tip)
        tip.classList.add('show')
        executeAfterTransition(tip, () => {
            triggerEvent(this._element, `shown.bs.${this._eventNamespace}`)
        })
    }

    hide(): void {
        if (!this._isShown) return
        const hideEvent = triggerEvent(this._element, `hide.bs.${this._eventNamespace}`)
        if (hideEvent.defaultPrevented) return

        this._isShown = false
        const tip = this._tip
        if (!tip) return
        tip.classList.remove('show')
        executeAfterTransition(tip, () => {
            this._destroyTip()
            triggerEvent(this._element, `hidden.bs.${this._eventNamespace}`)
        })
    }

    toggle(): void {
        if (this._isShown) this.hide()
        else this.show()
    }

    dispose(): void {
        this._unbindTriggers()
        this._destroyTip()
    }

    /** Bootstrap markup contract — overridden by Popover. */
    protected _createTip(): HTMLElement {
        const tip = document.createElement('div')
        tip.className = 'tooltip bs-tooltip-auto fade'
        tip.setAttribute('role', 'tooltip')
        const arrow = document.createElement('div')
        arrow.className = 'tooltip-arrow'
        const inner = document.createElement('div')
        inner.className = 'tooltip-inner'
        this._setContent(inner, this._options.title ?? '')
        tip.append(arrow, inner)
        return tip
    }

    protected _hasContent(): boolean {
        return Boolean(this._options.title)
    }

    protected _arrowOffset(): number {
        return 6
    }

    protected _setContent(target: HTMLElement, value: string): void {
        if (this._options.html) target.innerHTML = value
        else target.textContent = value
    }

    private _destroyTip(): void {
        this._popper?.destroy()
        this._popper = null
        this._tip?.remove()
        this._tip = null
    }

    private _triggers(): string[] {
        return this._options.trigger.split(' ').filter(Boolean)
    }

    private _bindTriggers(): void {
        for (const trigger of this._triggers()) {
            if (trigger === 'hover') {
                this._element.addEventListener('mouseenter', this._onEnter)
                this._element.addEventListener('mouseleave', this._onLeave)
            } else if (trigger === 'focus') {
                this._element.addEventListener('focusin', this._onEnter)
                this._element.addEventListener('focusout', this._onLeave)
            } else if (trigger === 'click') {
                this._element.addEventListener('click', this._onClick)
            }
        }
    }

    private _unbindTriggers(): void {
        this._element.removeEventListener('mouseenter', this._onEnter)
        this._element.removeEventListener('mouseleave', this._onLeave)
        this._element.removeEventListener('focusin', this._onEnter)
        this._element.removeEventListener('focusout', this._onLeave)
        this._element.removeEventListener('click', this._onClick)
    }

    private _onEnter = (): void => this.show()
    private _onLeave = (): void => this.hide()
    private _onClick = (): void => this.toggle()
}

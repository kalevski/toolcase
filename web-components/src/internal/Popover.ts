import { Tooltip, TooltipOptions } from './Tooltip'

// Popover = Tooltip with the Bootstrap popover markup (header + body) and
// click as the default trigger. Events fire as *.bs.popover.

export class Popover extends Tooltip {
    constructor(element: HTMLElement, options: TooltipOptions = {}) {
        super(element, { trigger: 'click', ...options })
        this._eventNamespace = 'popover'
    }

    protected _createTip(): HTMLElement {
        const tip = document.createElement('div')
        tip.className = 'popover bs-popover-auto fade'
        tip.setAttribute('role', 'tooltip')

        const arrow = document.createElement('div')
        arrow.className = 'popover-arrow'
        tip.appendChild(arrow)

        if (this._options.title) {
            const header = document.createElement('h3')
            header.className = 'popover-header'
            this._setContent(header, this._options.title)
            tip.appendChild(header)
        }

        const body = document.createElement('div')
        body.className = 'popover-body'
        this._setContent(body, this._options.content ?? '')
        tip.appendChild(body)
        return tip
    }

    protected _hasContent(): boolean {
        return Boolean(this._options.title || this._options.content)
    }

    protected _arrowOffset(): number {
        return 8
    }
}

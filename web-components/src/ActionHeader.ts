import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-action-header'

export interface ActionHeaderAction {
    key: string
    label?: string
    icon?: string
    variant?: string
    disabled?: boolean
}

export class ActionHeader extends HTMLElement {
    private _initialised = false
    private _actions: ActionHeaderAction[] = []
    private _onExec: ((key: string) => void) | null = null
    private _boundHandleClick: (e: Event) => void

    static get observedAttributes(): string[] {
        return ['disabled']
    }

    constructor() {
        super()
        this._boundHandleClick = this._handleClick.bind(this)
    }

    connectedCallback(): void {
        this.addEventListener('click', this._boundHandleClick)
        if (!this._initialised) {
            this._initialised = true
            this.render()
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._boundHandleClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-action-header-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-action-header-content')
        if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
    }

    get actions(): ActionHeaderAction[] {
        return this._actions
    }

    set actions(value: ActionHeaderAction[]) {
        this._actions = Array.isArray(value) ? value : []
        if (this.isConnected && this._initialised) {
            const inner = this.querySelector('.tc-action-header-content')
            const slotContent = inner ? Array.from(inner.childNodes) : []
            this.render()
            const newInner = this.querySelector('.tc-action-header-content')
            if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
        }
    }

    get onExec(): ((key: string) => void) | null {
        return this._onExec
    }

    set onExec(fn: ((key: string) => void) | null) {
        this._onExec = typeof fn === 'function' ? fn : null
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }

    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private _handleClick(e: Event): void {
        if (this.disabled) return
        const btn = (e.target as Element).closest('button[data-action-key]')
        if (!btn) return
        const key = (btn as HTMLElement).dataset['actionKey']
        if (!key) return
        const action = this._actions.find((a) => a.key === key)
        if (!action || action.disabled) return
        this.dispatchEvent(
            new CustomEvent('tc-exec', { bubbles: true, composed: true, detail: { key } }),
        )
        if (typeof this._onExec === 'function') {
            this._onExec(key)
        }
    }

    private _renderIcon(name: string): string {
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (!svgStr) return ''
        return icon(svgStr, 'tc-action-header-icon')
    }

    private render(): void {
        const disabled = this.disabled
        const extraClass = this.className ? ` ${this.className}` : ''

        const actionsHtml = this._actions
            .map((action) => {
                const variant = action.variant ?? 'secondary'
                const isDisabled = disabled || !!action.disabled
                const disabledAttr = isDisabled ? ' disabled' : ''
                const iconHtml = action.icon ? this._renderIcon(action.icon) : ''
                const labelHtml = action.label ? `<span>${action.label}</span>` : ''
                return `<button type="button" class="btn btn-sm btn-${variant}" data-action-key="${action.key}"${disabledAttr}>${iconHtml}${labelHtml}</button>`
            })
            .join('')

        // THE HOST IS THE HEADER ROW: the title the consumer wrote stays their
        // child on the left, and the action buttons are appended after it (rule 1).
        setHostClass(
            this,
            `tc-action-header d-flex align-items-center justify-content-between${extraClass}`,
        )
        patchHtml(this, `<div class="tc-action-header-actions d-flex gap-2">${actionsHtml}</div>`, {
            at: 'end',
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ActionHeader
    }
}

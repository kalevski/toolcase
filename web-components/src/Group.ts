import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { chevronDownIcon } from './icons'

const TAG_NAME = 'tc-group'

let _idCounter = 0

export class Group extends HTMLElement {
    private _initialised = false
    private _collapsed = false
    private _idPrefix: string

    onActionClick: (() => void) | null = null
    onToggle: ((collapsed: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'badge', 'default-collapsed', 'action-label', 'action-icon']
    }

    constructor() {
        super()
        this._idPrefix = `tc-group-${++_idCounter}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._collapsed = this.hasAttribute('default-collapsed')
            const slotContent = Array.from(this.childNodes)
            this.render()
            const body = this.querySelector('.tc-group-body')
            if (body) slotContent.forEach((n) => body.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'default-collapsed') return // only seeds initial state
        const body = this.querySelector('.tc-group-body')
        const slotContent = body ? Array.from(body.childNodes) : []
        this.render()
        const newBody = this.querySelector('.tc-group-body')
        if (newBody) slotContent.forEach((n) => newBody.appendChild(n))
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        this.setAttribute('label', v)
    }

    get badge(): string | null {
        return this.getAttribute('badge')
    }
    set badge(v: string | null) {
        if (v != null) this.setAttribute('badge', v)
        else this.removeAttribute('badge')
    }

    get defaultCollapsed(): boolean {
        return this.hasAttribute('default-collapsed')
    }
    set defaultCollapsed(v: boolean) {
        if (v) this.setAttribute('default-collapsed', '')
        else this.removeAttribute('default-collapsed')
    }

    get actionLabel(): string | null {
        return this.getAttribute('action-label')
    }
    set actionLabel(v: string | null) {
        if (v != null) this.setAttribute('action-label', v)
        else this.removeAttribute('action-label')
    }

    get actionIcon(): string | null {
        return this.getAttribute('action-icon')
    }
    set actionIcon(v: string | null) {
        if (v != null) this.setAttribute('action-icon', v)
        else this.removeAttribute('action-icon')
    }

    get collapsed(): boolean {
        return this._collapsed
    }
    set collapsed(v: boolean) {
        if (this._collapsed === v) return
        this._collapsed = v
        if (!this._initialised) return
        this._applyCollapsedState()
        this.dispatchEvent(
            new CustomEvent('tc-toggle', {
                bubbles: true,
                composed: true,
                detail: { collapsed: this._collapsed },
            }),
        )
        if (typeof this.onToggle === 'function') this.onToggle(this._collapsed)
    }

    private _applyCollapsedState(): void {
        const toggle = this.querySelector<HTMLButtonElement>('.tc-group-toggle')
        const body = this.querySelector<HTMLElement>('.tc-group-body')
        if (toggle) toggle.setAttribute('aria-expanded', String(!this._collapsed))
        if (body) {
            if (this._collapsed) body.setAttribute('hidden', '')
            else body.removeAttribute('hidden')
        }
        const chevron = this.querySelector('.tc-group-chevron')
        if (chevron) {
            if (this._collapsed) {
                chevron.classList.remove('tc-group-chevron--open')
            } else {
                chevron.classList.add('tc-group-chevron--open')
            }
        }
    }

    private _onToggleClick = (): void => {
        this._collapsed = !this._collapsed
        this._applyCollapsedState()
        this.dispatchEvent(
            new CustomEvent('tc-toggle', {
                bubbles: true,
                composed: true,
                detail: { collapsed: this._collapsed },
            }),
        )
        if (typeof this.onToggle === 'function') this.onToggle(this._collapsed)
    }

    private _onActionClick = (e: Event): void => {
        e.stopPropagation()
        this.dispatchEvent(
            new CustomEvent('tc-action-click', {
                bubbles: true,
                composed: true,
                detail: {},
            }),
        )
        if (typeof this.onActionClick === 'function') this.onActionClick()
    }

    private render(): void {
        const label = this.label
        const badge = this.badge
        const actionLabel = this.actionLabel
        const actionIcon = this.actionIcon
        const collapsed = this._collapsed
        const headerId = `${this._idPrefix}-header`
        const bodyId = `${this._idPrefix}-body`

        const badgeHtml = badge != null ? `<span class="tc-group-badge">${esc(badge)}</span>` : ''

        const chevronHtml = `<span class="tc-group-chevron${collapsed ? '' : ' tc-group-chevron--open'}" aria-hidden="true">${chevronDownIcon}</span>`

        let actionHtml = ''
        if (actionIcon || actionLabel) {
            const iconHtml = actionIcon ? lucideByName(actionIcon) : ''
            const labelHtml = actionLabel
                ? `<span class="tc-group-action-label">${esc(actionLabel)}</span>`
                : ''
            const ariaLabel = actionLabel ? ` aria-label="${esc(actionLabel)}"` : ''
            actionHtml = `<button type="button" class="tc-group-action"${ariaLabel}>${iconHtml}${labelHtml}</button>`
        }

        this.innerHTML = `<div class="tc-group">
<div class="tc-group-header" id="${headerId}">
<button type="button" class="tc-group-toggle" aria-expanded="${!collapsed}" aria-controls="${bodyId}">${chevronHtml}<span class="tc-group-label">${esc(label)}</span>${badgeHtml}</button>${actionHtml}
</div>
<div class="tc-group-body" id="${bodyId}" role="region" aria-labelledby="${headerId}"${collapsed ? ' hidden' : ''}></div>
</div>`

        const toggleBtn = this.querySelector<HTMLButtonElement>('.tc-group-toggle')
        if (toggleBtn) toggleBtn.addEventListener('click', this._onToggleClick)

        const actionBtn = this.querySelector<HTMLButtonElement>('.tc-group-action')
        if (actionBtn) actionBtn.addEventListener('click', this._onActionClick)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Group
    }
}

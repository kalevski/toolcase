import * as LucideIcons from 'lucide-static'
import { icon, chevronDownIcon } from './icons'

const TAG_NAME = 'tc-action-items'

export interface ActionItem {
    key: string
    label: string
    /** Lucide icon name in PascalCase (e.g. "Pencil", "Trash2"). Optional. */
    icon?: string
    disabled?: boolean
    danger?: boolean
    divider?: boolean
}

export class ActionItems extends HTMLElement {
    private _initialised = false
    private _items: ActionItem[] = []
    private _isOpen = false
    private _outsideHandler: ((e: MouseEvent) => void) | null = null

    onActionClick: ((key: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        // Clean up the document listener without trying to refocus.
        this._removeOutsideListener()
        if (this._isOpen) {
            const trigger = this._getTrigger()
            const menu = this._getMenu()
            if (trigger) trigger.setAttribute('aria-expanded', 'false')
            if (menu) menu.classList.remove('show')
            this._isOpen = false
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const span = this.querySelector('.tc-action-items-label')
        if (span) span.textContent = this.label
    }

    get label(): string {
        return this.getAttribute('label') ?? 'Actions'
    }
    set label(v: string) {
        this.setAttribute('label', v)
    }

    get items(): ActionItem[] {
        return this._items
    }
    set items(v: ActionItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this._renderMenu()
    }

    private _getTrigger(): HTMLButtonElement | null {
        return this.querySelector('.tc-action-items-trigger')
    }

    private _getMenu(): HTMLElement | null {
        return this.querySelector('.tc-action-items-menu')
    }

    private _getEnabledItems(): HTMLButtonElement[] {
        return Array.from(this.querySelectorAll<HTMLButtonElement>('.tc-action-items-item:not([disabled])'))
    }

    private _resolveIcon(name: string): string {
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (!svgStr) return ''
        return icon(svgStr)
    }

    private render(): void {
        this.innerHTML = `<button class="btn btn-sm btn-secondary tc-action-items-trigger" type="button" aria-haspopup="menu" aria-expanded="false"><span class="tc-action-items-label">${this.label}</span><span class="tc-action-items-caret" aria-hidden="true">${chevronDownIcon}</span></button><div class="tc-action-items-menu" role="menu"></div>`
        this._renderMenu()

        const trigger = this._getTrigger()
        if (trigger) {
            trigger.addEventListener('click', () => {
                if (this._isOpen) this._closeMenu(false)
                else this._openMenu()
            })
            trigger.addEventListener('keydown', (e: KeyboardEvent) => this._onTriggerKeydown(e))
        }

        const menu = this._getMenu()
        if (menu) {
            menu.addEventListener('keydown', (e: KeyboardEvent) => this._onMenuKeydown(e))
        }
    }

    private _renderMenu(): void {
        const menu = this._getMenu()
        if (!menu) return

        menu.innerHTML = this._items.map((item, idx) => {
            if (item.divider) {
                return `<div class="dropdown-divider" role="separator"></div>`
            }
            const disabled = item.disabled === true
            const dangerCls = item.danger ? ' tc-action-items-item--danger' : ''
            const disabledAttr = disabled ? ' disabled aria-disabled="true"' : ''
            const iconHtml = item.icon ? this._resolveIcon(item.icon) : ''
            return `<button class="tc-action-items-item dropdown-item${dangerCls}" role="menuitem" type="button" tabindex="-1" data-idx="${idx}"${disabledAttr}>${iconHtml}<span>${item.label}</span></button>`
        }).join('')

        // Bind click handlers via data-idx so we avoid key escaping in the DOM.
        Array.from(menu.querySelectorAll<HTMLButtonElement>('.tc-action-items-item:not([disabled])')).forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._items.length) {
                    this._selectItem(this._items[idx].key)
                }
            })
        })
    }

    private _openMenu(focusLast = false): void {
        this._isOpen = true
        const trigger = this._getTrigger()
        const menu = this._getMenu()
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (menu) menu.classList.add('show')

        const enabled = this._getEnabledItems()
        if (enabled.length > 0) {
            const target = focusLast ? enabled[enabled.length - 1] : enabled[0]
            target.focus()
        }

        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) {
                this._closeMenu(false)
            }
        }
        document.addEventListener('mousedown', this._outsideHandler)
    }

    private _closeMenu(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false
        const trigger = this._getTrigger()
        const menu = this._getMenu()
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (menu) menu.classList.remove('show')
        this._removeOutsideListener()
        if (refocus) trigger?.focus()
    }

    private _removeOutsideListener(): void {
        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
    }

    private _selectItem(key: string): void {
        this.dispatchEvent(new CustomEvent('tc-action-click', { bubbles: true, detail: { key } }))
        if (typeof this.onActionClick === 'function') this.onActionClick(key)
        this._closeMenu()
    }

    private _onTriggerKeydown(e: KeyboardEvent): void {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!this._isOpen) this._openMenu()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (!this._isOpen) this._openMenu(true)
        }
    }

    private _onMenuKeydown(e: KeyboardEvent): void {
        const enabled = this._getEnabledItems()
        if (enabled.length === 0) return

        const focused = document.activeElement as HTMLButtonElement
        const currentIdx = enabled.indexOf(focused)

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            enabled[(currentIdx + 1) % enabled.length].focus()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            enabled[(currentIdx - 1 + enabled.length) % enabled.length].focus()
        } else if (e.key === 'Home') {
            e.preventDefault()
            enabled[0].focus()
        } else if (e.key === 'End') {
            e.preventDefault()
            enabled[enabled.length - 1].focus()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            this._closeMenu()
        } else if (e.key === 'Tab') {
            this._closeMenu(false)
        } else if (e.key === 'Enter' || e.key === ' ') {
            if (focused && focused.classList.contains('tc-action-items-item') && !focused.disabled) {
                e.preventDefault()
                const idx = parseInt(focused.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._items.length) {
                    this._selectItem(this._items[idx].key)
                }
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ActionItems
    }
}

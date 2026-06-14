import * as LucideIcons from 'lucide-static'
import { icon, chevronRightIcon } from './icons'

const TAG_NAME = 'tc-context-menu'

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export interface ContextMenuItem {
    key: string
    label: string
    /** Lucide icon name in PascalCase (e.g. "Pencil", "Trash2"). Optional. */
    icon?: string
    disabled?: boolean
    separator?: boolean
    danger?: boolean
    children?: ContextMenuItem[]
}

export class ContextMenu extends HTMLElement {
    private _initialised = false
    private _items: ContextMenuItem[] = []
    private _isOpen = false
    private _longPressTimer: ReturnType<typeof setTimeout> | null = null
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _keyHandler: ((e: KeyboardEvent) => void) | null = null

    onSelect: ((key: string) => void) | null = null

    static get observedAttributes(): string[] {
        return []
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-context-menu-trigger')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._cancelLongPress()
        this._closeMenu(false)
    }

    attributeChangedCallback(): void {
        // No reflected attributes — state is property/interaction driven.
    }

    get items(): ContextMenuItem[] {
        return this._items
    }
    set items(v: ContextMenuItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) {
            if (this._isOpen) this._closeMenu(false)
            this._renderMenu()
        }
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private _getTrigger(): HTMLElement | null {
        return this.querySelector('.tc-context-menu-trigger')
    }

    private _getMenu(): HTMLElement | null {
        return this.querySelector('.tc-context-menu-list')
    }

    private _resolveIcon(name: string): string {
        const svgStr = (LucideIcons as Record<string, string>)[name]
        if (!svgStr) return ''
        return icon(svgStr)
    }

    private _renderItems(items: ContextMenuItem[]): string {
        return items.map(item => {
            if (item.separator) {
                return `<li class="tc-context-menu-separator" role="separator" aria-hidden="true"></li>`
            }
            const disabled = item.disabled === true
            const danger = item.danger === true
            const hasChildren = Array.isArray(item.children) && item.children.length > 0

            const disabledAttr = disabled ? ' aria-disabled="true"' : ''
            const hasPopupAttr = hasChildren ? ' aria-haspopup="menu" aria-expanded="false"' : ''
            const iconHtml = item.icon ? this._resolveIcon(item.icon) : ''
            const chevronHtml = hasChildren
                ? `<span class="tc-context-menu-chevron" aria-hidden="true">${chevronRightIcon}</span>`
                : ''

            let cls = 'tc-context-menu-item'
            if (danger) cls += ' tc-context-menu-item--danger'
            if (disabled) cls += ' tc-context-menu-item--disabled'
            if (hasChildren) cls += ' tc-context-menu-item--has-children'

            const submenuHtml = hasChildren
                ? `<ul class="tc-context-menu-list tc-context-menu-list--sub" role="menu">${this._renderItems(item.children!)}</ul>`
                : ''

            // tabindex="-1": not in the Tab order; focused only programmatically (ARIA menu pattern)
            return `<li class="${cls}" role="menuitem"${disabledAttr}${hasPopupAttr} data-key="${esc(item.key)}" tabindex="-1">${iconHtml}<span class="tc-context-menu-label">${esc(item.label)}</span>${chevronHtml}${submenuHtml}</li>`
        }).join('')
    }

    private render(): void {
        this.innerHTML = `<div class="tc-context-menu-trigger"></div><ul class="tc-context-menu-list" role="menu" aria-label="Context menu"></ul>`
        this._renderMenu()

        const trigger = this._getTrigger()
        if (trigger) {
            trigger.addEventListener('contextmenu', this._onContextMenu)
            trigger.addEventListener('pointerdown', this._onPointerDown)
            trigger.addEventListener('pointerup', this._onPointerUp)
            trigger.addEventListener('pointercancel', this._cancelLongPress)
        }

        const menu = this._getMenu()
        if (menu) {
            menu.addEventListener('click', this._onMenuClick)
            menu.addEventListener('mouseover', this._onMenuMouseOver)
        }
    }

    private _renderMenu(): void {
        const menu = this._getMenu()
        if (!menu) return
        menu.innerHTML = this._renderItems(this._items)
    }

    // ── Trigger event handlers ────────────────────────────────────────────

    private _onContextMenu = (e: MouseEvent): void => {
        e.preventDefault()
        this._cancelLongPress()
        this._openMenu(e.clientX, e.clientY)
    }

    private _onPointerDown = (e: PointerEvent): void => {
        if (e.pointerType !== 'touch') return
        this._cancelLongPress()
        const startX = e.clientX
        const startY = e.clientY
        this._longPressTimer = setTimeout(() => {
            this._longPressTimer = null
            this._openMenu(startX, startY)
        }, 500)
    }

    private _onPointerUp = (): void => {
        this._cancelLongPress()
    }

    private _cancelLongPress = (): void => {
        if (this._longPressTimer !== null) {
            clearTimeout(this._longPressTimer)
            this._longPressTimer = null
        }
    }

    // ── Menu open / close ─────────────────────────────────────────────────

    private _openMenu(x: number, y: number): void {
        if (this._isOpen) this._closeMenu(false)

        const menu = this._getMenu()
        if (!menu) return

        // Place at pointer before measuring
        menu.style.left = `${x}px`
        menu.style.top = `${y}px`
        menu.classList.add('show')
        this._isOpen = true

        // Clamp to viewport after paint
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect()
            const vw = window.innerWidth
            const vh = window.innerHeight
            let adjX = x
            let adjY = y
            if (x + rect.width > vw) adjX = Math.max(0, vw - rect.width - 4)
            if (y + rect.height > vh) adjY = Math.max(0, vh - rect.height - 4)
            menu.style.left = `${adjX}px`
            menu.style.top = `${adjY}px`
        })

        // Focus first enabled item
        const firstItem = menu.querySelector<HTMLElement>(
            '.tc-context-menu-item:not(.tc-context-menu-item--disabled)'
        )
        firstItem?.focus()

        // Close on outside click
        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closeMenu()
        }
        document.addEventListener('mousedown', this._outsideHandler)

        // Keyboard navigation
        this._keyHandler = (e: KeyboardEvent) => this._onKeyDown(e)
        document.addEventListener('keydown', this._keyHandler)
    }

    private _closeMenu(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false

        const menu = this._getMenu()
        if (menu) {
            // Close all open submenus
            menu.querySelectorAll('.tc-context-menu-item--open').forEach(el => {
                el.classList.remove('tc-context-menu-item--open')
                el.setAttribute('aria-expanded', 'false')
            })
            menu.classList.remove('show')
        }

        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler)
            this._keyHandler = null
        }

        if (refocus) {
            const trigger = this._getTrigger()
            const focusable = trigger?.querySelector<HTMLElement>(
                'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            focusable?.focus()
        }
    }

    // ── Submenu open / close ──────────────────────────────────────────────

    private _openSubmenu(item: HTMLElement): void {
        if (item.classList.contains('tc-context-menu-item--open')) return
        const sub = item.querySelector<HTMLElement>('.tc-context-menu-list--sub')
        if (!sub) return

        item.classList.add('tc-context-menu-item--open')
        item.setAttribute('aria-expanded', 'true')

        // Flip submenu to the left when near right viewport edge
        requestAnimationFrame(() => {
            const itemRect = item.getBoundingClientRect()
            const subRect = sub.getBoundingClientRect()
            sub.classList.toggle('tc-context-menu-list--flip-x', itemRect.right + subRect.width > window.innerWidth)
        })
    }

    private _closeSubmenu(item: HTMLElement): void {
        const sub = item.querySelector<HTMLElement>('.tc-context-menu-list--sub')
        if (!sub) return
        // Recursively close nested submenus
        sub.querySelectorAll<HTMLElement>('.tc-context-menu-item--open').forEach(el => {
            el.classList.remove('tc-context-menu-item--open')
            el.setAttribute('aria-expanded', 'false')
        })
        item.classList.remove('tc-context-menu-item--open')
        item.setAttribute('aria-expanded', 'false')
    }

    // ── Menu event delegation ─────────────────────────────────────────────

    private _onMenuClick = (e: MouseEvent): void => {
        const target = (e.target as HTMLElement).closest<HTMLElement>('.tc-context-menu-item')
        if (!target) return
        if (target.classList.contains('tc-context-menu-item--disabled')) return

        if (target.classList.contains('tc-context-menu-item--has-children')) {
            if (target.classList.contains('tc-context-menu-item--open')) {
                this._closeSubmenu(target)
                target.focus()
            } else {
                this._openSubmenu(target)
            }
            return
        }

        const key = target.dataset.key
        if (key) this._selectItem(key)
    }

    private _onMenuMouseOver = (e: MouseEvent): void => {
        const target = (e.target as HTMLElement).closest<HTMLElement>('.tc-context-menu-item')
        if (!target) return
        if (target.classList.contains('tc-context-menu-item--disabled')) return

        // Skip if pointer came from inside the same item (e.g. submenu → parent li)
        const relatedTarget = e.relatedTarget as HTMLElement | null
        if (relatedTarget && target.contains(relatedTarget)) return

        // Close any open siblings at this level
        const parentMenu = target.parentElement
        if (parentMenu) {
            Array.from(
                parentMenu.querySelectorAll<HTMLElement>(':scope > .tc-context-menu-item--open')
            )
                .filter(s => s !== target)
                .forEach(s => this._closeSubmenu(s))
        }

        if (target.classList.contains('tc-context-menu-item--has-children')) {
            this._openSubmenu(target)
        }
    }

    // ── Keyboard navigation ───────────────────────────────────────────────

    private _onKeyDown(e: KeyboardEvent): void {
        if (!this._isOpen) return

        const focused = document.activeElement as HTMLElement | null
        if (!focused) return

        // Determine the menu level containing the focused item
        const currentMenu = focused.closest<HTMLElement>('.tc-context-menu-list')
        if (!currentMenu || !this.contains(currentMenu)) return

        const enabled = Array.from(
            currentMenu.querySelectorAll<HTMLElement>(':scope > .tc-context-menu-item:not(.tc-context-menu-item--disabled)')
        )
        const currentIdx = enabled.indexOf(focused)

        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault()
                enabled[(currentIdx + 1) % enabled.length]?.focus()
                break
            }
            case 'ArrowUp': {
                e.preventDefault()
                enabled[(currentIdx - 1 + enabled.length) % enabled.length]?.focus()
                break
            }
            case 'ArrowRight': {
                if (focused.classList.contains('tc-context-menu-item--has-children')) {
                    e.preventDefault()
                    this._openSubmenu(focused)
                    const sub = focused.querySelector<HTMLElement>('.tc-context-menu-list--sub')
                    const firstEnabled = sub?.querySelector<HTMLElement>(
                        '.tc-context-menu-item:not(.tc-context-menu-item--disabled)'
                    )
                    firstEnabled?.focus()
                }
                break
            }
            case 'ArrowLeft': {
                e.preventDefault()
                // Close current submenu and focus its parent item
                const parentItem = currentMenu.closest<HTMLElement>('.tc-context-menu-item')
                if (parentItem) {
                    this._closeSubmenu(parentItem)
                    parentItem.focus()
                }
                break
            }
            case 'Enter':
            case ' ': {
                e.preventDefault()
                if (focused.classList.contains('tc-context-menu-item--has-children')) {
                    this._openSubmenu(focused)
                    const sub = focused.querySelector<HTMLElement>('.tc-context-menu-list--sub')
                    const firstEnabled = sub?.querySelector<HTMLElement>(
                        '.tc-context-menu-item:not(.tc-context-menu-item--disabled)'
                    )
                    firstEnabled?.focus()
                } else {
                    const key = focused.dataset.key
                    if (key) this._selectItem(key)
                }
                break
            }
            case 'Escape': {
                e.preventDefault()
                const parentItem = currentMenu.closest<HTMLElement>('.tc-context-menu-item')
                if (parentItem) {
                    // Close inner submenu, return focus to its parent item
                    this._closeSubmenu(parentItem)
                    parentItem.focus()
                } else {
                    this._closeMenu()
                }
                break
            }
            case 'Tab': {
                // Tab exits the menu without refocusing the trigger
                this._closeMenu(false)
                break
            }
        }
    }

    // ── Selection ─────────────────────────────────────────────────────────

    private _selectItem(key: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { key },
            })
        )
        if (typeof this.onSelect === 'function') this.onSelect(key)
        this._closeMenu()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ContextMenu
    }
}

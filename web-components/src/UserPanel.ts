import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-user-panel'

export interface UserPanelMenuItem {
    key: string
    label: string
    icon?: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    // 'gear' is the react/bootstrap name for the settings glyph; lucide calls it Settings.
    const normalised = name === 'gear' ? 'settings' : name
    const pascal = normalised
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

function deriveInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return ''
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export class UserPanel extends HTMLElement {
    private _initialised = false
    private _isMenuOpen = false
    private _menuOutsideHandler: ((e: MouseEvent) => void) | null = null
    private _menuItems: UserPanelMenuItem[] = []

    onIconClick: (() => void) | null = null
    onMenuClick: ((key: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['avatar-src', 'username', 'initials', 'plan', 'icon', 'icon-highlighted', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._removeMenuOutsideListener()
        this._isMenuOpen = false
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        if (this._isMenuOpen) this._closeMenu(false)
        this.render()
    }

    // ── Attribute getters/setters ────────────────────────────────────────────

    get avatarSrc(): string | null {
        return this.getAttribute('avatar-src')
    }
    set avatarSrc(v: string | null) {
        if (v != null) this.setAttribute('avatar-src', v)
        else this.removeAttribute('avatar-src')
    }

    get username(): string | null {
        return this.getAttribute('username')
    }
    set username(v: string | null) {
        if (v != null) this.setAttribute('username', v)
        else this.removeAttribute('username')
    }

    get initials(): string | null {
        return this.getAttribute('initials')
    }
    set initials(v: string | null) {
        if (v != null) this.setAttribute('initials', v)
        else this.removeAttribute('initials')
    }

    get plan(): string | null {
        return this.getAttribute('plan')
    }
    set plan(v: string | null) {
        if (v != null) this.setAttribute('plan', v)
        else this.removeAttribute('plan')
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get iconHighlighted(): boolean {
        return this.hasAttribute('icon-highlighted')
    }
    set iconHighlighted(v: boolean) {
        if (v) this.setAttribute('icon-highlighted', '')
        else this.removeAttribute('icon-highlighted')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ── JS property getters/setters ─────────────────────────────────────────

    get menuItems(): UserPanelMenuItem[] {
        return this._menuItems
    }
    set menuItems(v: UserPanelMenuItem[]) {
        this._menuItems = Array.isArray(v) ? v : []
        if (this._initialised) {
            if (this._isMenuOpen) this._closeMenu(false)
            this.render()
        }
    }

    // ── Menu helpers ─────────────────────────────────────────────────────────

    private _hasMenu(): boolean {
        return this._menuItems.length > 0 && !this.loading
    }

    private _buildMenuItemsHtml(): string {
        return this._menuItems
            .map((item, idx) => {
                const iconHtml = item.icon ? lucideByName(item.icon) : ''
                const iconSpan = iconHtml
                    ? `<span class="tc-user-panel-menu-icon" aria-hidden="true">${iconHtml}</span>`
                    : ''
                return (
                    `<button class="tc-user-panel-menu-item" role="menuitem" type="button" tabindex="-1"` +
                    ` data-idx="${idx}">` +
                    `${iconSpan}<span class="tc-user-panel-menu-label">${esc(item.label)}</span></button>`
                )
            })
            .join('')
    }

    private _toggleMenu(): void {
        if (!this._hasMenu()) return
        if (this._isMenuOpen) this._closeMenu(false)
        else this._openMenu()
    }

    private _openMenu(): void {
        if (!this._hasMenu()) return
        this._isMenuOpen = true
        const trigger = this.querySelector<HTMLElement>('.tc-user-panel-info')
        const menuEl = this.querySelector<HTMLElement>('.tc-user-panel-menu')
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (menuEl) menuEl.classList.add('show')

        const enabled = Array.from(this.querySelectorAll<HTMLButtonElement>('.tc-user-panel-menu-item'))
        if (enabled.length > 0) enabled[0].focus()

        this._menuOutsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closeMenu(false)
        }
        document.addEventListener('mousedown', this._menuOutsideHandler)
    }

    private _closeMenu(refocus = true): void {
        if (!this._isMenuOpen) return
        this._isMenuOpen = false
        const trigger = this.querySelector<HTMLElement>('.tc-user-panel-info')
        const menuEl = this.querySelector<HTMLElement>('.tc-user-panel-menu')
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (menuEl) menuEl.classList.remove('show')
        this._removeMenuOutsideListener()
        if (refocus) trigger?.focus()
    }

    private _removeMenuOutsideListener(): void {
        if (this._menuOutsideHandler) {
            document.removeEventListener('mousedown', this._menuOutsideHandler)
            this._menuOutsideHandler = null
        }
    }

    private _selectMenuItem(key: string): void {
        this.dispatchEvent(new CustomEvent('tc-menu-click', {
            bubbles: true,
            composed: true,
            detail: { key },
        }))
        if (typeof this.onMenuClick === 'function') this.onMenuClick(key)
        this._closeMenu()
    }

    // Arrow-function listeners so the same reference is reusable.

    private _onTriggerKeydown = (e: KeyboardEvent): void => {
        if (!this._hasMenu()) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            this._toggleMenu()
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!this._isMenuOpen) this._openMenu()
        }
    }

    private _onMenuKeydown = (e: KeyboardEvent): void => {
        const enabled = Array.from(this.querySelectorAll<HTMLButtonElement>('.tc-user-panel-menu-item'))
        if (!enabled.length) return
        const focused = document.activeElement as HTMLButtonElement
        const curIdx = enabled.indexOf(focused)

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            enabled[(curIdx + 1) % enabled.length].focus()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            enabled[(curIdx - 1 + enabled.length) % enabled.length].focus()
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
            if (focused?.classList.contains('tc-user-panel-menu-item')) {
                e.preventDefault()
                const idx = parseInt(focused.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._menuItems.length) {
                    this._selectMenuItem(this._menuItems[idx].key)
                }
            }
        }
    }

    private render(): void {
        if (this.loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            this.innerHTML = [
                '<div class="tc-user-panel tc-user-panel--loading" aria-hidden="true">',
                '<div class="tc-user-panel-skeleton tc-user-panel-skeleton--avatar"></div>',
                '<div class="tc-user-panel-info">',
                '<div class="tc-user-panel-skeleton tc-user-panel-skeleton--name"></div>',
                '<div class="tc-user-panel-skeleton tc-user-panel-skeleton--plan"></div>',
                '</div>',
                '</div>',
                '<span class="visually-hidden">Loading…</span>',
            ].join('')
            return
        }

        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const username = this.getAttribute('username') ?? ''
        const plan = this.getAttribute('plan') ?? 'Free'
        const avatarSrc = this.getAttribute('avatar-src')
        const initials = this.getAttribute('initials') || deriveInitials(username)
        const iconName = this.getAttribute('icon') || 'settings'
        const highlighted = this.iconHighlighted
        const hasMenu = this._hasMenu()

        const avatarHtml = avatarSrc
            ? `<img class="tc-user-panel-avatar tc-user-panel-avatar--img" src="${esc(avatarSrc)}" alt="${esc(username)}" />`
            : `<span class="tc-user-panel-avatar" role="img" aria-label="${esc(username)}">${esc(initials)}</span>`

        const infoAttrs = hasMenu
            ? ` role="button" tabindex="0" aria-haspopup="menu" aria-expanded="false"`
            : ''
        const infoHtml =
            `<div class="tc-user-panel-info" ${infoAttrs}>` +
            `<span class="tc-user-panel-name">${esc(username)}</span>` +
            `<span class="tc-user-panel-plan">${esc(plan)}</span>` +
            `</div>`

        const iconSvg = lucideByName(iconName)
        const iconBtnClass = 'tc-user-panel-icon' + (highlighted ? ' tc-user-panel-icon--highlighted' : '')
        const iconHtml =
            `<button type="button" class="${iconBtnClass}" aria-label="Settings">${iconSvg}</button>`

        const menuHtml = hasMenu
            ? `<div class="tc-user-panel-menu" role="menu">${this._buildMenuItemsHtml()}</div>`
            : ''

        this.innerHTML =
            `<div class="tc-user-panel">` +
            avatarHtml +
            infoHtml +
            iconHtml +
            `</div>` +
            menuHtml

        // Wire listeners after the innerHTML write.
        const iconBtn = this.querySelector<HTMLButtonElement>('.tc-user-panel-icon')
        if (iconBtn) {
            iconBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('tc-icon-click', {
                    bubbles: true,
                    composed: true,
                    detail: {},
                }))
                if (typeof this.onIconClick === 'function') this.onIconClick()
            })
        }

        if (hasMenu) {
            const trigger = this.querySelector<HTMLElement>('.tc-user-panel-info')
            if (trigger) {
                trigger.addEventListener('click', () => this._toggleMenu())
                trigger.addEventListener('keydown', this._onTriggerKeydown)
            }
            const menuEl = this.querySelector<HTMLElement>('.tc-user-panel-menu')
            if (menuEl) {
                Array.from(menuEl.querySelectorAll<HTMLButtonElement>('.tc-user-panel-menu-item')).forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt(btn.dataset.idx ?? '-1', 10)
                        if (idx >= 0 && idx < this._menuItems.length) {
                            this._selectMenuItem(this._menuItems[idx].key)
                        }
                    })
                })
                menuEl.addEventListener('keydown', this._onMenuKeydown)
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: UserPanel
    }
}

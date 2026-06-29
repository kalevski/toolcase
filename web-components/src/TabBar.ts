import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-tab-bar'

export type TabBarSize = 'sm' | 'md'
const SIZES: TabBarSize[] = ['sm', 'md']

export interface TabBarItem {
    id: string
    label: string
    icon?: string
    disabled?: boolean
}

export class TabBar extends HTMLElement {
    private _initialised = false
    private _tabs: TabBarItem[] = []

    onChange: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['active-id', 'size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'tablist')
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onHostClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onHostClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'active-id') {
            this._applyActiveState()
            return
        }
        this.render()
    }

    get tabs(): TabBarItem[] {
        return this._tabs
    }
    set tabs(v: TabBarItem[]) {
        this._tabs = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get activeId(): string {
        return this.getAttribute('active-id') ?? ''
    }
    set activeId(v: string) {
        if (v) this.setAttribute('active-id', v)
        else this.removeAttribute('active-id')
    }

    get size(): TabBarSize {
        const raw = this.getAttribute('size') as TabBarSize
        return SIZES.includes(raw) ? raw : 'md'
    }
    set size(v: TabBarSize) {
        this.setAttribute('size', SIZES.includes(v) ? v : 'md')
    }

    private _getTabbableId(activeId: string): string {
        const active = this._tabs.find((t) => t.id === activeId)
        if (active && !active.disabled) return activeId
        const firstEnabled = this._tabs.find((t) => !t.disabled)
        return firstEnabled?.id ?? activeId
    }

    private _selectTab(id: string, focusTab: boolean): void {
        const item = this._tabs.find((t) => t.id === id)
        if (!item || item.disabled) return
        const prev = this.activeId
        this.activeId = id
        if (focusTab) {
            const btn = this.querySelector<HTMLElement>(`[role="tab"][data-id="${CSS.escape(id)}"]`)
            if (btn) btn.focus()
        }
        if (id !== prev) {
            this.dispatchEvent(
                new CustomEvent('tc-change', {
                    bubbles: true,
                    composed: true,
                    detail: { id },
                }),
            )
            if (typeof this.onChange === 'function') this.onChange(id)
        }
    }

    private _applyActiveState(): void {
        const activeId = this.activeId
        const tabbableId = this._getTabbableId(activeId)
        this.querySelectorAll<HTMLElement>('[role="tab"]').forEach((btn) => {
            const id = btn.dataset.id ?? ''
            const isActive = id === activeId
            btn.setAttribute('aria-selected', String(isActive))
            btn.setAttribute('tabindex', id === tabbableId ? '0' : '-1')
            btn.classList.toggle('tc-tab-bar-tab--active', isActive)
        })
    }

    private _onHostClick = (e: Event): void => {
        const target = e.target as Element
        const tab = target.closest<HTMLButtonElement>('[role="tab"]')
        if (!tab || tab.disabled || tab.hasAttribute('disabled')) return
        const id = tab.dataset.id
        if (id != null) this._selectTab(id, true)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as Element
        const tab = target.closest<HTMLElement>('[role="tab"]')
        if (!tab) return

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const id = tab.dataset.id
            if (id != null) this._selectTab(id, true)
            return
        }

        const enabled = this._tabs.filter((t) => !t.disabled)
        if (enabled.length === 0) return
        const currentId = tab.dataset.id ?? ''
        let idx = enabled.findIndex((t) => t.id === currentId)
        if (idx === -1) idx = 0

        let nextIdx = -1
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % enabled.length
        else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + enabled.length) % enabled.length
        else if (e.key === 'Home') nextIdx = 0
        else if (e.key === 'End') nextIdx = enabled.length - 1

        if (nextIdx !== -1) {
            e.preventDefault()
            this._selectTab(enabled[nextIdx].id, true)
        }
    }

    private render(): void {
        const size = this.size
        const activeId = this.activeId
        const tabbableId = this._getTabbableId(activeId)

        SIZES.forEach((s) => this.classList.remove(`tc-tab-bar--${s}`))
        this.classList.add('tc-tab-bar', `tc-tab-bar--${size}`)

        this.innerHTML = this._tabs
            .map((tab) => {
                const isActive = tab.id === activeId
                const disabled = !!tab.disabled
                const iconHtml = tab.icon ? lucideByName(tab.icon) : ''
                return (
                    `<button` +
                    ` type="button"` +
                    ` role="tab"` +
                    ` class="tc-tab-bar-tab${isActive ? ' tc-tab-bar-tab--active' : ''}"` +
                    ` data-id="${esc(tab.id)}"` +
                    ` aria-selected="${isActive}"` +
                    ` tabindex="${tab.id === tabbableId ? '0' : '-1'}"` +
                    (disabled ? ' disabled aria-disabled="true"' : '') +
                    `>${iconHtml}<span class="tc-tab-bar-tab-label">${esc(tab.label)}</span></button>`
                )
            })
            .join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TabBar
    }
}

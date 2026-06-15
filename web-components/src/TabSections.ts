import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-tab-sections'

let _idCounter = 0

export interface TabSectionItem {
    key: string
    label: string
    content: string
    icon?: string
    disabled?: boolean
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')
    const svg = (LucideIcons as Record<string, string>)[pascal]
    return svg ? icon(svg, 'tc-tab-sections-tab-icon') : ''
}

export class TabSections extends HTMLElement {
    private _initialised = false
    private _items: TabSectionItem[] = []
    private _internalKey: string | null = null
    private _idPrefix: string

    onchangetab: ((key: string) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-tabsec-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['default-active-key', 'active-key', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this.addEventListener('click', this._onHostClick)
            this.addEventListener('keydown', this._onKeydown)
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onHostClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // A controlled active-key change only needs an in-place patch (the panels
        // are all rendered; we just toggle which one is shown). Everything else
        // (loading toggle, default-active-key) re-renders.
        if (name === 'active-key' && !this.hasAttribute('loading')) {
            this._applyActiveState(false)
            return
        }
        this.render()
    }

    // ── Props ────────────────────────────────────────────────────────────────

    get items(): TabSectionItem[] {
        return this._items
    }
    set items(v: TabSectionItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get defaultActiveKey(): string | null {
        return this.getAttribute('default-active-key')
    }
    set defaultActiveKey(v: string | null) {
        if (v != null) this.setAttribute('default-active-key', v)
        else this.removeAttribute('default-active-key')
    }

    get activeKey(): string | null {
        return this.getAttribute('active-key')
    }
    set activeKey(v: string | null) {
        if (v != null) this.setAttribute('active-key', v)
        else this.removeAttribute('active-key')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ── Active-key resolution ─────────────────────────────────────────────────

    private get _isControlled(): boolean {
        return this.hasAttribute('active-key')
    }

    /** The key whose panel is currently shown. */
    private _getActiveKey(): string {
        const keys = this._items.map(i => i.key)
        if (this._isControlled) {
            return this.getAttribute('active-key') ?? ''
        }
        if (this._internalKey && keys.includes(this._internalKey)) return this._internalKey
        const dflt = this.getAttribute('default-active-key')
        if (dflt && keys.includes(dflt)) return dflt
        const firstEnabled = this._items.find(i => !i.disabled)
        return firstEnabled?.key ?? this._items[0]?.key ?? ''
    }

    /** The key that owns roving tabindex 0 (active-and-enabled, else first enabled). */
    private _getTabbableKey(activeKey: string): string {
        const active = this._items.find(i => i.key === activeKey)
        if (active && !active.disabled) return activeKey
        const firstEnabled = this._items.find(i => !i.disabled)
        return firstEnabled?.key ?? activeKey
    }

    // ── Selection ──────────────────────────────────────────────────────────────

    private _selectTab(key: string, focusTab: boolean): void {
        const item = this._items.find(i => i.key === key)
        if (!item || item.disabled) return

        if (!this._isControlled) {
            const changed = this._internalKey !== key
            this._internalKey = key
            if (changed) this._applyActiveState(focusTab)
            else if (focusTab) this._focusTab(key)
        } else if (focusTab) {
            // Controlled: the active panel does not move on click; only focus does.
            this._focusTab(key)
        }

        this.dispatchEvent(new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            detail: { key },
        }))
        if (typeof this.onchangetab === 'function') this.onchangetab(key)
    }

    private _focusTab(key: string): void {
        const tab = this.querySelector<HTMLElement>(`[role="tab"][data-key="${CSS.escape(key)}"]`)
        if (tab) tab.focus()
    }

    /** Patch aria-selected / tabindex / hidden on the live DOM (no full render). */
    private _applyActiveState(focusTab: boolean): void {
        if (this.hasAttribute('loading')) return
        const activeKey = this._getActiveKey()
        const tabbableKey = this._getTabbableKey(activeKey)

        this.querySelectorAll<HTMLElement>('[role="tab"]').forEach(tab => {
            const k = tab.dataset.key ?? ''
            const isActive = k === activeKey
            tab.setAttribute('aria-selected', String(isActive))
            tab.setAttribute('tabindex', k === tabbableKey ? '0' : '-1')
            tab.classList.toggle('tc-tab-sections-tab--active', isActive)
        })
        this.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach(panel => {
            const k = panel.dataset.key ?? ''
            if (k === activeKey) {
                panel.removeAttribute('hidden')
                panel.setAttribute('aria-hidden', 'false')
            } else {
                panel.setAttribute('hidden', '')
                panel.setAttribute('aria-hidden', 'true')
            }
        })

        if (focusTab) this._focusTab(activeKey)
    }

    // ── Keyboard roving ──────────────────────────────────────────────────────

    private _onHostClick = (e: Event) => {
        const target = e.target as Element
        const tab = target.closest<HTMLElement>('[role="tab"]')
        if (!tab || tab.hasAttribute('disabled')) return
        const key = tab.dataset.key
        if (key != null) this._selectTab(key, true)
    }

    private _onKeydown = (e: KeyboardEvent) => {
        const target = e.target as Element
        const tab = target.closest<HTMLElement>('[role="tab"]')
        if (!tab) return

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const key = tab.dataset.key
            if (key != null) this._selectTab(key, true)
            return
        }

        // Build the enabled-tab ring for arrow navigation.
        const enabled = this._items.filter(i => !i.disabled)
        if (enabled.length === 0) return
        const currentKey = tab.dataset.key ?? ''
        let idx = enabled.findIndex(i => i.key === currentKey)
        if (idx === -1) idx = 0

        let nextIdx = -1
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % enabled.length
        else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + enabled.length) % enabled.length
        else if (e.key === 'Home') nextIdx = 0
        else if (e.key === 'End') nextIdx = enabled.length - 1

        if (nextIdx !== -1) {
            e.preventDefault()
            this._selectTab(enabled[nextIdx].key, true)
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private render(): void {
        if (this.hasAttribute('loading')) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            this.innerHTML =
                `<div class="tc-tab-sections tc-tab-sections--loading placeholder-glow" aria-hidden="true">` +
                    `<div class="tc-tab-sections-nav" role="presentation">` +
                        `<span class="placeholder tc-tab-sections-tab-skeleton"></span>` +
                        `<span class="placeholder tc-tab-sections-tab-skeleton"></span>` +
                        `<span class="placeholder tc-tab-sections-tab-skeleton"></span>` +
                    `</div>` +
                    `<div class="tc-tab-sections-panel">` +
                        `<span class="placeholder tc-tab-sections-line"></span>` +
                        `<span class="placeholder tc-tab-sections-line"></span>` +
                        `<span class="placeholder tc-tab-sections-line tc-tab-sections-line--short"></span>` +
                    `</div>` +
                `</div>` +
                `<span class="visually-hidden">Loading…</span>`
            return
        }

        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const activeKey = this._getActiveKey()
        const tabbableKey = this._getTabbableKey(activeKey)

        const tabsHtml = this._items.map((item, i) => {
            const tabId = `${this._idPrefix}-tab-${i}`
            const panelId = `${this._idPrefix}-panel-${i}`
            const isActive = item.key === activeKey
            const disabled = !!item.disabled
            const iconHtml = item.icon ? lucideByName(item.icon) : ''
            return `<button` +
                ` id="${tabId}"` +
                ` class="tc-tab-sections-tab${isActive ? ' tc-tab-sections-tab--active' : ''}"` +
                ` role="tab"` +
                ` type="button"` +
                ` data-key="${esc(item.key)}"` +
                ` aria-selected="${isActive}"` +
                ` aria-controls="${panelId}"` +
                ` tabindex="${item.key === tabbableKey ? '0' : '-1'}"` +
                (disabled ? ' disabled aria-disabled="true"' : '') +
                `>${iconHtml}<span class="tc-tab-sections-tab-label">${esc(item.label)}</span></button>`
        }).join('')

        const panelsHtml = this._items.map((item, i) => {
            const tabId = `${this._idPrefix}-tab-${i}`
            const panelId = `${this._idPrefix}-panel-${i}`
            const isActive = item.key === activeKey
            return `<div` +
                ` id="${panelId}"` +
                ` class="tc-tab-sections-panel"` +
                ` role="tabpanel"` +
                ` data-key="${esc(item.key)}"` +
                ` aria-labelledby="${tabId}"` +
                ` aria-hidden="${!isActive}"` +
                ` tabindex="0"` +
                (isActive ? '' : ' hidden') +
                `>${item.content ?? ''}</div>`
        }).join('')

        this.innerHTML =
            `<div class="tc-tab-sections">` +
                `<div class="tc-tab-sections-nav" role="tablist">${tabsHtml}</div>` +
                panelsHtml +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TabSections
    }
}

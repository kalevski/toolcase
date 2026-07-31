import { esc } from './internal/esc'

// tc-page-tabs — the phone page rail: a horizontal, SCROLLING, underline tab strip.
//
// THREE TAB-LIKE ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-tab-bar    desktop panel switcher. WRAPS to a second line when it runs out
//                 of width, and sits on its own hairline.
//   tc-page-tabs  this one. NEVER wraps. It scrolls horizontally and keeps the
//                 active tab in view. That is the whole difference and it is not
//                 cosmetic: a rail that wraps moves every pixel of the page below
//                 it, so a six-tab surface at 320px would jump a whole line the
//                 first time it rendered. Lives in tc-app-bar's `below` region.
//   tc-tab-dock   the fixed bottom dock — N equal columns of icon-over-label.
//
// LINK OR SWITCHER — one rule, and it decides three behaviours
//   A tab WITH `href` is a link. The page it names is a route, so the URL is the
//   source of truth: this element notifies and lets the navigation happen, it never
//   writes `active-id` itself, and the arrow keys move focus WITHOUT activating.
//   (Automatic activation across links would push one history entry per arrow
//   press — arrowing from tab 1 to tab 4 would leave three junk entries behind.)
//   A tab WITHOUT `href` is a switcher over panels that are already in the DOM.
//   Then this element owns `active-id` and the arrow keys activate as they move,
//   which is what tc-tab-bar does and what the ARIA tabs pattern prefers when
//   showing a panel is free.
//
// A client-side router takes over by calling preventDefault() — on the click, or on
// the cancelable `tc-change` — which suppresses the anchor's own navigation.

const TAG_NAME = 'tc-page-tabs'

export interface PageTabsItem {
    id: string
    label: string
    /** Makes the tab a real link. See "link or switcher" above. */
    href?: string
    /** Rendered as a parenthesised suffix on the label — `Филтри (2)`. */
    count?: number
    disabled?: boolean
}

export class PageTabs extends HTMLElement {
    private _initialised = false
    private _tabs: PageTabsItem[] = []

    onChange: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['active-id']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Left alone when the consumer has spoken: a rail of route links is
            // arguably a `nav`, and that is the consumer's call to make.
            if (!this.hasAttribute('role')) this.setAttribute('role', 'tablist')
            this._render()
            this._initialised = true
        }
        // Re-attached on every connect — a React move/remount disconnects then
        // reconnects without re-running the one-time init above.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        this._scrollActiveIntoView(false)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this._initialised || prev === next) return
        if (name === 'active-id') {
            this._applyActiveState()
            this._scrollActiveIntoView(true)
        }
    }

    get tabs(): PageTabsItem[] {
        return this._tabs
    }
    set tabs(v: PageTabsItem[]) {
        this._tabs = Array.isArray(v) ? v : []
        if (this._initialised) {
            this._render()
            this._scrollActiveIntoView(false)
        }
    }

    get activeId(): string {
        return this.getAttribute('active-id') ?? ''
    }
    set activeId(v: string) {
        if (v) this.setAttribute('active-id', v)
        else this.removeAttribute('active-id')
    }

    // ── Selection ────────────────────────────────────────────────────────────

    private _enabled(): PageTabsItem[] {
        return this._tabs.filter((t) => !t.disabled)
    }

    // The tab that holds the single tab stop. Roving tabindex: everything else is
    // -1, so Tab enters and leaves the rail once instead of stepping through six.
    private _tabbableId(): string {
        const activeId = this.activeId
        const active = this._tabs.find((t) => t.id === activeId)
        if (active && !active.disabled) return activeId
        return this._enabled()[0]?.id ?? activeId
    }

    /** Notify, and report whether a consumer cancelled the tab's own navigation. */
    private _select(id: string): boolean {
        const item = this._tabs.find((t) => t.id === id)
        if (!item || item.disabled) return true
        // A link's active state belongs to the URL, not to this element — writing
        // it here would leave the rail highlighting a route the app never reached
        // if the navigation was cancelled or failed.
        if (!item.href) this.activeId = id
        const event = new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { id, href: item.href ?? null },
        })
        this.dispatchEvent(event)
        if (typeof this.onChange === 'function') this.onChange(id)
        return event.defaultPrevented
    }

    private _applyActiveState(): void {
        const activeId = this.activeId
        const tabbableId = this._tabbableId()
        this.querySelectorAll<HTMLElement>(':scope > [role="tab"]').forEach((el) => {
            const id = el.dataset.id ?? ''
            const isActive = id === activeId
            el.setAttribute('aria-selected', String(isActive))
            el.setAttribute('tabindex', id === tabbableId ? '0' : '-1')
            el.classList.toggle('tc-page-tabs-tab--active', isActive)
        })
    }

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element | null
        if (!target?.closest) return
        const tab = target.closest<HTMLElement>('[role="tab"]')
        if (!tab || tab.parentElement !== this) return
        if (tab.getAttribute('aria-disabled') === 'true') return
        const id = tab.dataset.id
        if (id == null) return
        if (this._select(id)) e.preventDefault()
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as Element | null
        const tab = target?.closest?.<HTMLElement>('[role="tab"]')
        if (!tab || tab.parentElement !== this) return

        // Enter / Space activate whatever has focus, THROUGH THE CLICK PATH — this
        // handler must not notify by itself. Both keys are cancelled here (which
        // suppresses the native activation an <a> or a <button> would perform) and
        // replaced by one synthetic click, so `_onClick` stays the single place that
        // calls `_select`. Notifying here as well fired `tc-change` and `onChange`
        // TWICE per keypress on a link tab: once from this handler, once from the
        // click that followed it.
        if (e.key === 'Enter' || e.key === ' ') {
            if (tab.dataset.id == null) return
            e.preventDefault()
            tab.click()
            return
        }

        const enabled = this._enabled()
        if (enabled.length === 0) return
        let idx = enabled.findIndex((t) => t.id === (tab.dataset.id ?? ''))
        if (idx === -1) idx = 0

        let next = -1
        if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length
        else if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = enabled.length - 1
        if (next === -1) return

        e.preventDefault()
        const item = enabled[next]
        const el = this.querySelector<HTMLElement>(
            `:scope > [role="tab"][data-id="${CSS.escape(item.id)}"]`,
        )
        el?.focus()
        this._scrollIntoView(el, true)
        // Links move focus only — see "link or switcher" at the top of this file.
        if (!item.href) this._select(item.id)
    }

    // ── Keeping the active tab in view ───────────────────────────────────────

    private _scrollActiveIntoView(animate: boolean): void {
        this._scrollIntoView(
            this.querySelector<HTMLElement>(':scope > [aria-selected="true"]'),
            animate,
        )
    }

    // Deliberately NOT Element.scrollIntoView({ inline: 'center' }): that walks
    // every scrollable ancestor, so on a rail that does not overflow it would still
    // scroll the page (or the shell's content pane) to bring a tab "into view" that
    // was never out of it. This moves one element's scrollLeft and nothing else.
    private _scrollIntoView(el: HTMLElement | null, animate: boolean): void {
        if (!el) return
        const max = this.scrollWidth - this.clientWidth
        if (max <= 0) return // nothing to scroll; every tab is already visible
        // Rect-based rather than offsetLeft, which is measured from offsetParent —
        // and this host is not required to be one.
        const railLeft = this.getBoundingClientRect().left
        const box = el.getBoundingClientRect()
        const centred = box.left - railLeft + this.scrollLeft - (this.clientWidth - box.width) / 2
        const left = Math.max(0, Math.min(max, centred))
        if (Math.abs(left - this.scrollLeft) < 1) return
        const reduce =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        this.scrollTo({ left, behavior: animate && !reduce ? 'smooth' : 'auto' })
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private _render(): void {
        const activeId = this.activeId
        const tabbableId = this._tabbableId()

        this.innerHTML = this._tabs
            .map((tab) => {
                const isActive = tab.id === activeId
                const cls = `tc-page-tabs-tab${isActive ? ' tc-page-tabs-tab--active' : ''}`
                const common =
                    ` role="tab" class="${cls}" data-id="${esc(tab.id)}"` +
                    ` aria-selected="${isActive}"` +
                    ` tabindex="${tab.id === tabbableId ? '0' : '-1'}"`
                // The count is a parenthesised suffix inside the label rather than a
                // badge — the design writes `Филтри (2)`, and a badge here would
                // compete with the amber underline for the same 2px of attention.
                const label =
                    esc(tab.label) + (tab.count != null ? ` (${esc(String(tab.count))})` : '')
                const inner = `<span class="tc-page-tabs-tab-label">${label}</span>`
                if (tab.disabled) {
                    // <a> has no `disabled`, so a disabled tab is never a link —
                    // an inert <span> cannot be clicked or focused into.
                    return `<span${common} aria-disabled="true">${inner}</span>`
                }
                if (tab.href) {
                    return `<a href="${esc(tab.href)}"${common}>${inner}</a>`
                }
                return `<button type="button"${common}>${inner}</button>`
            })
            .join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PageTabs
    }
}

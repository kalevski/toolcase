import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'

// tc-tab-dock — the fixed bottom navigation dock: N equal columns of icon-over-label,
// with optional count badges, sitting against the device's bottom edge.
//
// THREE TAB-LIKE ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-tab-bar    desktop panel switcher. WRAPS to a second line when it runs out
//                 of width, and sits on its own hairline.
//   tc-page-tabs  the phone page rail — a horizontal underline strip that never
//                 wraps; it scrolls and keeps the active tab in view.
//   tc-tab-dock   this one. A GRID, not a row: every destination gets an equal
//                 share of the width whether there are three of them or five, the
//                 icon sits ABOVE a 10px label, and the whole thing is chrome
//                 pinned to the bottom edge rather than content in the page.
//
// Not a variant of tc-tab-bar: that element is a text switcher with an optional
// leading icon, a 2px underline on the active tab and a wrapping row. Turning it
// into this would change nearly every declaration behind a flag.
//
// LINK OR SWITCHER — the same rule tc-page-tabs uses
//   A tab WITH `href` is a link, so the URL owns the active state: this element
//   never writes `active-id` itself, and the arrow keys move focus without
//   activating. A tab WITHOUT `href` switches something already in the DOM, so
//   this element owns `active-id` and the arrows activate as they move.
//
// RE-TAP ON THE ACTIVE TAB IS NOT A CHANGE
//   Native bottom navs treat it as a third gesture: tap the active tab and its pane
//   scrolls to top; tap again and it pops to the tab's root. That cannot be derived
//   from a change event that never fires, so it gets its own event —
//   `tc-tab-dock-reselect`. Both events are cancelable, so a router can suppress the
//   anchor's navigation in either case.
//
// WHY IT RENDERS ITS OWN CHILDREN AND NEVER RE-PARENTS SLOTTED ONES
//   The tabs come from the `tabs` property, so there is nothing of the consumer's to
//   move. The library's older slot-distributing components re-parent slotted children
//   into a rendered skeleton, which breaks under react-dom (it removes a child with
//   `parentInstance.removeChild(child)` against the parent it BELIEVES the child has).
//   See the header comments in src/MobileShell.ts and src/AppBar.ts.

const TAG_NAME = 'tc-tab-dock'

// Above this the badge reads `99+`. A dock badge is a glance, not a figure: three
// characters is as wide as a 21px icon and the design's 16px pill has room for
// exactly that.
const BADGE_MAX = 99

// Auto-hide thresholds. Both exist to stop the dock flapping:
//   * within REVEAL_AT of the top the dock is always shown, so a short pane that
//     rubber-bands cannot strand the primary nav off-screen;
//   * a scroll step smaller than HIDE_DELTA is ignored, because momentum scrolling
//     reports sub-pixel reversals on the way to a stop.
const REVEAL_AT = 24
const HIDE_DELTA = 8

export interface TabDockItem {
    id: string
    /** 10px, and the design's labels are ~8 characters. Longer ones ellipsise. */
    label: string
    /** A lucide icon name (kebab or Pascal). Rendered at 21px, stroke 1.6. */
    icon: string
    /** Makes the tab a real link. See "link or switcher" above. */
    href?: string
    /**
     * Amber count pill over the icon's top-right corner. `0`, `''`, `null` and
     * `undefined` all render NOTHING — a zero badge is noise, not information.
     * Numbers above 99 render `99+`; any other string renders verbatim.
     */
    badge?: number | string | null
    /**
     * How the badge is SPOKEN, e.g. `'12 нови'` — the accessible name becomes
     * „Рецепти, 12 нови". Without it a screen reader gets the bare number, which
     * out of context is meaningless. Falls back to the badge text itself.
     */
    badgeLabel?: string
    disabled?: boolean
}

/** Detail of both `tc-tab-dock-change` and `tc-tab-dock-reselect`. */
export interface TabDockEventDetail {
    id: string
    /** The tab's `href`, or `null` on a switcher tab — a router needs the target. */
    href: string | null
}

interface ShellScrollDetail {
    scrolled?: boolean
    top?: number
}

/** `0` / `''` / `null` / `undefined` → nothing. `> 99` → `99+`. */
function badgeText(value: number | string | null | undefined): string {
    if (value == null) return ''
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || value <= 0) return ''
        return value > BADGE_MAX ? `${BADGE_MAX}+` : String(Math.trunc(value))
    }
    const text = String(value).trim()
    if (text === '') return ''
    // A numeric string is a count that happened to arrive as text (a JSON payload,
    // a data attribute), so it gets the same 0 / 99+ treatment as a number.
    const numeric = Number(text)
    if (Number.isFinite(numeric) && text === String(numeric)) {
        if (numeric <= 0) return ''
        return numeric > BADGE_MAX ? `${BADGE_MAX}+` : String(Math.trunc(numeric))
    }
    return text
}

export class TabDock extends HTMLElement {
    private _initialised = false
    private _tabs: TabDockItem[] = []
    private _shellScrollBound = false
    private _lastTop = 0
    private _seeded = false

    /** Called when a DIFFERENT tab is activated. Alongside `tc-tab-dock-change`. */
    onChange: ((id: string) => void) | null = null
    /** Called when the ALREADY-ACTIVE tab is activated. Alongside `tc-tab-dock-reselect`. */
    onReselect: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['active-id', 'auto-hide']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Left alone when the consumer has spoken — a dock of route links is
            // arguably a `nav`, and that is their call. Note the items keep
            // `role="tab"` either way; see the SKILL entry's accessibility section.
            if (!this.hasAttribute('role')) this.setAttribute('role', 'tablist')
            this._render()
            this._initialised = true
        }
        // Re-attached on every connect: a React move/remount disconnects then
        // reconnects without re-running the one-time init above. Re-adding the same
        // handler reference is a no-op, so repeating this is safe.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        this._syncShellScroll()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
        this._unbindShellScroll()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this._initialised || prev === next) return
        if (name === 'auto-hide') {
            this._syncShellScroll()
            // Turning it off must not leave the dock translated off-screen.
            if (!this.autoHide) this.reveal()
            return
        }
        if (name === 'active-id') this._applyActiveState()
    }

    get tabs(): TabDockItem[] {
        return this._tabs
    }
    set tabs(v: TabDockItem[]) {
        this._tabs = Array.isArray(v) ? v : []
        if (this._initialised) this._render()
    }

    get activeId(): string {
        return this.getAttribute('active-id') ?? ''
    }
    set activeId(v: string) {
        if (v) this.setAttribute('active-id', v)
        else this.removeAttribute('active-id')
    }

    /**
     * Hide on scroll-down, reveal on scroll-up, driven by `tc-shell-scroll`.
     *
     * OFF BY DEFAULT, deliberately. The design never shows the dock hidden, and a
     * primary nav that disappears while you read is a usability regression on a
     * content app — you cannot navigate to what you cannot see. It exists for
     * reading surfaces (a recipe body, a cooking step) where the extra 61px of
     * content is worth more than the nav.
     */
    get autoHide(): boolean {
        return this.hasAttribute('auto-hide')
    }
    set autoHide(v: boolean) {
        this.toggleAttribute('auto-hide', v)
    }

    /** True while `auto-hide` has translated the dock off the bottom edge. */
    get hiddenByScroll(): boolean {
        return this.hasAttribute('data-hidden')
    }

    /** Bring the dock back into view — call it on navigation, so a new page starts with it. */
    reveal(): void {
        this._setHidden(false)
    }

    // ── Selection ────────────────────────────────────────────────────────────

    private _enabled(): TabDockItem[] {
        return this._tabs.filter((t) => !t.disabled)
    }

    // The tab that holds the single tab stop. Roving tabindex: everything else is
    // -1, so Tab enters and leaves the dock once instead of stepping through five.
    //
    // Falls back to the first enabled tab when `active-id` names a tab this dock
    // does not have — which is not an edge case here: the app shows fewer tabs to
    // some roles, so a remembered id can outlive the tab it named.
    private _tabbableId(): string {
        const activeId = this.activeId
        const active = this._tabs.find((t) => t.id === activeId)
        if (active && !active.disabled) return activeId
        return this._enabled()[0]?.id ?? activeId
    }

    /**
     * Notify, and report whether a consumer cancelled the tab's own navigation.
     * Re-tapping the active tab is a RESELECT, never a change.
     */
    private _select(id: string): boolean {
        const item = this._tabs.find((t) => t.id === id)
        if (!item || item.disabled) return true
        const detail: TabDockEventDetail = { id, href: item.href ?? null }
        const reselect = id === this.activeId

        if (!reselect && !item.href) {
            // A link's active state belongs to the URL, not to this element —
            // writing it here would leave the dock highlighting a route the app
            // never reached if the navigation was cancelled or failed.
            this.activeId = id
        }

        // Two spelled-out constructors rather than one with a computed type, because
        // scripts/gen-react-types.mjs finds an event by matching
        // `new CustomEvent<…>('tc-…')` against a LITERAL name — a ternary inside the
        // call generates neither `onTcTabDockChange` nor `onTcTabDockReselect` into
        // the React typings, silently.
        const init = { bubbles: true, composed: true, cancelable: true, detail }
        const event = reselect
            ? new CustomEvent<TabDockEventDetail>('tc-tab-dock-reselect', init)
            : new CustomEvent<TabDockEventDetail>('tc-tab-dock-change', init)
        this.dispatchEvent(event)
        const handler = reselect ? this.onReselect : this.onChange
        if (typeof handler === 'function') handler(id)
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
            el.classList.toggle('tc-tab-dock-tab--active', isActive)
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

        // Enter / Space activate THROUGH THE CLICK PATH, so `_onClick` stays the
        // single place that notifies. Both keys are cancelled here (suppressing the
        // native activation an <a> or a <button> would perform) and replaced by one
        // synthetic click. Notifying here as well fires both events twice per press
        // on a link tab — the defect tc-page-tabs shipped with and had to fix.
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
        // Down/Up alongside Right/Left, unconditionally: inside a
        // tc-mobile-shell[desktop] the dock renders as a VERTICAL rail (the
        // up(lg) block in style/components/_tab-dock.scss), where a tablist is
        // expected to answer the vertical pair. Answering both pairs in both
        // orientations costs nothing — neither key scrolls anything while focus
        // is on a tab — and spares the handler a layout-mirroring media check.
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % enabled.length
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
            next = (idx - 1 + enabled.length) % enabled.length
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = enabled.length - 1
        if (next === -1) return

        e.preventDefault()
        const item = enabled[next]
        this.querySelector<HTMLElement>(
            `:scope > [role="tab"][data-id="${CSS.escape(item.id)}"]`,
        )?.focus()
        // Links move focus only — see "link or switcher" at the top of this file.
        if (!item.href) this._select(item.id)
    }

    // ── Auto-hide ────────────────────────────────────────────────────────────

    private _syncShellScroll(): void {
        if (this.autoHide && this.isConnected) this._bindShellScroll()
        else this._unbindShellScroll()
    }

    // On `document`, not on the shell: `tc-shell-scroll` is dispatched ON the shell
    // and BUBBLES UP, so a listener on this element — a descendant — would never see
    // it. Going through document also keeps the dock uncoupled from
    // tc-mobile-shell by tag name: anything that emits `tc-shell-scroll` and
    // contains this dock drives it.
    private _bindShellScroll(): void {
        if (this._shellScrollBound || typeof document === 'undefined') return
        document.addEventListener('tc-shell-scroll', this._onShellScroll as EventListener)
        this._shellScrollBound = true
    }

    private _unbindShellScroll(): void {
        if (!this._shellScrollBound) return
        document.removeEventListener('tc-shell-scroll', this._onShellScroll as EventListener)
        this._shellScrollBound = false
        this._seeded = false
    }

    private _onShellScroll = (e: CustomEvent<ShellScrollDetail>): void => {
        const emitter = e.target
        // Only the scroller this dock actually lives in. A page with two shells (a
        // preview frame beside a live one) would otherwise cross-drive them.
        if (!(emitter instanceof Node) || !emitter.contains(this)) return
        const top = Number(e.detail?.top ?? 0)
        const delta = top - this._lastTop
        this._lastTop = top
        // The first event after binding only seeds the baseline. Without it, turning
        // `auto-hide` on halfway down a pane compares the current offset against 0
        // and reads as a several-hundred-pixel scroll DOWN, hiding the dock on a
        // gesture the user never made.
        if (!this._seeded) {
            this._seeded = true
            return
        }
        if (top <= REVEAL_AT) {
            this._setHidden(false)
            return
        }
        if (Math.abs(delta) < HIDE_DELTA) return
        this._setHidden(delta > 0)
    }

    // An ATTRIBUTE, not a class: react-dom rewrites the whole `className` string
    // whenever that prop's value changes, so a dock rendered with a computed
    // className would lose the state on the next re-render. Same call
    // tc-mobile-shell makes for `[data-scrolled]`.
    private _setHidden(hidden: boolean): void {
        if (hidden === this.hasAttribute('data-hidden')) return
        this.toggleAttribute('data-hidden', hidden)
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private _render(): void {
        const activeId = this.activeId
        const tabbableId = this._tabbableId()

        patchHtml(
            this,
            this._tabs
                .map((tab) => {
                    const isActive = tab.id === activeId
                    const badge = badgeText(tab.badge)
                    const cls = `tc-tab-dock-tab${isActive ? ' tc-tab-dock-tab--active' : ''}`
                    // The badge has to be part of the accessible NAME rather than a
                    // sibling text node: read on its own a screen reader announces
                    // „Рецепти 12", and 12 of what is anyone's guess. With a name the
                    // visible label is still a prefix of it, so WCAG 2.5.3 (Label in
                    // Name) holds and voice control still finds the tab by „Рецепти".
                    const spoken = badge ? `${tab.label}, ${tab.badgeLabel || badge}` : ''
                    const common =
                        ` role="tab" class="${cls}" data-id="${esc(tab.id)}"` +
                        ` aria-selected="${isActive}"` +
                        ` tabindex="${tab.id === tabbableId ? '0' : '-1'}"` +
                        (spoken ? ` aria-label="${esc(spoken)}"` : '')

                    const inner =
                        `<span class="tc-tab-dock-icon">` +
                        lucideByName(tab.icon, 'tc-tab-dock-glyph') +
                        // aria-hidden: the count is already in the item's name above.
                        (badge
                            ? `<span class="tc-tab-dock-badge" aria-hidden="true">${esc(badge)}</span>`
                            : '') +
                        `</span>` +
                        `<span class="tc-tab-dock-label">${esc(tab.label)}</span>`

                    if (tab.disabled) {
                        // <a> has no `disabled`, so a disabled tab is never a link — an
                        // inert <span> cannot be clicked or focused into.
                        return `<span${common} aria-disabled="true">${inner}</span>`
                    }
                    if (tab.href) {
                        return `<a href="${esc(tab.href)}"${common}>${inner}</a>`
                    }
                    return `<button type="button"${common}>${inner}</button>`
                })
                .join(''),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TabDock
    }
}

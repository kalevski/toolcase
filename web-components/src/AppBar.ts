import { lucideByName } from './internal/lucide'
import { msg } from './messages'

// tc-app-bar — the phone top bar, in the three shapes a mobile app actually uses.
//
//   variant="brand"   wordmark + trailing actions          (a home / dashboard root)
//   variant="title"   page title + muted subtitle, and a `below` rail under them
//   variant="back"    back chevron + title (+ second line) + trailing actions
//
// Not a variant of tc-navbar: that one is a desktop horizontal nav with a
// brand/links/actions model, it has no back affordance and no two-line title, and
// its themed background is a translucent blur a phone bar does not use.
//
// THREE TAB-LIKE ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-tab-bar    desktop panel switcher. WRAPS to a second line when it runs out
//                 of width, and sits on its own hairline.
//   tc-page-tabs  the phone page rail that lives in this bar's `below` region.
//                 NEVER wraps — it scrolls horizontally and keeps the active tab
//                 in view, because wrapping would move every pixel of the page
//                 below it.
//   tc-tab-dock   the fixed bottom dock — N equal columns of icon-over-label.
//
// WHY THIS ELEMENT RENDERS EXACTLY ONE CHILD OF ITS OWN
//   The library's older slot-distributing components (tc-brand, tc-rich-page-header,
//   tc-navbar, …) render a skeleton and then re-parent their slotted children into
//   it. That breaks under react-dom, which removes a child with
//   `parentInstance.removeChild(child)` against the parent it BELIEVES the child
//   has — so a re-parented `<div slot="actions">` throws NotFoundError the moment
//   React unmounts it, and conditional trailing actions are exactly the thing a
//   screen renders conditionally. (tc-mobile-shell hit the same wall; see the header
//   comment in src/MobileShell.ts.)
//   So this element owns ONE node — `.tc-app-bar__main`, the toolbar's leading
//   block, which it created and is free to re-render — and never touches a
//   consumer's children. The three slotted regions are the host's own children,
//   positioned by CSS off their `slot` attribute (`order` + a full-width flex
//   basis on `below`). Nothing moves, so nothing can go stale.
//
// SLOT NAMES ARE GLOBAL TO A LIGHT-DOM SUBTREE
//   `brand` and `actions` are also distributed by other components with a
//   SUBTREE-WIDE `querySelectorAll('[slot="…"]')`: tc-basic-layout, tc-cool-nav,
//   tc-dashboard-sidebar, tc-dashboard-layout and tc-page-footer hoist `brand`;
//   tc-rich-page-header hoists `actions`. Nesting a tc-app-bar inside one of those
//   lets it steal this bar's slotted children. Verified, documented in the SKILL
//   entry, and NOT worked around here — narrowing another component's lookup is a
//   behaviour change for its own consumers and belongs in its own change. This
//   element's own lookups are all `:scope > …`, so it can never do it to anything
//   nested inside it.

const TAG_NAME = 'tc-app-bar'

export type AppBarVariant = 'brand' | 'title' | 'back'
const VARIANTS: AppBarVariant[] = ['brand', 'title', 'back']

export class AppBar extends HTMLElement {
    private _main: HTMLElement | null = null
    private _shellScrollBound = false
    // Which shape `_main`'s contents were built for. Text changes patch that DOM in
    // place; only a change of shape rebuilds it. See _render.
    private _builtFor = ''

    /** Called when the back chevron is pressed. Alongside `tc-app-bar-back`. */
    onBack: (() => void) | null = null

    static get observedAttributes(): string[] {
        // `elevated` and `truncate` are pure CSS state and are observed only so that
        // scripts/gen-react-types.mjs types them as JSX props — it reads this list.
        return [
            'back-label',
            'elevate-on-scroll',
            'elevated',
            'heading',
            'heading-level',
            'subheading',
            'truncate',
            'variant',
        ]
    }

    connectedCallback(): void {
        this._render()
        // Re-attached on every connect: a React move/remount disconnects then
        // reconnects without re-running any one-time init. Re-adding the same
        // handler reference is a no-op, so repeating this is safe.
        this.addEventListener('click', this._onClick)
        this._syncShellScroll()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this._unbindShellScroll()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected) return
        if (prev === next) return
        if (name === 'elevated' || name === 'truncate') return // pure CSS state
        if (name === 'elevate-on-scroll') {
            this._syncShellScroll()
            return
        }
        this._render()
    }

    get variant(): AppBarVariant {
        const raw = this.getAttribute('variant') as AppBarVariant
        return VARIANTS.includes(raw) ? raw : 'title'
    }
    set variant(v: AppBarVariant) {
        this.setAttribute('variant', VARIANTS.includes(v) ? v : 'title')
    }

    get heading(): string | null {
        return this.getAttribute('heading')
    }
    set heading(v: string | null) {
        if (v != null) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    get subheading(): string | null {
        return this.getAttribute('subheading')
    }
    set subheading(v: string | null) {
        if (v != null) this.setAttribute('subheading', v)
        else this.removeAttribute('subheading')
    }

    /**
     * `1`–`6` render the heading as that `<hN>`; `0` (the default) keeps a `<div>`.
     * The bar does NOT assume a level: on most of the design's screens the page's
     * real heading is in the content pane, and a second h1 in the chrome would
     * compete with it. A screen whose only heading IS the bar's title opts in.
     */
    get headingLevel(): number {
        const raw = Number(this.getAttribute('heading-level'))
        return Number.isInteger(raw) && raw >= 1 && raw <= 6 ? raw : 0
    }
    set headingLevel(v: number | null) {
        if (v != null && v >= 1 && v <= 6) this.setAttribute('heading-level', String(v))
        else this.removeAttribute('heading-level')
    }

    /** Accessible name for the back chevron. Falls back to the `back` message. */
    get backLabel(): string {
        return this.getAttribute('back-label') || msg('back')
    }
    set backLabel(v: string | null) {
        if (v != null) this.setAttribute('back-label', v)
        else this.removeAttribute('back-label')
    }

    get elevated(): boolean {
        return this.hasAttribute('elevated')
    }
    set elevated(v: boolean) {
        this.toggleAttribute('elevated', v)
    }

    get elevateOnScroll(): boolean {
        return this.hasAttribute('elevate-on-scroll')
    }
    set elevateOnScroll(v: boolean) {
        this.toggleAttribute('elevate-on-scroll', v)
    }

    /** Single-line ellipsis on the heading. Always on in the `back` variant. */
    get truncate(): boolean {
        return this.hasAttribute('truncate')
    }
    set truncate(v: boolean) {
        this.toggleAttribute('truncate', v)
    }

    /** The back `<button>`, or `null` outside the `back` variant. */
    get backButton(): HTMLButtonElement | null {
        return this.querySelector<HTMLButtonElement>('.tc-app-bar__back')
    }

    // ── Scroll elevation ─────────────────────────────────────────────────────

    // Opt-in, because it is wrong by default: on four of the design's screens the
    // bar is NOT the last thing above the pane (a search band or a day strip sits
    // between them), and a separator on the bar would then draw a hairline where
    // the canvas has none. A screen whose bar IS the last header child opts in
    // with one attribute instead of wiring an event handler.
    //
    // Listening on `document` rather than on the shell: `tc-shell-scroll` is
    // dispatched ON the shell and BUBBLES, so a listener on this element — a
    // descendant — would never see it. Going through document also means the bar
    // is not coupled to `tc-mobile-shell` by tag name: anything that emits
    // `tc-shell-scroll` and contains this bar drives it.
    private _syncShellScroll(): void {
        if (this.elevateOnScroll) this._bindShellScroll()
        else this._unbindShellScroll()
    }

    private _bindShellScroll(): void {
        if (this._shellScrollBound || typeof document === 'undefined') return
        document.addEventListener('tc-shell-scroll', this._onShellScroll as EventListener)
        this._shellScrollBound = true
    }

    private _unbindShellScroll(): void {
        if (!this._shellScrollBound) return
        document.removeEventListener('tc-shell-scroll', this._onShellScroll as EventListener)
        this._shellScrollBound = false
    }

    private _onShellScroll = (e: CustomEvent<{ scrolled?: boolean }>): void => {
        const target = e.target
        // Only the shell this bar actually lives in. A page with two shells (a
        // preview frame beside a live one) would otherwise cross-drive them.
        if (!(target instanceof Node) || !target.contains(this)) return
        this.elevated = !!e.detail?.scrolled
    }

    // ── Back ─────────────────────────────────────────────────────────────────

    private _onClick = (e: Event): void => {
        const target = e.target as Element | null
        if (!target?.closest) return
        // `:scope` is not valid in closest(); scope by containment instead, so a
        // nested tc-app-bar's own chevron cannot trigger this one.
        const back = target.closest<HTMLElement>('.tc-app-bar__back')
        if (!back || back.closest(TAG_NAME) !== this) return
        this.dispatchEvent(new CustomEvent('tc-app-bar-back', { bubbles: true, composed: true }))
        if (typeof this.onBack === 'function') this.onBack()
    }

    // ── Render ───────────────────────────────────────────────────────────────

    // TEXT IS PATCHED, STRUCTURE IS REBUILT — and only when the structure changed.
    // Rewriting innerHTML on every attribute change destroyed the back <button> on
    // every `heading`/`subheading` write: keyboard focus fell to <body>, the public
    // `backButton` getter went stale, and a listener bound straight to the button was
    // dropped. That is not hypothetical for this design — screen 1h's second line is
    // a live „N од 7 купено" counter, so it happened on every tick-off.
    private _render(): void {
        const main = this._ensureMain()
        // `firstChild` covers the other way the DOM can go missing: a React
        // move/remount hands back a brand-new (empty) __main from _ensureMain.
        const shape = `${this.variant}/${this.headingLevel}`
        if (shape !== this._builtFor || !main.firstChild) {
            main.innerHTML = this._shape(this.variant, this.headingLevel)
            this._builtFor = shape
        }
        this._patchText(main)
    }

    // No text interpolation anywhere in here: every string goes in through
    // `textContent`/`setAttribute` below, which escapes for free.
    private _shape(variant: AppBarVariant, level: number): string {
        if (variant === 'brand') {
            // The wordmark is three inline pieces, not a tc-brand: that element's
            // underline is a full-width bar UNDER the whole mark (`display:block;
            // width:100%`), themed to the sunshine display face, and neither its
            // layout nor its size is reachable through --bs-brand-*. This mark is a
            // 1.25em dash BESIDE the suffix, baseline-aligned. It also re-parents
            // slotted children on every attribute change, which is the react-dom
            // hazard described at the top of this file. Slot tc-brand into `brand`
            // if you want it; this is what the phone design draws.
            return (
                `<span class="tc-app-bar__brand">` +
                `<span class="tc-app-bar__brand-primary"></span>` +
                `<span class="tc-app-bar__brand-secondary"></span>` +
                `<span class="tc-app-bar__brand-dash"></span>` +
                `</span>`
            )
        }

        const tag = level ? `h${level}` : 'div'
        const titles =
            `<div class="tc-app-bar__titles">` +
            `<${tag} class="tc-app-bar__heading"></${tag}>` +
            `<div class="tc-app-bar__subheading"></div>` +
            `</div>`

        if (variant !== 'back') return titles

        // A real <button>, named by _patchText's aria-label. Its hit box is 44px wide
        // (.tc-touch-target) and as tall as the bar (padding, cancelled by a negative
        // margin — see _app-bar.scss); the glyph itself stays 22px either way.
        return (
            `<button type="button" class="tc-app-bar__back tc-touch-target tc-no-tap-highlight">` +
            lucideByName('chevron-left', 'tc-app-bar__back-icon') +
            `</button>` +
            titles
        )
    }

    private _patchText(main: HTMLElement): void {
        const heading = this.getAttribute('heading') ?? ''
        const subheading = this.getAttribute('subheading') ?? ''
        const write = (selector: string, text: string): void => {
            const el = main.querySelector(selector)
            // Compared before writing so an unchanged string never touches the DOM —
            // `textContent =` replaces the text node, which is enough to break a
            // selection or an in-progress screen-reader read.
            if (el && el.textContent !== text) el.textContent = text
        }

        if (this.variant === 'brand') {
            write('.tc-app-bar__brand-primary', heading)
            write('.tc-app-bar__brand-secondary', subheading)
            return
        }
        write('.tc-app-bar__heading', heading)
        write('.tc-app-bar__subheading', subheading)
        main.querySelector('.tc-app-bar__back')?.setAttribute('aria-label', this.backLabel)
    }

    // Created once and reused, so re-rendering the toolbar's leading block never
    // touches a consumer's children. Inserted FIRST so the back chevron precedes
    // the trailing actions in tab order — the regions' visual order is CSS's job,
    // but sequential focus order is the DOM's.
    private _ensureMain(): HTMLElement {
        let main = this._main
        if (main?.parentNode === this) return main
        main = this.querySelector<HTMLElement>(':scope > .tc-app-bar__main')
        if (!main) {
            main = document.createElement('div')
            main.className = 'tc-app-bar__main'
            this.insertBefore(main, this.firstChild)
        }
        this._main = main
        return main
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AppBar
    }
}

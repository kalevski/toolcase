// tc-action-bar — the sticky bottom action bar: a DETAIL screen's primary action,
// parked in the thumb zone.
//
// THE TWO WAYS A PHONE EXPOSES A PRIMARY ACTION, and they are alternatives
//   tc-fab         a LIST screen's primary action, floating over the content (1c)
//   tc-action-bar  a DETAIL screen's, in a bar across the bottom (1d/1h/1j/1k)
// Never both on one screen — see the header comment in src/Fab.ts.
//
// A CONTAINER, NOT A VARIANT ZOO
//   The design draws five arrangements. All five come out of ONE flex container
//   plus per-child sizing, so there is no `variant` attribute here:
//
//     1d  primary „Готви"  +  two 52px icon buttons      row, 1 fluid + 2 compact
//     1h  one 52px icon button  +  primary „Заврши…"     row, 1 compact + 1 fluid
//     1j  „Преглед на неделата" | „Предложи диета"       row, 2 fluid (equal)
//     1k  „Прати порака" | „Побарај соработка"           row, 2 fluid (equal)
//     1l  „Контактирајте нѐ" over „Не сега"              column — the `stack` case
//
//   Children are `flex: 1 1 0` by default and a child marked
//   `.tc-action-bar-compact` is `flex: none` at the design's 52px icon-button
//   width. `1 1 0` and not `flex-grow: 1`: a zero basis is what makes 1j's and 1k's
//   two buttons EQUAL rather than proportional to their Cyrillic label lengths,
//   and it is what the design's own inline `flex:1` (= `1 1 0%`) resolves to.
//
// IT IMPOSES NO BUTTON STYLING. Height, fill, radius and type are the child's —
// the design's own heights differ per screen (46px on 1d/1h/1k, 44px on 1j, 48px
// on 1l) and belong to tc-button, not to the bar. The bar owns four things the
// children cannot see: the surface, the safe-area padding, the elevation, and the
// software-keyboard inset.
//
// WHY IT RENDERS NOTHING
//   Its children are the consumer's buttons, and a bar's actions are the most
//   conditionally-rendered thing on a screen (`{dirty && <tc-button/>}`). An
//   element that re-parented them would throw NotFoundError under react-dom, which
//   removes a child with `parentInstance.removeChild(child)` against the parent it
//   BELIEVES the child has. So this element renders no markup at all and exists in
//   TypeScript only for its `elevate-on-scroll` wiring and its typed attributes;
//   everything else is the partial. Same call tc-mobile-shell makes.

const TAG_NAME = 'tc-action-bar'

export class ActionBar extends HTMLElement {
    private _shellScrollBound = false

    static get observedAttributes(): string[] {
        // `stack`, `elevated` and `flat` are pure CSS state and are observed only so
        // that scripts/gen-react-types.mjs types them as JSX props — it reads this list.
        return ['elevate-on-scroll', 'elevated', 'flat', 'stack']
    }

    connectedCallback(): void {
        this._syncShellScroll()
    }

    disconnectedCallback(): void {
        this._unbindShellScroll()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        if (name === 'elevate-on-scroll') this._syncShellScroll()
    }

    /** Vertical arrangement — the `1l` case: a primary action over its escape hatch. */
    get stack(): boolean {
        return this.hasAttribute('stack')
    }
    set stack(v: boolean) {
        this.toggleAttribute('stack', v)
    }

    /**
     * Draw the lift-off shadow.
     *
     * Unset is NOT "off": with neither `elevated` nor `flat` the bar declares no
     * `box-shadow` at all, which lets tc-mobile-shell's own context-aware default
     * through — a shadow when the bar is the bottom-most chrome (1d), none when a
     * dock sits below it (1h, 1j). That default is the design, so most consumers
     * touch neither attribute.
     */
    get elevated(): boolean {
        return this.hasAttribute('elevated')
    }
    set elevated(v: boolean) {
        this.toggleAttribute('elevated', v)
    }

    /** Force the shadow off — the `1k` shape, bottom-most chrome that draws none. */
    get flat(): boolean {
        return this.hasAttribute('flat')
    }
    set flat(v: boolean) {
        this.toggleAttribute('flat', v)
    }

    /**
     * Bind `elevated` to the shell's scroll state, so the shadow appears only once
     * content has actually moved under the bar.
     *
     * Opt-in, because it is wrong by default in one direction: a pane too short to
     * scroll never fires the event, and the design's 1d bar carries its shadow at
     * rest. A screen whose pane definitely scrolls opts in and gets the honest
     * version — with nothing under the bar there is nothing for it to lift off.
     */
    get elevateOnScroll(): boolean {
        return this.hasAttribute('elevate-on-scroll')
    }
    set elevateOnScroll(v: boolean) {
        this.toggleAttribute('elevate-on-scroll', v)
    }

    // ── Scroll elevation ─────────────────────────────────────────────────────

    private _syncShellScroll(): void {
        if (this.elevateOnScroll && this.isConnected) this._bindShellScroll()
        else this._unbindShellScroll()
    }

    // On `document`, not on the shell: `tc-shell-scroll` is dispatched ON the shell
    // and BUBBLES UP, so a listener on this element — a descendant — would never
    // see it. Going through document also keeps the bar uncoupled from
    // tc-mobile-shell by tag name: anything that emits `tc-shell-scroll` and
    // contains this bar drives it. Identical to tc-app-bar's wiring, on purpose:
    // the two bars are the same affordance at opposite edges.
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
        const emitter = e.target
        // Only the scroller this bar actually lives in. A page with two shells (a
        // preview frame beside a live one) would otherwise cross-drive them.
        if (!(emitter instanceof Node) || !emitter.contains(this)) return
        this.elevated = !!e.detail?.scrolled
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ActionBar
    }
}

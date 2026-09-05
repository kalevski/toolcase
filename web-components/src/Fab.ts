import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'

// tc-fab — the floating action button: one primary action parked in the thumb
// zone, over a scrolling list.
//
// THE TWO WAYS A PHONE EXPOSES A PRIMARY ACTION, and they are alternatives
//   tc-fab         a LIST screen's primary action, floating over the content
//                  (screen 1c: „нов рецепт" over the cookbook list)
//   tc-action-bar  a DETAIL screen's primary action, in a sticky bottom bar
//                  (screens 1d/1h/1j/1k: „Готви", „Заврши", „Побарај соработка")
//
// NEVER BOTH ON ONE SCREEN. Two primary actions in the same corner of the same
// screen is an ambiguity, and both are amber — the design allows amber on at most
// two elements per screen, so a FAB plus an amber action-bar button spends that
// budget on saying one thing twice. There is no sensible way to enforce this in
// code (neither element can see the other's screen), so it is a convention, stated
// here and in the SKILL entry.
//
// IT IS A SQUIRCLE, NOT A CIRCLE. 56x56 at `border-radius: 16px`, verbatim from
// screen 1c. Small corners are a stated principle of this design system (6px on
// controls, 10px on cards, pills for chips only), and a 999px FAB is the one
// element that would break it while looking, in isolation, like the more
// conventional choice. Do not "fix" it.
//
// WHY IT RENDERS ITS OWN CHILD AND NEVER RE-PARENTS A SLOTTED ONE
//   The icon and label come from attributes, so there is nothing of the consumer's
//   to move. The library's older slot-distributing components re-parent slotted
//   children into a rendered skeleton, which breaks under react-dom — it removes a
//   child with `parentInstance.removeChild(child)` against the parent it BELIEVES
//   the child has. See the header comments in src/MobileShell.ts and src/AppBar.ts.
//
// WHERE IT GOES
//   `tc-mobile-shell`'s `overlay` slot. That layer is `position:absolute; inset:0`
//   against the shell's PADDING box, so it spans the whole phone frame including
//   the hardware inset strips, and it is already transparent to taps with each
//   child opting back in. Consequence the offset maths depends on: the layer does
//   NOT benefit from the shell's own `padding-bottom`, so the FAB pays
//   `--tc-safe-bottom` itself — exactly as tc-bottom-sheet does in the same layer.

const TAG_NAME = 'tc-fab'

export type FabVariant = 'icon' | 'extended'
const VARIANTS: FabVariant[] = ['icon', 'extended']

export type FabPosition = 'bottom-right' | 'bottom-left' | 'bottom-center' | 'static'
const POSITIONS: FabPosition[] = ['bottom-right', 'bottom-left', 'bottom-center', 'static']

// Auto-hide thresholds, the same pair tc-tab-dock uses and for the same reason —
// both exist to stop the control flapping:
//   * within REVEAL_AT of the top the FAB is always shown, so a short pane that
//     rubber-bands cannot strand the primary action off-screen;
//   * a scroll step smaller than HIDE_DELTA is ignored, because momentum
//     scrolling reports sub-pixel reversals on the way to a stop.
const REVEAL_AT = 24
const HIDE_DELTA = 8

interface ShellScrollDetail {
    scrolled?: boolean
    top?: number
}

export class Fab extends HTMLElement {
    private _shellScrollBound = false
    private _lastTop = 0
    private _seeded = false
    // Which shape the button's contents were built for. A label change patches
    // that DOM in place; only a change of variant or icon rebuilds it. See _render.
    private _builtFor = ''

    static get observedAttributes(): string[] {
        return ['auto-hide', 'icon', 'label', 'offset', 'position', 'variant']
    }

    connectedCallback(): void {
        this._render()
        this._applyOffset()
        this._syncShellScroll()
    }

    disconnectedCallback(): void {
        this._unbindShellScroll()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        if (name === 'position') return // pure CSS state, observed only so the React typings carry it
        if (name === 'offset') {
            this._applyOffset()
            return
        }
        if (name === 'auto-hide') {
            this._syncShellScroll()
            // Turning it off must not leave the FAB retracted.
            if (!this.autoHide) this.reveal()
            return
        }
        this._render()
    }

    /** A lucide icon name (kebab or Pascal). Drawn at 26px, stroke 2.2. */
    get icon(): string {
        return this.getAttribute('icon') ?? ''
    }
    set icon(v: string) {
        if (v) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    /**
     * The action's name — „Нов рецепт". REQUIRED: in the `icon` variant it is the
     * button's whole accessible name, and an icon-only control with no name is an
     * a11y failure, not a cosmetic omission. In the `extended` variant it is
     * rendered as visible text instead, which names the button for free.
     */
    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        if (v) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get variant(): FabVariant {
        const raw = this.getAttribute('variant') as FabVariant
        return VARIANTS.includes(raw) ? raw : 'icon'
    }
    set variant(v: FabVariant) {
        this.setAttribute('variant', VARIANTS.includes(v) ? v : 'icon')
    }

    get position(): FabPosition {
        const raw = this.getAttribute('position') as FabPosition
        return POSITIONS.includes(raw) ? raw : 'bottom-right'
    }
    set position(v: FabPosition) {
        this.setAttribute('position', POSITIONS.includes(v) ? v : 'bottom-right')
    }

    /**
     * Distance from the frame's bottom edge, BEFORE the safe-area inset is added.
     * Defaults to the design's `104px` (78px of dock reserve + 26px of clearance);
     * a screen with no dock under it sets `24px`.
     */
    get offset(): string | null {
        return this.getAttribute('offset')
    }
    set offset(v: string | null) {
        if (v != null) this.setAttribute('offset', v)
        else this.removeAttribute('offset')
    }

    /**
     * Retract on scroll-down, come back on scroll-up, driven by `tc-shell-scroll`.
     *
     * OFF BY DEFAULT, deliberately — the same call tc-tab-dock makes. The design
     * never draws the FAB hidden, and a primary action that vanishes while you read
     * costs more than the 56px of list it uncovers. It exists for a long feed where
     * the content is the point.
     *
     * Ignored under `prefers-reduced-motion: reduce`: the movement IS the feature,
     * so the honest response to "no movement" is to keep the button, not to snap it
     * in and out of existence.
     */
    get autoHide(): boolean {
        return this.hasAttribute('auto-hide')
    }
    set autoHide(v: boolean) {
        this.toggleAttribute('auto-hide', v)
    }

    /** True while `auto-hide` has the FAB retracted. */
    get hiddenByScroll(): boolean {
        return this.hasAttribute('data-hidden')
    }

    /** The `<button>`. Listen for `click` on it or on the host — it bubbles. */
    get button(): HTMLButtonElement | null {
        return this.querySelector<HTMLButtonElement>(':scope > .tc-fab-button')
    }

    /** Bring a retracted FAB back. Call it on navigation, so a new page starts with it. */
    reveal(): void {
        this._setHidden(false)
    }

    // ── Offset ───────────────────────────────────────────────────────────────

    // setProperty PARSES the value, so a malformed or injected one is dropped
    // rather than reaching the stylesheet — the same guard tc-mobile-shell's
    // `pane-bg` uses. The default lives in the partial, not here, so an app can
    // re-point it for every FAB at once.
    private _applyOffset(): void {
        const v = this.getAttribute('offset')
        if (v) this.style.setProperty('--bs-fab-offset', v)
        else this.style.removeProperty('--bs-fab-offset')
    }

    // ── Auto-hide ────────────────────────────────────────────────────────────

    private _syncShellScroll(): void {
        if (this.autoHide && this.isConnected) this._bindShellScroll()
        else this._unbindShellScroll()
    }

    // On `document`, not on the shell: `tc-shell-scroll` is dispatched ON the shell
    // and BUBBLES UP, so a listener on this element — a descendant — would never
    // see it. Going through document also keeps the FAB uncoupled from
    // tc-mobile-shell by tag name: anything that emits `tc-shell-scroll` and
    // contains this FAB drives it.
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
        // Only the scroller this FAB actually lives in. A page with two shells (a
        // preview frame beside a live one) would otherwise cross-drive them.
        if (!(emitter instanceof Node) || !emitter.contains(this)) return
        const top = Number(e.detail?.top ?? 0)
        const delta = top - this._lastTop
        this._lastTop = top
        // The first event after binding only seeds the baseline. Without it, turning
        // `auto-hide` on halfway down a pane compares the current offset against 0
        // and reads as a several-hundred-pixel scroll DOWN, retracting the FAB on a
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
    // whenever that prop's value changes, so a FAB rendered with a computed
    // className would lose the state on the next re-render. Same call
    // tc-mobile-shell makes for `[data-scrolled]` and tc-tab-dock for `[data-hidden]`.
    private _setHidden(hidden: boolean): void {
        // Gated HERE rather than in CSS so `hiddenByScroll` never claims a state the
        // FAB is not in. A `@media (prefers-reduced-motion)` block restoring the
        // visible styles would leave the attribute set and the getter lying.
        if (hidden && this._reduceMotion()) return
        if (hidden === this.hasAttribute('data-hidden')) return
        this.toggleAttribute('data-hidden', hidden)
    }

    private _reduceMotion(): boolean {
        return (
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
    }

    // ── Render ───────────────────────────────────────────────────────────────

    // TEXT IS PATCHED, STRUCTURE IS REBUILT — and only when the structure changed,
    // the same rule tc-app-bar follows. Rewriting the button on every `label` write
    // would destroy the focused element mid-press: a FAB whose label tracks state
    // („Зачувај" → „Зачувано") would drop keyboard focus to <body> on every change,
    // and the public `button` getter would go stale with it.
    private _render(): void {
        const shape = `${this.variant}/${this.icon}`
        const button = this.button
        // `!button` covers the other way the DOM can go missing: a React
        // move/remount hands back a host whose children were replaced wholesale.
        if (!button || shape !== this._builtFor) {
            patchHtml(this, this._shape())
            this._builtFor = shape
        }
        this._patchText()
    }

    private _shape(): string {
        const glyph = lucideByName(this.icon, 'tc-fab-glyph')
        // The label span exists only in the `extended` variant. In the `icon`
        // variant the name is an aria-label instead — a visually-hidden span would
        // widen nothing but would be read twice by some screen-reader/browser pairs.
        const body =
            this.variant === 'extended' ? `${glyph}<span class="tc-fab-label"></span>` : glyph
        return (
            `<button type="button" class="tc-fab-button tc-no-tap-highlight">` + body + `</button>`
        )
    }

    private _patchText(): void {
        const button = this.button
        if (!button) return
        const label = this.label
        const text = button.querySelector('.tc-fab-label')
        if (text) {
            // Compared before writing so an unchanged string never touches the DOM —
            // `textContent =` replaces the text node, which is enough to break a
            // selection or an in-progress screen-reader read.
            if (text.textContent !== label) text.textContent = label
            // The visible text IS the accessible name here, so no aria-label: with
            // one, voice control ("tap Нов рецепт") matches the override rather than
            // what the user can read, and WCAG 2.5.3 Label in Name is at risk.
            button.removeAttribute('aria-label')
            return
        }
        if (label) button.setAttribute('aria-label', label)
        else button.removeAttribute('aria-label')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Fab
    }
}

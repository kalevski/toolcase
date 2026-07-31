// tc-swipe-pager — discrete horizontal paging: one page fills the box, movement is
// committed, and the current index is application state.
//
// NOT tc-carousel. That element is a marketing carousel — auto-play, dot
// indicators, a peek at its neighbours, and no notion of an index a router or a
// store owns. This one is the phone gesture: swipe to the next day, the next step,
// the next week. Three consumers in the JADI.mk design (cooking mode `1e`, the
// planner's day pager `1j`, the diet week overview), which is what earned it a
// place in the library rather than a copy per screen.
//
// CSS SCROLL-SNAP, NOT A JS TRANSFORM PAGER
//   The host is the scroll container, each page is `flex: 0 0 100%` with
//   `scroll-snap-align: start`, and the browser owns the animation. That buys three
//   things a transform pager has to reimplement badly: native momentum, correct
//   rubber-banding at the two ends, and — the reason it matters — no jank, because
//   nothing is being animated from JS on the main thread. The element only READS
//   the scroll position back.
//   Reach for a transform pager only if a requirement appears that snap cannot
//   serve (an infinite or virtualised pager). Nothing here needs one.
//
// WHY THE SETTLED INDEX IS DEBOUNCED AND NOT READ FROM `scroll`
//   `tc-pager-change` must fire once per page, on a SETTLED position — a consumer
//   that fetches a day's plan on it would otherwise fire a request per frame of
//   the flick. `scrollend` is the correct signal but Safari only shipped it in 18,
//   so a 120ms debounce on `scroll` runs alongside it. Both call the same
//   `_settle`, which is idempotent: it emits only when the index actually changed,
//   so the two never double-fire.
//
// WHY IT DOES NOT SET `touch-action: pan-y`
//   The obvious-looking fix for "a mostly-vertical drag should scroll the page
//   instead of paging" is `touch-action: pan-y` on the pager. It is the opposite of
//   a fix: `pan-y` allows only VERTICAL panning, which disables the horizontal
//   swipe this element exists for. And touch-action is intersected down the
//   ancestor chain, so it would also kill a horizontal rail nested inside a page.
//   Axis arbitration is already native: a horizontal scroller inside a vertical one
//   locks the axis on gesture start. The default is correct — see
//   style/components/_swipe-pager.scss.
//
// WHY IT NEVER RE-PARENTS THE PAGES
//   The pages are the consumer's own direct children and stay exactly where they
//   were put; CSS lays them out. The library's older slot-distributing components
//   re-parent slotted children into a rendered skeleton, which breaks under
//   react-dom — it removes a child with `parentInstance.removeChild(child)` against
//   the parent it BELIEVES the child has. A pager's pages are conditionally
//   rendered (`{days.map(…)}`) as a matter of course, so that would fail on every
//   list change. See the header comments in src/MobileShell.ts and src/AppBar.ts.

const TAG_NAME = 'tc-swipe-pager'

// How long after the last `scroll` event the position counts as settled. 120ms is
// long enough to outlast the gap between two momentum frames on iOS and short
// enough that the change does not feel deferred. Only a fallback for engines
// without `scrollend` (Safari < 18) — where it exists, that fires first.
const SETTLE_MS = 120

// A page is any direct child that is not document metadata. `<template>`,
// `<style>`, `<script>` and `<link>` are legitimate unslotted children that are
// never a page (they are `display: none`, so the CSS side needs no equivalent
// exclusion — but querySelectorAll would happily count one).
const PAGE_SELECTOR = ':scope > :not(template):not(style):not(script):not(link)'

/** `swipe` pages on a horizontal drag; `none` leaves only programmatic paging. */
export type SwipePagerGesture = 'swipe' | 'none'

export interface SwipePagerChangeDetail {
    index: number
    count: number
}

export class SwipePager extends HTMLElement {
    private _index = 0
    private _settleTimer = 0
    private _reflecting = false
    private _lastWidth = -1
    private _children: MutationObserver | null = null
    private _resize: ResizeObserver | null = null

    /** Called on a SETTLED index change. Alongside the `tc-pager-change` event. */
    onIndexChange: ((index: number) => void) | null = null

    static get observedAttributes(): string[] {
        // `gesture` is pure CSS state and is observed only so that
        // scripts/gen-react-types.mjs types it as a JSX prop — it reads this list.
        return ['gesture', 'index', 'lazy', 'loop']
    }

    connectedCallback(): void {
        // Left alone when the consumer has spoken. `role="group"` and NOT
        // `aria-roledescription="carousel"`: a carousel is a rotating set of
        // equivalent promos, this is a sequence whose position is meaningful, and
        // the roledescription would have a screen reader announce it as the wrong
        // widget. Pair it with your own `aria-live` announcer („Чекор 2 од 4") —
        // this element cannot know how to phrase yours. tc-step-pager does supply
        // one, because there the phrasing is the component's.
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        // A tab stop, so a keyboard can reach the pager at all. Roving-tabindex
        // style single stop: the pages' own content keeps its natural order.
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0')

        this._index = this._clamp(Number(this.getAttribute('index') ?? 0))
        this._applyLazy()

        // Re-attached on every connect: a React move/remount disconnects then
        // reconnects without re-running any one-time init. Re-adding the same
        // handler reference is a no-op, so repeating this is safe.
        this.addEventListener('scroll', this._onScroll, { passive: true })
        // Both, unconditionally. `scrollend` is the honest signal and fires first
        // where it exists; the debounce above is the Safari < 18 fallback. Running
        // both cannot double-fire, because _settle emits only on a real change.
        this.addEventListener('scrollend', this._settleNow)
        this.addEventListener('keydown', this._onKeydown)
        this._observeChildren()
        this._observeSize()
        // Layout may not exist yet (a pager inside a display:none tab, or before
        // first paint). The ResizeObserver above fires as soon as it does, and
        // re-anchors from there — so this is best-effort, not the only attempt.
        this._scrollToIndex(this._index, false)
    }

    disconnectedCallback(): void {
        this.removeEventListener('scroll', this._onScroll)
        this.removeEventListener('scrollend', this._settleNow)
        this.removeEventListener('keydown', this._onKeydown)
        this._cancelSettle()
        this._children?.disconnect()
        this._children = null
        this._resize?.disconnect()
        this._resize = null
        this._lastWidth = -1
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (prev === next) return
        if (name === 'gesture') return // pure CSS state
        if (name === 'loop') return // read on demand by next() / prev()
        if (name === 'lazy') {
            this._applyLazy()
            return
        }
        // `index` written from OUTSIDE — a controlled consumer driving the pager.
        if (this._reflecting) return
        const index = this._clamp(Number(next))
        if (index === this._index) return
        this._index = index
        this._applyLazy()
        this._scrollToIndex(index, true)
        // Deliberately NOT notified. The consumer wrote this index, so it already
        // knows; echoing it back is how a controlled component ends up in a loop.
        // Every other path (gesture, next/prev, goTo) does notify.
    }

    /**
     * The current page. Reflected, and safe to drive from a framework.
     *
     * Assigning it ANIMATES, exactly as writing the `index` attribute does — call
     * `goTo(i, false)` to jump instead, e.g. when restoring a remembered position.
     */
    get index(): number {
        return this._index
    }
    set index(v: number) {
        this.goTo(v)
    }

    /** How many pages there are. Read-only — it is the child count. */
    get count(): number {
        return this.pages.length
    }

    /** The page elements, in DOM order. */
    get pages(): HTMLElement[] {
        return Array.from(this.querySelectorAll<HTMLElement>(PAGE_SELECTOR))
    }

    /**
     * Wrap at the ends — but only for `next()` / `prev()`.
     *
     * A native snap scroller cannot rubber-band past its last page into its first,
     * so a SWIPE never wraps however this is set. Making it appear to would mean
     * re-implementing the scroller in JS, which is the thing this element exists
     * not to do.
     */
    get loop(): boolean {
        return this.hasAttribute('loop')
    }
    set loop(v: boolean) {
        this.toggleAttribute('loop', v)
    }

    /**
     * Skip rendering every page except `index - 1 … index + 1`.
     *
     * The far pages keep their boxes (so the scroll geometry and every snap point
     * are unchanged) and lose their CONTENTS, via `content-visibility: hidden` on a
     * `data-pager-far` attribute this element writes. The nodes are never removed:
     * they are the consumer's, and removing them is what breaks react-dom.
     * Off-screen pages also drop out of the tab order and out of find-in-page while
     * they are skipped, which is the trade.
     */
    get lazy(): boolean {
        return this.hasAttribute('lazy')
    }
    set lazy(v: boolean) {
        this.toggleAttribute('lazy', v)
    }

    get gesture(): SwipePagerGesture {
        return this.getAttribute('gesture') === 'none' ? 'none' : 'swipe'
    }
    set gesture(v: SwipePagerGesture) {
        this.setAttribute('gesture', v === 'none' ? 'none' : 'swipe')
    }

    // ── Paging ───────────────────────────────────────────────────────────────

    next(): void {
        const last = this.count - 1
        if (this._index >= last) {
            // A wrap is INSTANT even when motion is allowed. Smooth-scrolling from
            // the last page to the first animates THROUGH every page between them,
            // which reads as a fast-forward rather than a wrap.
            if (this.loop && last > 0) this.goTo(0, false)
            return
        }
        this.goTo(this._index + 1)
    }

    prev(): void {
        if (this._index <= 0) {
            const last = this.count - 1
            if (this.loop && last > 0) this.goTo(last, false)
            return
        }
        this.goTo(this._index - 1)
    }

    /** Page to `index`. `animate` is ignored under `prefers-reduced-motion: reduce`. */
    goTo(index: number, animate = true): void {
        const next = this._clamp(index)
        const changed = next !== this._index
        this._index = next
        this._applyLazy()
        if (changed) this._reflect()
        this._scrollToIndex(next, animate)
        if (changed) this._notify()
    }

    // ── Settling ─────────────────────────────────────────────────────────────

    private _onScroll = (): void => {
        // A scroll event is one frame of a gesture, never a decision. All this does
        // is push the settle deadline out.
        if (this._settleTimer) clearTimeout(this._settleTimer)
        this._settleTimer = window.setTimeout(this._settle, SETTLE_MS)
    }

    private _settleNow = (): void => {
        this._cancelSettle()
        this._settle()
    }

    private _settle = (): void => {
        this._settleTimer = 0
        const index = this._indexFromScroll()
        if (index === this._index) return
        this._index = index
        this._applyLazy()
        this._reflect()
        this._notify()
    }

    private _cancelSettle(): void {
        if (!this._settleTimer) return
        clearTimeout(this._settleTimer)
        this._settleTimer = 0
    }

    // Nearest page by LEFT EDGE rather than `Math.round(scrollLeft / clientWidth)`.
    // The division is exact only while every page is precisely one viewport wide
    // with no gap between them; the rect walk also survives a consumer's `gap`, a
    // fractional device-pixel width, and a page whose basis was overridden.
    private _indexFromScroll(): number {
        const pages = this.pages
        if (pages.length === 0) return 0
        const origin = this.getBoundingClientRect().left
        let best = 0
        let bestDistance = Infinity
        for (let i = 0; i < pages.length; i++) {
            const distance = Math.abs(pages[i].getBoundingClientRect().left - origin)
            if (distance < bestDistance) {
                bestDistance = distance
                best = i
            }
        }
        return best
    }

    private _scrollToIndex(index: number, animate: boolean): void {
        const page = this.pages[index]
        if (!page) return
        const max = this.scrollWidth - this.clientWidth
        if (max <= 0) return // nothing to scroll yet — no layout, or a single page
        // Rect-based rather than offsetLeft, which is measured from offsetParent —
        // and this host is not required to be one.
        const left = Math.max(
            0,
            Math.min(
                max,
                page.getBoundingClientRect().left -
                    this.getBoundingClientRect().left +
                    this.scrollLeft,
            ),
        )
        if (Math.abs(left - this.scrollLeft) < 1) return
        const reduce =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        // `instant`, not `auto`: `auto` defers to the CSS `scroll-behavior`, which a
        // consumer or a page-level `* { scroll-behavior: smooth }` may have set to
        // smooth — and then reduced motion would silently animate anyway.
        this.scrollTo({ left, behavior: animate && !reduce ? 'smooth' : 'instant' })
    }

    private _clamp(index: number): number {
        const max = this.count - 1
        if (!Number.isFinite(index) || max < 0) return 0
        return Math.max(0, Math.min(max, Math.trunc(index)))
    }

    private _reflect(): void {
        // Guarded, so the element's own write does not come back through
        // attributeChangedCallback as if a consumer had made it.
        this._reflecting = true
        this.setAttribute('index', String(this._index))
        this._reflecting = false
    }

    private _notify(): void {
        this.dispatchEvent(
            new CustomEvent<SwipePagerChangeDetail>('tc-pager-change', {
                detail: { index: this._index, count: this.count },
                bubbles: true,
                composed: true,
            }),
        )
        if (typeof this.onIndexChange === 'function') this.onIndexChange(this._index)
    }

    // ── Lazy rendering ───────────────────────────────────────────────────────

    private _applyLazy(): void {
        const pages = this.pages
        const lazy = this.lazy
        for (let i = 0; i < pages.length; i++) {
            const far = lazy && Math.abs(i - this._index) > 1
            // An ATTRIBUTE, not a class. These are the CONSUMER's elements, and
            // react-dom rewrites the whole `className` string whenever that prop's
            // value changes — a class written from here would vanish on the next
            // re-render of that page. `data-pager-far` is a name no framework is
            // managing. Same call tc-mobile-shell makes for `[data-scrolled]`.
            if (far !== pages[i].hasAttribute('data-pager-far')) {
                pages[i].toggleAttribute('data-pager-far', far)
            }
        }
    }

    // ── Observers ────────────────────────────────────────────────────────────

    // Pages come and go (`{days.map(…)}`), and nothing here moves them — the
    // observer only re-clamps the index and re-anchors the scroll offset, because a
    // page inserted BEFORE the current one shifts every snap point after it.
    private _observeChildren(): void {
        if (this._children || typeof MutationObserver === 'undefined') return
        this._children = new MutationObserver(() => {
            const index = this._clamp(this._index)
            if (index !== this._index) {
                this._index = index
                this._reflect()
            }
            this._applyLazy()
            this._scrollToIndex(this._index, false)
        })
        this._children.observe(this, { childList: true })
    }

    // A width change (rotation, a split-view resize, the pager finally getting
    // layout) moves every snap point. Mandatory snap re-snaps on its own in most
    // engines, but not reliably to the page the app believes it is on — so the
    // element re-anchors explicitly, and only when the WIDTH actually changed:
    // a height change is a content reflow and must not jump the pager.
    private _observeSize(): void {
        if (this._resize || typeof ResizeObserver === 'undefined') return
        this._resize = new ResizeObserver(() => {
            const width = this.clientWidth
            if (width === this._lastWidth) return
            this._lastWidth = width
            this._scrollToIndex(this._index, false)
        })
        this._resize.observe(this)
    }

    // ── Keyboard ─────────────────────────────────────────────────────────────

    private _onKeydown = (e: KeyboardEvent): void => {
        // Only when the PAGER ITSELF has focus. A page's content is full of
        // arrow-key consumers — a text field, a select, a nested rail — and taking
        // the key from them would be a worse bug than not having the shortcut.
        if (e.target !== this) return
        // `gesture="none"` turns off the DRAG, not the keyboard: a screen where a
        // horizontal swipe means something else still needs a keyboard path.
        if (e.key === 'ArrowRight') this.next()
        else if (e.key === 'ArrowLeft') this.prev()
        else if (e.key === 'Home') this.goTo(0)
        else if (e.key === 'End') this.goTo(this.count - 1)
        else return
        // Cancelled after the fact, so the browser's own arrow-key scroll of this
        // container (a ~40px nudge that would land the pager between two snap
        // points) never happens.
        e.preventDefault()
        // AND CONSUMED. preventDefault only cancels the DEFAULT action; the event
        // still reaches every window-level listener above, and „ArrowRight" is a
        // popular global shortcut. Measured: the examples site binds ←/→ on `window`
        // to move between demos, so paging the pager also navigated away from it.
        // Only the four keys this handler acted on are stopped, and only while the
        // pager itself has focus — an app's other shortcuts are untouched.
        e.stopPropagation()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SwipePager
    }
}

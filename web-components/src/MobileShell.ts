// tc-mobile-shell — the phone app frame.
//
// One fixed region at the top, EXACTLY ONE scrolling pane, optional chrome at
// the bottom, and an absolutely-positioned layer for sheets / FABs / toasts.
// The mobile counterpart to tc-dashboard-layout: same job (own the frame so no
// page has to re-derive it), opposite shape.
//
// WHY THIS ELEMENT RENDERS NOTHING
//   tc-dashboard-layout renders a skeleton and re-parents its slotted children
//   into it. That is fine for children a framework never touches again, and a
//   trap for the ones it does: react-dom removes a child with
//   `parentInstance.removeChild(child)` against the parent it BELIEVES the child
//   has, so a node this element re-parented throws NotFoundError the moment
//   React unmounts it — which is every route change (the content element) and
//   every conditionally rendered bar (`{dirty && <div slot="action">…}`). Both
//   are load-bearing for this shell.
//   So the shell renders no markup at all. Its five regions are the host's own
//   direct children, ordered and sized by CSS off their `slot` attribute; the
//   element only reads them. Nothing moves, so nothing can go stale.
//
// WHY THE HARDWARE INSETS SIT ON THE HOST
//   Putting `padding-bottom: var(--tc-safe-bottom)` on the dock region would
//   clobber the dock's own `padding` shorthand (a later, more specific
//   `padding-bottom` wins over the earlier shorthand and drops its value). The
//   host pays both insets instead, out of its own padding box, so slotted chrome
//   keeps every declaration it wrote — and the dock's tappable box provably ends
//   above the home indicator rather than merely looking like it does.

const TAG_NAME = 'tc-mobile-shell'

// scrollTop above this counts as "scrolled". 4px, so a 1-2px rubber-band or the
// browser's own scroll-anchoring nudge cannot flip the app bar's separator on.
const SCROLLED_AT = 4

// Offsets outlive the element on purpose: a route change tears down the pane and
// builds a new one, and "put the user back where they were" is only meaningful
// across exactly that boundary. Module-level, so two shells share one history.
const SCROLL_OFFSETS = new Map<string, number>()

// A restore target can only be applied once the pane has enough content to scroll
// that far, and content usually arrives a frame or several later (webfont metrics,
// images, a fetch). Retry for this many frames, then stop — an unbounded watcher
// would fight the user on a page whose content never grows that tall.
const RESTORE_FRAMES = 30

// Input types that never raise a software keyboard, so focusing one must not read
// as "the keyboard is up".
const NON_TEXT_INPUT_TYPES = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
])

// Below this, the shrinkage is a browser toolbar collapsing rather than a
// keyboard — no software keyboard on any phone is under 80px tall.
const KEYBOARD_MIN = 80

// The pane is the one direct child with no `slot` attribute. `<template>`,
// `<style>`, `<script>` and `<link>` are excluded because they are legitimate
// unslotted children that are never the content (they are `display: none`, so
// the CSS side needs no equivalent exclusion — but querySelector would happily
// return one as the pane).
const PANE_SELECTOR = ':scope > :not([slot]):not(template):not(style):not(script):not(link)'

export interface MobileShellScrollDetail {
    scrolled: boolean
    top: number
}

export type MobileShellScrollRestore = 'auto' | 'manual'

export class MobileShell extends HTMLElement {
    private _pane: HTMLElement | null = null
    private _scrolled = false
    private _emittedTop = -1
    private _scrollRaf = 0
    private _viewportRaf = 0
    private _restoreRaf = 0
    private _restoreTo: number | null = null
    private _restoreFramesLeft = 0
    private _keyboardInset = -1
    private _children: MutationObserver | null = null

    /** Called whenever `scrolled` flips. Alongside the `tc-shell-scroll` event. */
    onScrollStateChange: ((scrolled: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return ['data-key', 'edge', 'pane-bg', 'scroll-restore', 'desktop']
    }

    connectedCallback(): void {
        this._applyPaneBg()
        this._resolvePane()
        this._observeChildren()
        this._attachViewport()
        this._restore()
        this._applyKeyboardInset()
    }

    disconnectedCallback(): void {
        // Deliberately NOT banking the offset here. A custom-element disconnect
        // reaction runs AFTER the node has left the tree, and a detached element
        // has no layout box — so `pane.scrollTop` reads 0 and banking it would
        // wipe the very offset the remount is about to ask for. Measured: it
        // turned a 1234px restore into 0. Nothing is lost by skipping it, because
        // _onScroll banks synchronously on every scroll event rather than in its
        // frame, so there is never an unbanked offset to rescue.
        this._cancelScroll()
        this._cancelRestore()
        this._cancelViewport()
        this._detachPane()
        this._children?.disconnect()
        this._children = null
        this._detachViewport()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected) return
        if (prev === next) return
        if (name === 'pane-bg') {
            this._applyPaneBg()
        } else if (name === 'data-key') {
            // Nothing is banked here on purpose. The outgoing offset was already
            // written under the outgoing key by _onScroll, synchronously, for
            // exactly this moment: React can commit the attribute change either
            // side of the child swap, so reading scrollTop now might read a brand
            // new pane sitting at 0 and overwrite a good value with it.
            this._restore()
        }
    }

    /**
     * The scrolling element — the one direct child with no `slot` attribute.
     * `null` until that child exists (before first connect, or if a consumer
     * supplied only named slots).
     */
    get pane(): HTMLElement | null {
        return this._pane ?? this.querySelector<HTMLElement>(PANE_SELECTOR)
    }

    /** True once the pane has scrolled past a few pixels. */
    get scrolled(): boolean {
        return this._scrolled
    }

    get scrollRestore(): MobileShellScrollRestore {
        return this.getAttribute('scroll-restore') === 'manual' ? 'manual' : 'auto'
    }
    set scrollRestore(v: MobileShellScrollRestore) {
        this.setAttribute('scroll-restore', v === 'manual' ? 'manual' : 'auto')
    }

    /**
     * Opt-in desktop layout. At ≥992px the frame widens, the dock becomes a
     * left rail and sheets in the overlay layer become centred dialogs — all in
     * CSS (`tc-mobile-shell[desktop]` blocks across the component partials);
     * tc-bottom-sheet additionally reads the same scope to switch drag off.
     * Below 992px the attribute is inert, so the phone layout is untouched.
     * Observed only so the React typings carry it; no JS reacts to it here.
     */
    get desktop(): boolean {
        return this.hasAttribute('desktop')
    }
    set desktop(v: boolean) {
        this.toggleAttribute('desktop', v)
    }

    /** Scroll the pane back to the top. `smooth` is ignored under reduced motion. */
    scrollToTop(smooth = false): void {
        const pane = this.pane
        if (!pane) return
        const reduce =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        pane.scrollTo({ top: 0, behavior: smooth && !reduce ? 'smooth' : 'auto' })
    }

    // ── Pane wiring ──────────────────────────────────────────────────────────

    private _resolvePane(): void {
        const next = this.querySelector<HTMLElement>(PANE_SELECTOR)
        if (next === this._pane) return
        this._detachPane()
        this._pane = next
        if (!next) return
        // Landmark only when the consumer has not spoken for it — an in-app pane
        // is the main region, but a <main> element or an explicit role on either
        // the pane or the host is the consumer saying so themselves.
        if (next.tagName !== 'MAIN' && !next.hasAttribute('role') && !this.hasAttribute('role')) {
            next.setAttribute('role', 'main')
        }
        next.addEventListener('scroll', this._onScroll, { passive: true })
        // Any of these means the user has taken over; an in-flight restore must
        // stop fighting them mid-gesture.
        next.addEventListener('pointerdown', this._onUserIntent, { passive: true })
        next.addEventListener('wheel', this._onUserIntent, { passive: true })
        next.addEventListener('keydown', this._onUserIntent)
    }

    private _detachPane(): void {
        const pane = this._pane
        if (!pane) return
        pane.removeEventListener('scroll', this._onScroll)
        pane.removeEventListener('pointerdown', this._onUserIntent)
        pane.removeEventListener('wheel', this._onUserIntent)
        pane.removeEventListener('keydown', this._onUserIntent)
        this._pane = null
    }

    // A route change replaces the pane element and toggles the bottom bars. Both
    // are childList mutations of the host, and neither moves anything — the
    // observer only re-reads which child is now the pane.
    private _observeChildren(): void {
        if (this._children || typeof MutationObserver === 'undefined') return
        this._children = new MutationObserver(() => {
            const before = this._pane
            this._resolvePane()
            if (this._pane !== before) this._restore()
        })
        this._children.observe(this, { childList: true })
    }

    // ── Scroll state ─────────────────────────────────────────────────────────

    private _onScroll = (): void => {
        const pane = this._pane
        if (!pane) return
        // Banked synchronously rather than inside the frame: a navigation can land
        // between the scroll event and the next frame, and the offset has to be
        // recorded against the key that was current when the user scrolled.
        // Skipped while a restore is in flight, or a clamped 0 would overwrite the
        // very value being restored.
        if (this._restoreTo === null) this._bank(pane.scrollTop)
        if (this._scrollRaf) return
        this._scrollRaf = requestAnimationFrame(this._flush)
    }

    // One emission per frame, however many scroll events the engine fired into it.
    private _flush = (): void => {
        this._scrollRaf = 0
        const pane = this._pane
        if (!pane) return
        const top = pane.scrollTop
        const scrolled = top > SCROLLED_AT
        if (scrolled !== this._scrolled) {
            this._scrolled = scrolled
            // An ATTRIBUTE is the state selectors should key on, not the class.
            // react-dom writes the whole `className` string whenever that prop's
            // value changes, so a shell rendered as
            // `<tc-mobile-shell className={cx(...)}>` loses the class on the next
            // re-render — the same clobbering that stops this element writing
            // `.tc-scroll-y` onto the pane. `data-scrolled` is a name no framework
            // is managing. The class is kept alongside it purely so an existing
            // `.tc-mobile-shell--scrolled` selector still matches.
            this.toggleAttribute('data-scrolled', scrolled)
            this.classList.toggle('tc-mobile-shell--scrolled', scrolled)
            if (typeof this.onScrollStateChange === 'function') this.onScrollStateChange(scrolled)
        }
        if (top === this._emittedTop) return
        this._emittedTop = top
        this.dispatchEvent(
            new CustomEvent<MobileShellScrollDetail>('tc-shell-scroll', {
                detail: { scrolled, top },
                bubbles: true,
                composed: true,
            }),
        )
    }

    private _cancelScroll(): void {
        if (!this._scrollRaf) return
        cancelAnimationFrame(this._scrollRaf)
        this._scrollRaf = 0
    }

    // ── Scroll restoration ───────────────────────────────────────────────────

    private _bank(top: number): void {
        const key = this.getAttribute('data-key')
        if (key === null) return
        SCROLL_OFFSETS.set(key, top)
    }

    private _restore(): void {
        this._cancelRestore()
        const pane = this._pane
        if (!pane) return
        // `manual` means the consumer owns the offset — do not even reset to 0,
        // or a manual shell would jump on every key change.
        if (this.scrollRestore !== 'auto') return
        const key = this.getAttribute('data-key')
        const to = key === null ? 0 : (SCROLL_OFFSETS.get(key) ?? 0)
        if (to <= 0) {
            // A key never seen before starts at the top, and 0 always applies —
            // no retry loop needed.
            pane.scrollTop = 0
            this._flush()
            return
        }
        this._restoreTo = to
        this._restoreFramesLeft = RESTORE_FRAMES
        this._tryRestore()
    }

    private _tryRestore = (): void => {
        this._restoreRaf = 0
        const pane = this._pane
        const to = this._restoreTo
        if (!pane || to === null) return
        pane.scrollTop = to
        // A scroller clamps scrollTop to the range it has RIGHT NOW, so a pane
        // whose content has not arrived silently lands short. Read it back and
        // retry rather than assuming the write took.
        if (Math.abs(pane.scrollTop - to) <= 1 || --this._restoreFramesLeft <= 0) {
            this._restoreTo = null
            this._flush()
            return
        }
        this._restoreRaf = requestAnimationFrame(this._tryRestore)
    }

    private _onUserIntent = (): void => {
        this._cancelRestore()
    }

    private _cancelRestore(): void {
        if (this._restoreRaf) {
            cancelAnimationFrame(this._restoreRaf)
            this._restoreRaf = 0
        }
        this._restoreTo = null
        this._restoreFramesLeft = 0
    }

    // ── Keyboard avoidance ───────────────────────────────────────────────────

    private _attachViewport(): void {
        const vv = window.visualViewport
        if (vv) {
            vv.addEventListener('resize', this._onViewport)
            vv.addEventListener('scroll', this._onViewport)
        }
        this.addEventListener('focusin', this._onViewport)
        this.addEventListener('focusout', this._onViewport)
    }

    private _detachViewport(): void {
        const vv = window.visualViewport
        if (vv) {
            vv.removeEventListener('resize', this._onViewport)
            vv.removeEventListener('scroll', this._onViewport)
        }
        this.removeEventListener('focusin', this._onViewport)
        this.removeEventListener('focusout', this._onViewport)
    }

    // Deferred by a frame, which also fixes the focus handoff: focusout fires
    // before focusin, so reading activeElement in the handler would see `body`
    // and drop the inset for one frame every time the user moves between two
    // fields — a visible flicker of the action bar behind the keyboard.
    private _onViewport = (): void => {
        if (this._viewportRaf) return
        this._viewportRaf = requestAnimationFrame(() => {
            this._viewportRaf = 0
            this._applyKeyboardInset()
        })
    }

    private _cancelViewport(): void {
        if (!this._viewportRaf) return
        cancelAnimationFrame(this._viewportRaf)
        this._viewportRaf = 0
    }

    private _applyKeyboardInset(): void {
        const vv = window.visualViewport
        let inset = 0
        // The gate is "a text field inside this shell has focus", not "the visual
        // viewport shrank". On iOS the layout viewport is the LARGE viewport, so
        // `clientHeight - vv.height` also measures the collapsing browser toolbar
        // — ungated, that reads as a permanent phantom keyboard ~60px tall.
        if (vv && this._textEntryFocused()) {
            const covered = document.documentElement.clientHeight - vv.height - vv.offsetTop
            inset = covered >= KEYBOARD_MIN ? Math.round(covered) : 0
        }
        if (inset === this._keyboardInset) return
        this._keyboardInset = inset
        this.style.setProperty('--tc-keyboard-inset', `${inset}px`)
    }

    private _textEntryFocused(): boolean {
        const el = document.activeElement
        if (!(el instanceof HTMLElement) || !this.contains(el)) return false
        if (el instanceof HTMLTextAreaElement) return true
        if (el instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(el.type)
        // A <select> raises a native picker, not a keyboard, so it is not listed.
        return el.isContentEditable
    }

    // ── Cosmetics driven from attributes ─────────────────────────────────────

    private _applyPaneBg(): void {
        const v = this.getAttribute('pane-bg')
        // setProperty parses the value, so a malformed or injected one is dropped
        // rather than reaching the stylesheet.
        if (v) this.style.setProperty('--bs-mobile-shell-bg', v)
        else this.style.removeProperty('--bs-mobile-shell-bg')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MobileShell
    }
}

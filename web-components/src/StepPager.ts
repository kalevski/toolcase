import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'
import { msg, msgFormat } from './messages'
// TYPE-ONLY, so this element does not pull tc-swipe-pager into a consumer's bundle
// twice — the tag is registered by src/register.ts like every other one.
import type { SwipePager } from './SwipePager'

// tc-step-pager — the full-screen guided-step surface: a segmented progress rule, one
// step per page, and a two-button control row parked in the thumb zone. Screen `1e`
// of the JADI.mk phone design ("Готви" — cooking mode).
//
// It COMPOSES tc-swipe-pager rather than re-implementing paging: the gesture, the
// snap geometry, the settled-index debounce and the keyboard are all that element's,
// and this one adds the chrome around them. Everything below the pager — the
// progress rule, the labels, the announcer — is patched from ONE settled index, so
// swiping and pressing the buttons can never disagree.
//
// STEPS ARE A PROPERTY, NOT SLOTS
//   `steps` takes `{ no?, text, hint? }` objects, or bare strings. That is not a
//   convenience: the app's step data is plain strings off a recipe, so a slotted API
//   would make every consumer duplicate this markup in their own template and then
//   keep it in step with this file. As a consequence the element owns its entire
//   subtree, has no slots, and can neither hoist a nested `[slot]` nor be hoisted
//   from. It also takes no children — anything you put inside is overwritten.
//
// THE BACK BUTTON STAYS ENABLED ON THE FIRST STEP
//   The design draws it in its normal state at step 1, and the design's own live
//   logic clamps with `Math.max(0, step - 1)` rather than disabling anything. So the
//   button keeps every pixel it has and does nothing — with `aria-disabled="true"`
//   set, which is the only part of "it does nothing" a screen reader can otherwise
//   not know. Style `[aria-disabled]` yourself if you want the visual too.
//
// keep-awake IS DRIVEN OFF THE REAL LOCK, NEVER OFF THE ATTRIBUTE
//   `navigator.wakeLock.request('screen')` needs a secure context and a VISIBLE
//   document, rejects outright on engines that do not implement it, and is released
//   by the UA — not by us — as soon as the tab hides. So the „Екранот е буден" chip
//   is bound to `[data-wake]`, which is written only after a sentinel is actually in
//   hand and cleared from the sentinel's own `release` event. A chip driven off the
//   attribute's INTENT would be a lie on Firefox, on http://, and every time the
//   user takes a phone call mid-recipe.
//
// THE PROGRESS RULE HAS TWO SHAPES, AND THE STEP COUNT PICKS ONE
//   `1e` draws four segments and four segments read perfectly. Fifteen do not: at
//   390px the gutter leaves 354px, so fifteen segments are 20px each separated by
//   4px gaps — a dotted line whose fill boundary nobody can find, and the thing the
//   rule exists to communicate (how far through am I) is lost. Past `max-segments`
//   (default 10) the same region becomes ONE continuous bar filled to
//   `(index + 1) / count` with a „3/15" counter beside it, which states the position
//   in figures instead of asking the eye to count ticks. Same data, same colours,
//   same height — only the encoding changes.

const TAG_NAME = 'tc-step-pager'

/** Segment count past which the progress rule becomes a single bar + a counter. */
const DEFAULT_MAX_SEGMENTS = 10

/** One step. `no` is the number as DRAWN; omit it for zero-padded `01`…`0N`. */
export interface StepPagerStep {
    no?: string
    text: string
    hint?: string
}

/** A bare string is a step with no hint and an auto-numbered `no`. */
export type StepPagerStepInput = string | StepPagerStep

export interface StepPagerChangeDetail {
    index: number
    count: number
    /** `true` on the final step — when the advance button reads `done-label`. */
    last: boolean
}

// Built once per instance and never interpolated: every string below goes in through
// `textContent` / `setAttribute`, which escape for free. Rebuilding this on an
// attribute change would destroy the three buttons on every `heading` write — the
// defect tc-app-bar shipped with and had to fix.
const SHELL =
    `<div class="tc-step-pager-top">` +
    `<button type="button" class="tc-step-pager-close tc-touch-target tc-no-tap-highlight">` +
    lucideByName('x', 'tc-step-pager-close-icon') +
    `</button>` +
    `<div class="tc-step-pager-heading">` +
    `<span class="tc-step-pager-heading-text"></span>` +
    `</div>` +
    `<span class="tc-step-pager-wake">` +
    lucideByName('sun', 'tc-step-pager-wake-icon') +
    `<span class="tc-step-pager-wake-label"></span>` +
    `</span>` +
    `</div>` +
    // aria-hidden: the rule is the VISUAL of a position the announcer below already
    // states in words. A role="progressbar" here would have a screen reader read the
    // same fact twice, in two different phrasings — and that is just as true of the
    // „3/15" counter, which is why it lives inside this region rather than beside it.
    `<div class="tc-step-pager-progress" aria-hidden="true">` +
    `<div class="tc-step-pager-track"></div>` +
    `<span class="tc-step-pager-count" hidden></span>` +
    `</div>` +
    `<tc-swipe-pager class="tc-step-pager-pages"></tc-swipe-pager>` +
    `<div class="tc-step-pager-caption"></div>` +
    `<div class="tc-step-pager-controls">` +
    `<button type="button" class="tc-step-pager-back tc-no-tap-highlight">` +
    lucideByName('chevron-left', 'tc-step-pager-back-icon') +
    `</button>` +
    `<button type="button" class="tc-step-pager-advance tc-no-tap-highlight">` +
    `<span class="tc-step-pager-advance-label"></span>` +
    lucideByName('chevron-right', 'tc-step-pager-advance-icon') +
    `</button>` +
    `</div>` +
    `<div class="tc-step-pager-announcer visually-hidden" aria-live="polite" aria-atomic="true"></div>`

function normalise(step: StepPagerStepInput): StepPagerStep {
    if (typeof step === 'string') return { text: step }
    return { no: step?.no, text: step?.text ?? '', hint: step?.hint }
}

export class StepPager extends HTMLElement {
    private _steps: StepPagerStep[] = []
    private _index = 0
    private _reflecting = false
    private _lock: WakeLockSentinel | null = null
    private _lockPending = false
    private _visibilityBound = false

    /** Called on a settled step change. Alongside `tc-step-pager-change`. */
    onIndexChange: ((index: number) => void) | null = null
    /** Called when the advance button is pressed on the LAST step. Alongside `tc-step-pager-done`. */
    onDone: (() => void) | null = null
    /** Called when the ✕ is pressed. Alongside `tc-step-pager-close`. */
    onClose: (() => void) | null = null
    /** Called when the context title is pressed — `heading-action` only. Alongside `tc-step-pager-heading`. */
    onHeadingAction: (() => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'back-label',
            'close-label',
            'done-label',
            'heading',
            'heading-action',
            'hint-label',
            'index',
            'keep-awake',
            'max-segments',
            'next-label',
            'swipe-hint',
            'wake-label',
        ]
    }

    connectedCallback(): void {
        this._index = this._clamp(Number(this.getAttribute('index') ?? 0))
        this._render()
        // Re-attached on every connect: a React move/remount disconnects then
        // reconnects without re-running any one-time init. Re-adding the same
        // handler reference is a no-op, so repeating this is safe.
        this.addEventListener('click', this._onClick)
        // The inner pager's event BUBBLES, so this catches both a swipe and a
        // programmatic page. It also keeps bubbling past this element on purpose —
        // see the SKILL entry.
        this.addEventListener('tc-pager-change', this._onPagerChange)
        this._syncWake()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('tc-pager-change', this._onPagerChange)
        this._releaseWake()
        this._unbindVisibility()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        if (name === 'keep-awake') {
            this._syncWake()
            return
        }
        if (name === 'index') {
            if (this._reflecting) return
            const index = this._clamp(Number(next))
            if (index === this._index) return
            this._index = index
            this._pager?.goTo(index, true)
            this._patch()
            // Deliberately not notified: the consumer wrote this index, so echoing
            // it back is how a controlled component ends up in a loop. Same rule as
            // tc-swipe-pager.
            return
        }
        if (name === 'max-segments') {
            // The threshold decides which of the two progress shapes is in the DOM,
            // so this one has to rebuild the rule rather than only patch it.
            this._buildProgress()
            this._patch()
            return
        }
        if (name === 'heading-action') {
            this._syncHeadingTag()
            this._patch()
            return
        }
        // Everything else is text. Patched, never rebuilt.
        this._patch()
    }

    // ── Steps ────────────────────────────────────────────────────────────────

    get steps(): StepPagerStepInput[] {
        return this._steps
    }
    set steps(v: StepPagerStepInput[]) {
        this._steps = Array.isArray(v) ? v.map(normalise) : []
        this._index = this._clamp(this._index)
        if (this.isConnected) {
            this._buildPages()
            this._patch()
        }
    }

    /** How many steps there are. Read-only — it is `steps.length`. */
    get count(): number {
        return this._steps.length
    }

    /** The current step. Reflected as `index`, and safe to drive from a framework. */
    get index(): number {
        return this._index
    }
    set index(v: number) {
        this.goTo(v)
    }

    /** Page to `index` and notify. `animate` is ignored under reduced motion. */
    goTo(index: number, animate = true): void {
        const next = this._clamp(index)
        if (next === this._index) return
        // Routed through the pager so there is ONE place an index change is
        // committed: its `tc-pager-change` comes back to `_onPagerChange`, which
        // patches the chrome and notifies.
        this._pager?.goTo(next, animate)
        // No pager yet (not rendered): commit locally so the state is not lost.
        if (!this._pager) {
            this._index = next
            this._reflect()
        }
    }

    next(): void {
        this._pager?.next()
    }

    prev(): void {
        this._pager?.prev()
    }

    // ── Labels ───────────────────────────────────────────────────────────────

    get heading(): string | null {
        return this.getAttribute('heading')
    }
    set heading(v: string | null) {
        if (v != null) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    /** Advance-button label on every step but the last. Falls back to the `next` message. */
    get nextLabel(): string {
        return this.getAttribute('next-label') || msg('next')
    }
    set nextLabel(v: string | null) {
        if (v != null) this.setAttribute('next-label', v)
        else this.removeAttribute('next-label')
    }

    /** Advance-button label on the LAST step — the design's „Готово". */
    get doneLabel(): string {
        return this.getAttribute('done-label') || msg('done')
    }
    set doneLabel(v: string | null) {
        if (v != null) this.setAttribute('done-label', v)
        else this.removeAttribute('done-label')
    }

    /** Eyebrow above a step's hint block — the design's „Совет". `''` hides it. */
    get hintLabel(): string {
        const raw = this.getAttribute('hint-label')
        return raw == null ? msg('tip') : raw
    }
    set hintLabel(v: string | null) {
        if (v != null) this.setAttribute('hint-label', v)
        else this.removeAttribute('hint-label')
    }

    /** Accessible name for the back chevron. Falls back to the `back` message. */
    get backLabel(): string {
        return this.getAttribute('back-label') || msg('back')
    }
    set backLabel(v: string | null) {
        if (v != null) this.setAttribute('back-label', v)
        else this.removeAttribute('back-label')
    }

    /** Accessible name for the ✕. Falls back to the `close` message. */
    get closeLabel(): string {
        return this.getAttribute('close-label') || msg('close')
    }
    set closeLabel(v: string | null) {
        if (v != null) this.setAttribute('close-label', v)
        else this.removeAttribute('close-label')
    }

    /** The centred caption above the controls. Absent ⇒ no caption row at all. */
    get swipeHint(): string | null {
        return this.getAttribute('swipe-hint')
    }
    set swipeHint(v: string | null) {
        if (v != null) this.setAttribute('swipe-hint', v)
        else this.removeAttribute('swipe-hint')
    }

    /**
     * Make the context title a button that fires `tc-step-pager-heading`.
     *
     * The canvas draws the title as inert text, and for a self-contained sequence it
     * is. It stops being enough the moment the sequence has context the reader needs
     * mid-way and the surface has nowhere else to put it — cooking mode with the
     * ingredient amounts, which the design has no affordance for at all. This is that
     * affordance: the row a thumb already knows names the thing, so it is where a tap
     * looks for more of it, and the chevron says the tap does something.
     */
    get headingAction(): boolean {
        return this.hasAttribute('heading-action')
    }
    set headingAction(v: boolean) {
        this.toggleAttribute('heading-action', v)
    }

    /**
     * How many steps still get one progress segment each. Past it the rule is a single
     * filled bar with a „3/15" counter — see the header comment.
     */
    get maxSegments(): number {
        const raw = Number(this.getAttribute('max-segments'))
        return Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : DEFAULT_MAX_SEGMENTS
    }
    set maxSegments(v: number) {
        this.setAttribute('max-segments', String(v))
    }

    /** Wake-chip label. Falls back to the `screenAwake` message. */
    get wakeLabel(): string {
        return this.getAttribute('wake-label') || msg('screenAwake')
    }
    set wakeLabel(v: string | null) {
        if (v != null) this.setAttribute('wake-label', v)
        else this.removeAttribute('wake-label')
    }

    // ── Wake lock ────────────────────────────────────────────────────────────

    /** Ask the OS to keep the screen on while this element is mounted and visible. */
    get keepAwake(): boolean {
        return this.hasAttribute('keep-awake')
    }
    set keepAwake(v: boolean) {
        this.toggleAttribute('keep-awake', v)
    }

    /**
     * Whether a screen wake lock is ACTUALLY held right now — not whether one was
     * asked for. Reflected as `[data-wake]`, which is what shows the chip.
     */
    get wake(): boolean {
        return this._lock !== null
    }

    private _syncWake(): void {
        if (this.keepAwake && this.isConnected) {
            this._bindVisibility()
            void this._requestWake()
        } else {
            this._releaseWake()
            this._unbindVisibility()
        }
    }

    private async _requestWake(): Promise<void> {
        if (this._lock || this._lockPending) return
        if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
        // Typed as non-optional in lib.dom, absent at runtime on Firefox and on
        // Safari before 16.4 — so the cast is what makes the guard expressible.
        const api = navigator.wakeLock as WakeLock | undefined
        if (!api) return
        this._lockPending = true
        try {
            const lock = await api.request('screen')
            // The world can move while the promise is in flight: the attribute
            // removed, the element unmounted, the user gone to another tab.
            if (!this.keepAwake || !this.isConnected) {
                void lock.release().catch(() => undefined)
                return
            }
            this._lock = lock
            lock.addEventListener('release', this._onLockRelease)
            this._setWake(true)
        } catch {
            // Unsupported engine, insecure context, hidden document, a permissions
            // policy, or a UA that simply declined. All of them are normal and none
            // is the user's problem: the chip just never appears. NEVER surface this.
        } finally {
            this._lockPending = false
        }
    }

    private _onLockRelease = (): void => {
        // Fired by the UA as well as by us — the lock is auto-released the moment the
        // document hides. This is the ONE place the chip is turned off, which is what
        // keeps `[data-wake]` honest about the lock rather than about the attribute.
        this._lock?.removeEventListener('release', this._onLockRelease)
        this._lock = null
        this._setWake(false)
    }

    private _releaseWake(): void {
        const lock = this._lock
        this._lock = null
        this._setWake(false)
        if (!lock) return
        lock.removeEventListener('release', this._onLockRelease)
        void lock.release().catch(() => undefined)
    }

    // An ATTRIBUTE, not a class: react-dom rewrites the whole `className` string
    // whenever that prop's value changes, so a state class would be lost on the next
    // re-render. Same call tc-mobile-shell makes for `[data-scrolled]`.
    private _setWake(on: boolean): void {
        if (on === this.hasAttribute('data-wake')) return
        this.toggleAttribute('data-wake', on)
    }

    private _bindVisibility(): void {
        if (this._visibilityBound || typeof document === 'undefined') return
        document.addEventListener('visibilitychange', this._onVisibility)
        this._visibilityBound = true
    }

    private _unbindVisibility(): void {
        if (!this._visibilityBound) return
        document.removeEventListener('visibilitychange', this._onVisibility)
        this._visibilityBound = false
    }

    private _onVisibility = (): void => {
        // The UA releases the lock when the document hides and does NOT restore it
        // on return, so a session that survives a phone call has to ask again.
        if (document.visibilityState === 'visible') this._syncWake()
    }

    // ── Input ────────────────────────────────────────────────────────────────

    private _onClick = (e: Event): void => {
        const target = e.target as Element | null
        if (!target?.closest) return
        const button = target.closest<HTMLElement>(
            '.tc-step-pager-close, .tc-step-pager-back, .tc-step-pager-advance, .tc-step-pager-heading',
        )
        // `:scope` is not valid in closest(); scope by containment instead, so a
        // nested tc-step-pager's controls cannot drive this one.
        if (!button || button.closest(TAG_NAME) !== this) return

        if (button.classList.contains('tc-step-pager-heading')) {
            // A plain title without `heading-action`: still matched by the selector
            // above (it is the same class), and deliberately silent.
            if (!this.headingAction) return
            this.dispatchEvent(
                new CustomEvent('tc-step-pager-heading', { bubbles: true, composed: true }),
            )
            if (typeof this.onHeadingAction === 'function') this.onHeadingAction()
            return
        }
        if (button.classList.contains('tc-step-pager-close')) {
            this.dispatchEvent(
                new CustomEvent('tc-step-pager-close', { bubbles: true, composed: true }),
            )
            if (typeof this.onClose === 'function') this.onClose()
            return
        }
        if (button.classList.contains('tc-step-pager-back')) {
            // A no-op on the first step, by design — see the header comment.
            this.prev()
            return
        }
        if (this.count > 0 && this._index >= this.count - 1) {
            this.dispatchEvent(
                new CustomEvent('tc-step-pager-done', { bubbles: true, composed: true }),
            )
            if (typeof this.onDone === 'function') this.onDone()
            return
        }
        this.next()
    }

    private _onPagerChange = (e: Event): void => {
        // Only OUR pager. The event bubbles, so a pager a consumer nested inside a
        // step would otherwise drive the progress rule.
        if (e.target !== this._pager) return
        const index = this._clamp(this._pager?.index ?? 0)
        if (index === this._index) return
        this._index = index
        this._reflect()
        this._patch()
        this.dispatchEvent(
            new CustomEvent<StepPagerChangeDetail>('tc-step-pager-change', {
                detail: { index, count: this.count, last: index >= this.count - 1 },
                bubbles: true,
                composed: true,
            }),
        )
        if (typeof this.onIndexChange === 'function') this.onIndexChange(index)
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private get _pager(): SwipePager | null {
        return this.querySelector<SwipePager>(':scope > tc-swipe-pager')
    }

    private _render(): void {
        // `firstElementChild` also covers the other way the DOM can go missing: a
        // React move/remount, or a consumer who wrote children of their own.
        if (!this.querySelector(':scope > .tc-step-pager-top')) {
            this.innerHTML = SHELL
            this._syncHeadingTag()
            this._buildPages()
        }
        this._patch()
    }

    /**
     * Swap the context title between a `div` and a `button`.
     *
     * Not "always a button, inert when unused": a `<button>` announces as a button
     * whether or not it does anything, and a title that is only text must not claim
     * to be pressable. The node is a leaf between the ✕ and the wake chip, so
     * replacing it costs nothing the way rebuilding the whole row would.
     */
    private _syncHeadingTag(): void {
        const current = this.querySelector<HTMLElement>(
            ':scope > .tc-step-pager-top > .tc-step-pager-heading',
        )
        if (!current) return
        const wantButton = this.headingAction
        if (wantButton === (current.tagName === 'BUTTON')) return
        const next = document.createElement(wantButton ? 'button' : 'div')
        next.className = wantButton
            ? 'tc-step-pager-heading tc-no-tap-highlight'
            : 'tc-step-pager-heading'
        if (wantButton) {
            next.setAttribute('type', 'button')
            // The button's accessible NAME stays the title — that is its visible label,
            // and replacing it with „Ingredients" would break the visible-label rule.
            // What the title cannot say is that pressing it opens something; that is
            // exactly what `aria-haspopup` is for. `dialog`, because every consumer of
            // this so far opens a sheet, and a sheet is a dialog.
            next.setAttribute('aria-haspopup', 'dialog')
        }
        next.innerHTML =
            `<span class="tc-step-pager-heading-text"></span>` +
            (wantButton ? lucideByName('chevron-down', 'tc-step-pager-heading-icon') : '')
        current.replaceWith(next)
    }

    private _buildPages(): void {
        const pager = this._pager
        if (!pager) return
        pager.innerHTML = this._steps
            .map((step, i) => {
                // The design writes `01`…`04`. Auto-numbering keeps the app free to
                // pass bare strings and still get the canvas's zero-padded figures.
                const no = step.no || String(i + 1).padStart(2, '0')
                const hint = step.hint
                    ? `<div class="tc-step-pager-hint">` +
                      `<div class="tc-step-pager-hint-label"></div>` +
                      `<div class="tc-step-pager-hint-text">${esc(step.hint)}</div>` +
                      `</div>`
                    : ''
                // .tc-step-pager-body exists so the block can be centred with AUTO
                // MARGINS instead of `justify-content: center`. Centred flex content
                // that overflows its container overflows in BOTH directions and the
                // top of it becomes unreachable by scrolling; auto margins collapse
                // to 0 when there is no free space, so a tall step scrolls normally.
                return (
                    `<div class="tc-step-pager-step">` +
                    `<div class="tc-step-pager-body">` +
                    `<div class="tc-step-pager-no">${esc(no)}</div>` +
                    `<div class="tc-step-pager-text">${esc(step.text)}</div>` +
                    hint +
                    `</div>` +
                    `</div>`
                )
            })
            .join('')

        this._buildProgress()
        pager.goTo(this._index, false)
    }

    /** The progress rule — N segments, or one bar past `max-segments`. */
    private _buildProgress(): void {
        const track = this.querySelector<HTMLElement>(
            ':scope > .tc-step-pager-progress > .tc-step-pager-track',
        )
        if (!track) return
        const count = this._steps.length
        const bar = count > this.maxSegments
        this.toggleAttribute('data-progress-bar', bar)
        if (bar) {
            if (!track.hasAttribute('data-bar')) {
                track.setAttribute('data-bar', '')
                track.innerHTML = `<span class="tc-step-pager-bar"></span>`
            }
            return
        }
        track.removeAttribute('data-bar')
        // Rebuilt only when the count changed: the segments carry `[data-filled]`,
        // and throwing them away on every patch would restart the .18s fill.
        if (track.childElementCount !== count || track.querySelector('.tc-step-pager-bar')) {
            track.innerHTML = `<span class="tc-step-pager-seg"></span>`.repeat(count)
        }
    }

    private _patch(): void {
        const count = this._steps.length
        const index = this._index
        const isLast = count === 0 || index >= count - 1

        // Compared before writing so an unchanged string never touches the DOM:
        // `textContent =` replaces the text node, which is enough to break a
        // selection, interrupt a screen-reader read, or re-announce a live region.
        const write = (selector: string, text: string): void => {
            const el = this.querySelector(selector)
            if (el && el.textContent !== text) el.textContent = text
        }

        write('.tc-step-pager-heading-text', this.heading ?? '')
        write('.tc-step-pager-wake-label', this.wakeLabel)
        write('.tc-step-pager-advance-label', isLast ? this.doneLabel : this.nextLabel)

        const caption = this.querySelector<HTMLElement>(':scope > .tc-step-pager-caption')
        if (caption) {
            const text = this.swipeHint ?? ''
            if (caption.textContent !== text) caption.textContent = text
            caption.hidden = text === ''
        }

        const hintLabel = this.hintLabel
        this.querySelectorAll<HTMLElement>('.tc-step-pager-hint-label').forEach((el) => {
            if (el.textContent !== hintLabel) el.textContent = hintLabel
            el.hidden = hintLabel === ''
        })

        // An attribute rather than a class, for the react-dom reason above — and
        // `data-filled` rather than an inline style so a theme can re-point the fill.
        this.querySelectorAll<HTMLElement>('.tc-step-pager-seg').forEach((seg, i) => {
            const filled = i <= index
            if (filled !== seg.hasAttribute('data-filled'))
                seg.toggleAttribute('data-filled', filled)
        })

        // Bar mode. The fill percentage is written on the TRACK and not on the host:
        // react-dom owns the host's `style` object and clears keys it put there, and a
        // property the element writes into the same declaration is how tc-mobile-shell
        // lost its pane background. Nothing but this element touches the track.
        const bar = this.hasAttribute('data-progress-bar')
        const fill = this.querySelector<HTMLElement>('.tc-step-pager-track[data-bar]')
        if (fill) {
            // Filled through AND INCLUDING the current step, exactly as the segments
            // are — so a 15-step recipe shows 1/15 of the bar on step 1, not nothing.
            const percent = count === 0 ? 0 : ((index + 1) / count) * 100
            fill.style.setProperty('--bs-step-pager-fill', `${percent.toFixed(2)}%`)
        }
        const counter = this.querySelector<HTMLElement>(
            ':scope > .tc-step-pager-progress > .tc-step-pager-count',
        )
        if (counter) {
            // „3/15" — figures and a solidus, so there is no sentence to translate.
            // The words are the announcer's job (`stepOfTotal`).
            const text = bar && count > 0 ? `${index + 1}/${count}` : ''
            if (counter.textContent !== text) counter.textContent = text
            counter.hidden = text === ''
        }

        this.querySelector('.tc-step-pager-close')?.setAttribute('aria-label', this.closeLabel)
        const back = this.querySelector('.tc-step-pager-back')
        if (back) {
            back.setAttribute('aria-label', this.backLabel)
            // Not `disabled`: the design draws the button in its normal state at step
            // 1 and its own logic clamps rather than disabling. `aria-disabled` is
            // the part of "pressing this does nothing" that is otherwise invisible
            // to a screen reader, and it changes no pixel.
            back.setAttribute('aria-disabled', String(index <= 0))
        }

        write(
            '.tc-step-pager-announcer',
            count === 0 ? '' : msgFormat('stepOfTotal', { current: index + 1, total: count }),
        )

        // The pager is a focusable group; without a name it announces as a bare
        // „group". The recipe title is the only name this element has to give.
        const pager = this._pager
        if (pager) {
            const label = this.heading
            if (label) pager.setAttribute('aria-label', label)
            else pager.removeAttribute('aria-label')
        }
    }

    private _clamp(index: number): number {
        const max = this._steps.length - 1
        if (!Number.isFinite(index) || max < 0) return 0
        return Math.max(0, Math.min(max, Math.trunc(index)))
    }

    private _reflect(): void {
        this._reflecting = true
        this.setAttribute('index', String(this._index))
        this._reflecting = false
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StepPager
    }
}

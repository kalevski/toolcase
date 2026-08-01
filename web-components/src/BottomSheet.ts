import { reflow, executeAfterTransition } from './internal/transition'
import { overlayStack } from './internal/overlay-stack'

// tc-bottom-sheet — the phone-native modal surface: content enters from the thumb
// side, a grab handle is the dismiss affordance, and a drag beats a small target.
//
// NOT A VARIANT OF tc-modal. That element is centre-anchored with a corner ✕, and
// on a 390x844 screen a centred dialog either floats awkwardly mid-screen or
// effectively becomes full-screen — with its only dismiss control in the hardest
// place on the device for a thumb to reach. Every mobile OS solved this with the
// bottom sheet, and the two shapes disagree on nearly every declaration.
//
// THE HOST IS THE PANEL, AND THE SCRIM IS A SEPARATE ELEMENT
//   The obvious structure — host = full-surface overlay, rendered wrapper = panel —
//   requires re-parenting the consumer's slotted children into that wrapper. That
//   breaks under react-dom, which removes a child with
//   `parentInstance.removeChild(child)` against the parent it BELIEVES the child
//   has (see the header comments in src/MobileShell.ts and src/AppBar.ts). A sheet's
//   children are the most conditionally-rendered content in an app — a footer that
//   appears once a form is dirty, a body that swaps per step — so that trap is not
//   hypothetical here.
//   So the host itself IS the panel: fixed to the bottom edge, rounded top corners,
//   its four regions being the host's own children ordered by CSS off their `slot`
//   attribute. The grab handle is a `::before` pseudo-element, so it costs no DOM at
//   all. The only node this element ever creates inside itself is the optional
//   heading (from the `heading` attribute), and it is PREPENDED — never moved.
//   The scrim is a single module-level element mounted as the sheet's SIBLING; see
//   scrimAcquire() for why that placement is the only one that always paints below
//   the sheet.
//
// THE SCRIM IS A WARM CREAM WASH, NOT A BLACK OVERLAY
//   `rgba(253,248,236,.6)` over a `blur(1.5px)`/`opacity:.6` page. This is a
//   signature of the design and the easiest thing here to get wrong: black turns a
//   cream canvas grey and breaks the printed-paper read the whole system depends
//   on. `scrim="dark"` exists for consumers on a dark canvas; it is not the default.

const TAG_NAME = 'tc-bottom-sheet'

/** Dismiss past this fraction of the sheet's own height. */
const DISMISS_FRACTION = 0.35
/** …or on a flick faster than this, whatever the distance. px/ms, downward positive. */
const FLICK_VELOCITY = 0.5
/**
 * Movement before a press becomes a drag. Small on purpose: on a touch screen the
 * FIRST touchmove is the only cancelable one, so a large slop lets the browser
 * commit to a native pan before this element has decided it owns the gesture.
 */
const DRAG_SLOP = 4
/** Release velocity is measured over this window, not over the whole gesture. */
const VELOCITY_WINDOW = 120
/** Resistance divisor for a drag past a hard end — communicates "no further". */
const RUBBER_BAND = 3
/**
 * Two sheets is a filter sheet opening a sort sub-sheet. Three is a flow that
 * should have been a page: nothing below the top one is readable, and the back
 * stack stops being predictable.
 */
const MAX_STACK = 2

// The body region: the one direct child with no `slot` attribute. `<template>`,
// `<style>`, `<script>` and `<link>` are legitimate unslotted children that are
// never the body — they are `display: none`, so the CSS side needs no equivalent
// exclusion, but querySelector would happily return one.
const BODY_SELECTOR = ':scope > :not([slot]):not(template):not(style):not(script):not(link)'

// The shell's pane, by the same rule (see style/components/_mobile-shell.scss).
const PANE_SELECTOR = ':scope > :not([slot]):not(template):not(style):not(script):not(link)'

// A press starting on one of these is never a sheet drag. The design's own filter
// sheet (screen 1g) carries a range slider, and a vertical drag on a slider thumb
// must reach the slider. `[data-no-drag]` is the escape hatch for a consumer's own
// custom gesture surface.
const NO_DRAG_SELECTOR =
    'input,textarea,select,[contenteditable=""],[contenteditable="true"],[data-no-drag]'

// The width at which a sheet inside `tc-mobile-shell[desktop]`'s overlay layer
// renders as a centred dialog — the `up(lg)` block in
// style/components/_bottom-sheet.scss, mirrored here because the JS has to stop
// offering drag-to-dismiss in that mode (see _dialogMode). Keep the two in step.
const DESKTOP_DIALOG_MEDIA = '(min-width: 992px)'

const FOCUSABLE_SELECTOR =
    'a[href],area[href],button:not([disabled]),details>summary,[tabindex]:not([tabindex="-1"]),' +
    'input:not([disabled]),select:not([disabled]),textarea:not([disabled])'

/** `warm` is the design's cream wash. `dark` is for a dark canvas; `none` draws nothing. */
export type BottomSheetScrim = 'warm' | 'dark' | 'none'

/** Why the sheet closed. `action` covers both `hide()` and an external `open` removal. */
export type BottomSheetCloseReason = 'scrim' | 'drag' | 'escape' | 'action'

/** Which element the scroll lock landed on. Readable for diagnostics — see `lockTarget`. */
export type BottomSheetLockTarget = 'pane' | 'body' | 'none'

export interface BottomSheetCloseDetail {
    reason: BottomSheetCloseReason
}

export interface BottomSheetSnapDetail {
    index: number
    /** The snap's own percentage, so a listener does not have to re-parse `snap`. */
    snap: number
}

interface DragSample {
    t: number
    y: number
}

// THE ONE VALUE THAT MATTERS FOR A DEFAULT-TRUE ATTRIBUTE IS THE STRING 'false'.
//
// `dismissible`, `blur-behind` and `handle` all default to TRUE, so they are
// tri-state rather than presence-based: absent means the default and only
// `="false"` turns them off. That makes their SETTERS a trap under React, which
// writes a custom element's props as PROPERTIES when they exist as such — so JSX
// `dismissible="false"` arrives here as the STRING 'false', which is truthy, and a
// plain `if (v)` would silently mean the exact opposite of what was written.
// Measured: a sheet marked non-dismissible closed on Escape.
//
// `undefined`/`null` mean "omitted", i.e. the default, so they do NOT turn the
// attribute off — that is what makes the JSX idiom `handle={cond || undefined}`
// behave the way it reads.
function isOff(v: unknown): boolean {
    return v === false || v === 'false'
}

// ─── Module state: the stack ──────────────────────────────────────────────────
//
// Sheet-specific, and separate from the shared `overlayStack`: this one has to
// report DEPTH (which sheet is second) and cap the count, neither of which the
// shared registry models. Sheets push onto both — the shared one is what stops a
// tc-lightbox or tc-command-palette underneath from also reacting to Escape.

const sheetStack: BottomSheet[] = []
let stackWarned = false

function restack(): void {
    sheetStack.forEach((sheet, i) => sheet.setAttribute('data-sheet-depth', String(i)))
}

// ─── Module state: the scrim ──────────────────────────────────────────────────
//
// ONE element for the whole stack, refcounted. That is what makes "two sheets do
// not double-darken" true by construction rather than by arithmetic: there is only
// ever one wash to see through.

let scrimEl: HTMLElement | null = null
let scrimUsers = 0

function onScrimClick(): void {
    // The topmost sheet, and only if it allows dismissal. `click` rather than
    // `pointerdown`, so a drag that STARTED inside the sheet and happened to end
    // over the scrim does not dismiss: the click's target is then their common
    // ancestor, never the scrim.
    const top = sheetStack[sheetStack.length - 1]
    if (top && top.dismissible) void top.hide('scrim')
}

function scrimAcquire(sheet: BottomSheet): void {
    scrimUsers++
    if (!scrimEl) {
        scrimEl = document.createElement('div')
        scrimEl.className = 'tc-bottom-sheet-scrim'
        // Decoration. The sheet carries aria-modal, so AT does not need to be told
        // about the wash — and a hit target with no accessible name would be noise.
        scrimEl.setAttribute('aria-hidden', 'true')
        scrimEl.addEventListener('click', onScrimClick)
    }
    // MOUNTED AS THE SHEET'S SIBLING, deliberately, and not at document.body.
    //   Painting order between two elements is only well-defined inside one
    //   stacking context. tc-mobile-shell's overlay layer is `position:absolute;
    //   z-index:1`, i.e. a stacking context, so a scrim at document.body with
    //   z-index 1050 paints ABOVE a sheet that lives in that layer — the wash would
    //   cover the sheet and swallow every tap. Measured before this comment existed.
    //   As a sibling, the two are in the same context and 1050 < 1055 always holds.
    const target = sheet.parentElement ?? document.body
    if (scrimEl.parentElement !== target) target.appendChild(scrimEl)
    // The variant belongs to the BOTTOM-most sheet asking for one: it is the wash
    // that is actually against the page.
    const owner = sheetStack.find((s) => s.scrim !== 'none') ?? sheet
    scrimEl.setAttribute('data-variant', owner.scrim)
    reflow(scrimEl)
    scrimEl.setAttribute('data-shown', '')
}

function scrimRelease(): void {
    scrimUsers = Math.max(0, scrimUsers - 1)
    if (scrimUsers > 0 || !scrimEl) return
    const el = scrimEl
    el.removeAttribute('data-shown')
    // Removed only if nothing re-acquired it during the fade — open → close → open
    // inside 220ms is one impatient tap away.
    executeAfterTransition(el, () => {
        if (scrimUsers === 0) el.remove()
    })
}

// ─── Module state: the background (scroll lock + blur) ────────────────────────
//
// WHICH SCROLL LOCK RUNS, AND WHY THERE ARE TWO
//   Inside a tc-mobile-shell the document does not scroll at all — the shell is
//   `height:var(--tc-vh); overflow:hidden` with exactly one scrolling pane — so the
//   lock is a per-pane concern and `overflow:hidden` on the pane is the whole job.
//   That path preserves scrollTop for free.
//   Outside a shell the document scrolls, and on iOS `overflow:hidden` on <body> is
//   famously not enough. There the classic works: record window.scrollY, pin the
//   body with `position:fixed; top:-Ypx`, and scrollTo(0, Y) on release.
//   The pane path also needs the sheet to be OUTSIDE the pane. A sheet rendered
//   inside the pane cannot blur its own ancestor, and locking that ancestor is fine
//   but blurring it is not — so the two are decided together and reported through
//   `lockTarget`.

interface PaneLock {
    kind: 'pane'
    shell: HTMLElement
    pane: HTMLElement
    top: number
}

interface BodyLock {
    kind: 'body'
    scrollY: number
    position: string
    top: string
    left: string
    right: string
    width: string
    overflow: string
}

let lock: PaneLock | BodyLock | null = null
let lockUsers = 0

let blurredShell: HTMLElement | null = null
let blurUsers = 0

/** The shell whose pane can carry the lock/blur for this sheet, or null. */
function backgroundShell(sheet: BottomSheet): { shell: HTMLElement; pane: HTMLElement } | null {
    const shell = sheet.closest<HTMLElement>('tc-mobile-shell')
    if (!shell) return null
    const pane = shell.querySelector<HTMLElement>(PANE_SELECTOR)
    // A sheet rendered INSIDE the pane is not a candidate: `filter` on the pane
    // would blur the sheet along with the page and — worse — make the pane the
    // containing block for the sheet's own fixed positioning.
    if (!pane || pane.contains(sheet)) return null
    return { shell, pane }
}

function lockAcquire(sheet: BottomSheet): BottomSheetLockTarget {
    lockUsers++
    if (lockUsers > 1) return lock?.kind ?? 'none'
    const found = backgroundShell(sheet)
    if (found) {
        // An ATTRIBUTE on the shell rather than a class or an inline style on the
        // pane: the pane is the consumer's element and react-dom rewrites the whole
        // `className` string whenever that prop changes, so a class written here
        // would vanish on the next render. The matching rule is in
        // style/components/_bottom-sheet.scss at 0-2-1, which beats the shell's own
        // 0-1-1 pane rule whatever the source order.
        found.shell.setAttribute('data-tc-sheet-lock', '')
        lock = { kind: 'pane', shell: found.shell, pane: found.pane, top: found.pane.scrollTop }
        return 'pane'
    }
    const body = document.body
    const s = body.style
    lock = {
        kind: 'body',
        scrollY: window.scrollY,
        position: s.position,
        top: s.top,
        left: s.left,
        right: s.right,
        width: s.width,
        overflow: s.overflow,
    }
    s.position = 'fixed'
    s.top = `${-lock.scrollY}px`
    s.left = '0'
    s.right = '0'
    s.width = '100%'
    s.overflow = 'hidden'
    return 'body'
}

function lockRelease(): void {
    lockUsers = Math.max(0, lockUsers - 1)
    if (lockUsers > 0 || !lock) return
    const active = lock
    lock = null
    if (active.kind === 'pane') {
        active.shell.removeAttribute('data-tc-sheet-lock')
        // Written back rather than trusted. Every engine preserves scrollTop across
        // an overflow change, but this is the one assertion in the whole component
        // whose failure the user would see as "the app lost my place".
        active.pane.scrollTop = active.top
        // And written back ONCE MORE next frame, because on a platform with CLASSIC
        // scrollbars the overflow change resizes the pane by the scrollbar's width:
        // its content reflows, and the browser's scroll anchoring then nudges the
        // offset to keep the anchored element still. Measured at exactly +15px in
        // desktop Chromium — and at 0 on any phone, where scrollbars are overlays
        // and there is no reflow to anchor against. Cheaper and more predictable
        // than reserving a gutter on the shell's pane, which would change the
        // layout of every existing consumer of a published component.
        const { pane, top } = active
        requestAnimationFrame(() => {
            if (lock === null && pane.isConnected && pane.scrollTop !== top) pane.scrollTop = top
        })
        return
    }
    const s = document.body.style
    s.position = active.position
    s.top = active.top
    s.left = active.left
    s.right = active.right
    s.width = active.width
    s.overflow = active.overflow
    window.scrollTo(0, active.scrollY)
}

function blurAcquire(sheet: BottomSheet): void {
    const found = backgroundShell(sheet)
    if (!found) return
    blurUsers++
    if (blurUsers > 1) return
    blurredShell = found.shell
    found.shell.setAttribute('data-tc-sheet-blur', '')
}

function blurRelease(): void {
    if (blurUsers === 0) return
    blurUsers--
    if (blurUsers > 0) return
    blurredShell?.removeAttribute('data-tc-sheet-blur')
    blurredShell = null
}

// ─── Element ──────────────────────────────────────────────────────────────────

let idCounter = 0

export class BottomSheet extends HTMLElement {
    private _state: '' | 'entering' | 'open' | 'exiting' = ''
    private _idBase = `${TAG_NAME}-${++idCounter}`
    private _ownHeading: HTMLElement | null = null
    private _returnFocus: HTMLElement | null = null
    private _lockTarget: BottomSheetLockTarget = 'none'
    private _settled: (() => void) | null = null
    private _settlePromise: Promise<void> | null = null
    private _pendingReason: BottomSheetCloseReason | null = null
    /** True while this sheet holds the global open-state resources. See _acquireBackground. */
    private _holding = false

    /** Snap percentages, ascending. Empty means content-height (`snap="auto"`). */
    private _snaps: number[] = []
    private _snapIndex = 0

    /** Current translate offset in px, downward positive. The authoritative value. */
    private _y = 0
    private _pointerId = -1
    private _pending = false
    private _dragging = false
    private _fromBody = false
    private _bodyAtTop = true
    private _startY = 0
    private _startOffset = 0
    private _startIndex = 0
    private _samples: DragSample[] = []

    /** Called on every open/close, alongside `tc-sheet-open` / `tc-sheet-close`. */
    onOpenChange: ((open: boolean, reason?: BottomSheetCloseReason) => void) | null = null

    static get observedAttributes(): string[] {
        // `handle` and `scrim` are pure CSS state and are observed only so that
        // scripts/gen-react-types.mjs types them as JSX props — it reads this list.
        return [
            'open',
            'heading',
            'snap',
            'initial-snap',
            'dismissible',
            'scrim',
            'blur-behind',
            'handle',
        ]
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'dialog')
        // The sheet itself is the initial focus target (APG's advice for a dialog
        // with no obvious first field), so it has to be programmatically focusable.
        if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1')
        this._parseSnaps()
        this._syncHeading()
        this.addEventListener('pointerdown', this._onPointerDown)
        this.addEventListener('pointermove', this._onPointerMove)
        this.addEventListener('pointerup', this._onPointerUp)
        this.addEventListener('pointercancel', this._onPointerCancel)
        // Non-passive, and the ONLY reason it exists: `preventDefault()` on a
        // touchmove is the one way to stop the browser starting a native pan of the
        // body region once this element has claimed the gesture. Pointer events
        // cannot do it (preventDefault on pointermove does nothing to scrolling) and
        // `touch-action` alone cannot, because the body genuinely does need to pan
        // when it is not scrolled to the top. Physics stays on the pointer events.
        this.addEventListener('touchmove', this._onTouchMove, { passive: false })
        if (this.hasAttribute('open')) this._openNow()
    }

    disconnectedCallback(): void {
        this.removeEventListener('pointerdown', this._onPointerDown)
        this.removeEventListener('pointermove', this._onPointerMove)
        this.removeEventListener('pointerup', this._onPointerUp)
        this.removeEventListener('pointercancel', this._onPointerCancel)
        this.removeEventListener('touchmove', this._onTouchMove)
        // A framework can unmount an OPEN sheet without ever closing it (a route
        // change under a sheet, an error boundary). Everything the open state owns
        // globally has to come back here or the app is left with a locked pane, a
        // blurred page and a cream wash over content nobody can reach.
        if (this._state !== '') this._teardown()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (prev === next) return
        if (name === 'open') {
            if (!this.isConnected) return
            if (next === null) void this._closeNow('action')
            else this._openNow()
            return
        }
        if (name === 'heading') this._syncHeading()
        else if (name === 'snap' || name === 'initial-snap') this._parseSnaps()
    }

    // ── Public surface ───────────────────────────────────────────────────────

    get open(): boolean {
        return this.hasAttribute('open')
    }
    // NEVER `toggleAttribute(name, v)` here. React writes this as a PROPERTY (it is
    // one, so react-dom prefers it over the attribute), and a JSX `open={cond ||
    // undefined}` — the idiomatic way to omit a boolean attribute — assigns
    // `undefined`. `toggleAttribute`'s second argument is an optional boolean, so
    // `undefined` means "not supplied", i.e. TOGGLE: the sheet that had just removed
    // the attribute to close got it straight back and re-opened mid-exit. Measured
    // as a sheet that ignored Escape while its scrim faded out.
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get heading(): string {
        return this.getAttribute('heading') ?? ''
    }
    set heading(v: string) {
        if (v) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    get snap(): string {
        return this.getAttribute('snap') ?? 'auto'
    }
    set snap(v: string) {
        this.setAttribute('snap', v)
    }

    get initialSnap(): number {
        const n = Number(this.getAttribute('initial-snap'))
        return Number.isFinite(n) ? n : 0
    }
    set initialSnap(v: number) {
        this.setAttribute('initial-snap', String(v))
    }

    /** Default TRUE, so this reads `!== 'false'` rather than presence. */
    get dismissible(): boolean {
        return this.getAttribute('dismissible') !== 'false'
    }
    set dismissible(v: boolean) {
        // isOff, not `!v` — see its comment: React hands this the string 'false'.
        if (isOff(v)) this.setAttribute('dismissible', 'false')
        else this.removeAttribute('dismissible')
    }

    get scrim(): BottomSheetScrim {
        const v = this.getAttribute('scrim')
        return v === 'dark' || v === 'none' ? v : 'warm'
    }
    set scrim(v: BottomSheetScrim) {
        this.setAttribute('scrim', v)
    }

    /** Default TRUE. `false` is the escape hatch for a low-end device — see the SKILL entry. */
    get blurBehind(): boolean {
        return this.getAttribute('blur-behind') !== 'false'
    }
    set blurBehind(v: boolean) {
        // isOff, not `!v` — see its comment: React hands this the string 'false'.
        if (isOff(v)) this.setAttribute('blur-behind', 'false')
        else this.removeAttribute('blur-behind')
    }

    get handle(): boolean {
        return this.getAttribute('handle') !== 'false'
    }
    set handle(v: boolean) {
        // isOff, not `!v` — see its comment: React hands this the string 'false'.
        if (isOff(v)) this.setAttribute('handle', 'false')
        else this.removeAttribute('handle')
    }

    /** Index into the parsed `snap` list. Always 0 for `snap="auto"`. */
    get snapIndex(): number {
        return this._snapIndex
    }

    /**
     * Which element the scroll lock landed on while this sheet is open: `pane`
     * inside a tc-mobile-shell, `body` outside one, `none` when it is not open.
     * Exposed because "why is the page still scrolling" is otherwise unanswerable
     * from the outside.
     */
    get lockTarget(): BottomSheetLockTarget {
        return this._lockTarget
    }

    /** Resolves after the entry animation. */
    show(): Promise<void> {
        if (this._state === 'open') return Promise.resolve()
        this.setAttribute('open', '')
        // A disconnected element gets no attribute reaction, so nothing would ever
        // resolve the promise and an `await sheet.show()` would hang forever.
        // connectedCallback opens it when it lands.
        if (!this.isConnected) return Promise.resolve()
        return this._settle()
    }

    /** Resolves after the EXIT animation, so a caller can unmount safely. */
    hide(reason: BottomSheetCloseReason = 'action'): Promise<void> {
        if (this._state === '' || this._state === 'exiting') return Promise.resolve()
        // The attribute is removed first so an `open={x}` consumer and a direct
        // hide() call converge on the same path; _closeNow runs from the reaction.
        this._pendingReason = reason
        this.removeAttribute('open')
        return this._settle()
    }

    /** Move to a snap index. No-op for `snap="auto"`, which has one rest position. */
    snapTo(index: number): void {
        this._snapTo(index, true)
    }

    // ── Open / close ─────────────────────────────────────────────────────────

    // Everything global the open state owns, in one idempotent pair. Idempotent
    // because the two lifecycles overlap in practice: re-opening a sheet that is
    // still animating out must not acquire a second scroll lock, and an unmount
    // mid-exit must be able to release one that has already gone.
    private _acquireBackground(): void {
        if (this._holding) return
        this._holding = true
        sheetStack.push(this)
        overlayStack.push(this)
        restack()
        if (sheetStack.length > MAX_STACK && !stackWarned) {
            stackWarned = true
            console.warn(
                `[${TAG_NAME}] ${sheetStack.length} sheets open at once; this component is designed for at most ${MAX_STACK}. A third level is a flow that should be a page — nothing below the top sheet is readable and the back stack stops being predictable.`,
            )
        }
        this._lockTarget = lockAcquire(this)
        if (this.blurBehind) blurAcquire(this)
        if (this.scrim !== 'none') scrimAcquire(this)
        document.addEventListener('keydown', this._onKeydown)
    }

    private _releaseBackground(): void {
        if (!this._holding) return
        this._holding = false
        const i = sheetStack.lastIndexOf(this)
        if (i !== -1) sheetStack.splice(i, 1)
        overlayStack.pop(this)
        restack()
        document.removeEventListener('keydown', this._onKeydown)
        blurRelease()
        if (this.scrim !== 'none') scrimRelease()
        lockRelease()
        this._lockTarget = 'none'
    }

    private _openNow(): void {
        if (this._state === 'open' || this._state === 'entering') return
        this._state = 'entering'
        this._resolveSettled()

        this._parseSnaps()
        this._syncHeading()
        this.setAttribute('aria-modal', 'true')
        if (!this._holding) {
            const active = document.activeElement
            this._returnFocus = active instanceof HTMLElement ? active : null
        }
        this._acquireBackground()

        // The entry position comes from CSS (`--bs-bottom-sheet-y: 100%`), so it
        // needs no measurement and is correct before first layout. An inline value
        // from a previous drag would beat it, hence the removeProperty.
        this.style.removeProperty('--bs-bottom-sheet-y')
        this.setAttribute('data-sheet-state', 'entering')
        // Commits the entry position as the transition's start value. Without it the
        // two style changes coalesce into one recalc and the sheet appears instantly.
        reflow(this)

        this._state = 'open'
        this.setAttribute('data-sheet-state', 'open')
        this._snapIndex = this._clampIndex(this.initialSnap)
        this._applyOffset(this._restOffset(this._snapIndex))
        this._focusIn()

        this.dispatchEvent(new CustomEvent('tc-sheet-open', { bubbles: true, composed: true }))
        if (typeof this.onOpenChange === 'function') this.onOpenChange(true)
        if (this._snaps.length > 0) this._emitSnap()
        this._settleAfterTransition()
    }

    private async _closeNow(fallbackReason: BottomSheetCloseReason): Promise<void> {
        if (this._state === '' || this._state === 'exiting') return
        const reason = this._pendingReason ?? fallbackReason
        this._pendingReason = null
        this._state = 'exiting'
        this._resolveSettled()
        this._endDrag()
        this.removeAttribute('aria-modal')

        try {
            // Released at the START of the exit, not the end. Escape and a scrim tap
            // have to reach the sheet below the instant this one begins leaving; the
            // scrim's own fade has to run in step with the slide rather than after
            // it; and the page behind becomes scrollable again the moment the user
            // has dismissed, which is when they expect it.
            this._releaseBackground()

            this.style.removeProperty('--bs-bottom-sheet-y')
            this.setAttribute('data-sheet-state', 'exiting')
            this._restoreFocus()

            this.dispatchEvent(
                new CustomEvent<BottomSheetCloseDetail>('tc-sheet-close', {
                    detail: { reason },
                    bubbles: true,
                    composed: true,
                }),
            )
            if (typeof this.onOpenChange === 'function') this.onOpenChange(false, reason)

            await new Promise<void>((resolve) => executeAfterTransition(this, resolve))
        } finally {
            // FINALLY, not the happy path. A consumer's tc-sheet-close listener that
            // throws would otherwise leave the pane locked, the page blurred and a
            // cream wash over content nobody can reach — an app that looks frozen.
            // Task 30 opens and closes these hundreds of times, so the one path that
            // must never be skipped is this one. Both calls are idempotent.
            this._releaseBackground()
            // Guarded: a re-open mid-exit has already taken the state back, and
            // clearing it here would leave a visible sheet the CSS treats as closed.
            if (this._state === 'exiting') {
                this.removeAttribute('data-sheet-state')
                this.removeAttribute('data-sheet-depth')
                this._state = ''
                this._resolveSettled()
            }
        }
    }

    /** Everything the open state owns, dropped without animating. */
    private _teardown(): void {
        this._endDrag()
        this._releaseBackground()
        this._state = ''
        this._resolveSettled()
        this.removeAttribute('data-sheet-state')
        this.removeAttribute('data-sheet-depth')
        this.removeAttribute('aria-modal')
    }

    // ONE promise at a time, shared by show() and hide() and resolved by whichever
    // of the two finishes: a hide() during an entry must not wait on an animation
    // that was replaced, and two show() calls must not orphan the first caller.
    private _settle(): Promise<void> {
        if (!this._settlePromise) {
            this._settlePromise = new Promise<void>((resolve) => {
                this._settled = resolve
            })
        }
        return this._settlePromise
    }

    private _settleAfterTransition(): void {
        executeAfterTransition(this, () => this._resolveSettled())
    }

    private _resolveSettled(): void {
        const resolve = this._settled
        this._settled = null
        this._settlePromise = null
        resolve?.()
    }

    // ── Heading ──────────────────────────────────────────────────────────────

    // The `heading` attribute is a shorthand for the header slot, not a competitor:
    // a consumer-supplied [slot="header"] always wins, because the design's own
    // sheet header (screen 1g) is a row — title plus a terracotta text action — and
    // only the consumer can build that.
    private _syncHeading(): void {
        const provided = this.querySelector<HTMLElement>(
            ':scope > [slot="header"]:not([data-tc-sheet-heading])',
        )
        const text = this.heading
        if (provided || !text) {
            this._ownHeading?.remove()
            this._ownHeading = null
        } else {
            let own = this._ownHeading
            if (!own) {
                own = document.createElement('h2')
                own.className = 'tc-sheet-title'
                own.setAttribute('slot', 'header')
                own.setAttribute('data-tc-sheet-heading', '')
                own.id = `${this._idBase}-title`
                // PREPENDED, never inserted relative to a consumer's child. React
                // reconciles its own children against nodes it holds references to,
                // so an extra node in front of them is invisible to it — while
                // MOVING one of them is what breaks (see the file header).
                this.prepend(own)
                this._ownHeading = own
            }
            // textContent, not innerHTML: a heading is a string, and this way it can
            // never be a markup injection point.
            own.textContent = text
        }

        const title =
            this._ownHeading ??
            provided?.querySelector<HTMLElement>('.tc-sheet-title,h1,h2,h3,h4,h5,h6') ??
            (provided && provided.matches('h1,h2,h3,h4,h5,h6') ? provided : null)
        if (title) {
            if (!title.id) title.id = `${this._idBase}-title`
            this.setAttribute('aria-labelledby', title.id)
        } else if (this.getAttribute('aria-labelledby')?.startsWith(this._idBase)) {
            this.removeAttribute('aria-labelledby')
        }
    }

    // ── Snaps ────────────────────────────────────────────────────────────────

    // `auto` → []: one rest position, height from the content. `full` → [100].
    // A list → percentages of the sheet's containing block, ascending. The element's
    // HEIGHT is always the LARGEST snap and the smaller ones are reached by
    // translating it down — which is what keeps every snap change on the compositor
    // instead of relayouting the sheet's content.
    private _parseSnaps(): void {
        const raw = this.snap.trim().toLowerCase()
        let snaps: number[] = []
        if (raw === 'full') snaps = [100]
        else if (raw !== 'auto' && raw !== '') {
            snaps = raw
                .split(',')
                .map((p) => Number(p.trim()))
                .filter((n) => Number.isFinite(n) && n > 0)
                .map((n) => Math.min(100, Math.max(10, n)))
                .sort((a, b) => a - b)
            // De-duplicated, or two identical snaps would make a drag look stuck.
            snaps = snaps.filter((n, i) => i === 0 || n !== snaps[i - 1])
        }
        this._snaps = snaps
        if (snaps.length === 0) {
            this.removeAttribute('data-sheet-snapped')
            this.style.removeProperty('--bs-bottom-sheet-ratio')
        } else {
            this.setAttribute('data-sheet-snapped', '')
            this.style.setProperty('--bs-bottom-sheet-ratio', String(snaps[snaps.length - 1] / 100))
        }
        this._snapIndex = this._clampIndex(this._snapIndex)
        if (this._state === 'open' && !this._dragging) {
            this._applyOffset(this._restOffset(this._snapIndex))
        }
    }

    private _clampIndex(i: number): number {
        if (this._snaps.length === 0) return 0
        return Math.min(this._snaps.length - 1, Math.max(0, Math.trunc(i)))
    }

    /** Translate offset, in px, at which snap `i` rests. Larger index = higher sheet. */
    private _restOffset(i: number): number {
        if (this._snaps.length < 2) return 0
        const max = this._snaps[this._snaps.length - 1]
        return this.offsetHeight * (1 - this._snaps[i] / max)
    }

    private _nearestIndex(y: number): number {
        let best = 0
        let bestDelta = Infinity
        for (let i = 0; i < Math.max(1, this._snaps.length); i++) {
            const delta = Math.abs(this._restOffset(i) - y)
            if (delta < bestDelta) {
                bestDelta = delta
                best = i
            }
        }
        return best
    }

    private _snapTo(index: number, emit: boolean): void {
        const next = this._clampIndex(index)
        const changed = next !== this._snapIndex
        this._snapIndex = next
        this._applyOffset(this._restOffset(next))
        if (emit && changed) this._emitSnap()
    }

    private _emitSnap(): void {
        this.dispatchEvent(
            new CustomEvent<BottomSheetSnapDetail>('tc-sheet-snap', {
                detail: { index: this._snapIndex, snap: this._snaps[this._snapIndex] ?? 100 },
                bubbles: true,
                composed: true,
            }),
        )
    }

    // ── Drag ─────────────────────────────────────────────────────────────────

    // Written through a custom property rather than `transform` directly, so the
    // stylesheet keeps ownership of the whole transform (`translate3d(0, y, 0)`) and
    // the entry/exit positions can stay in CSS as `100%` — a percentage this side
    // would have to measure.
    private _applyOffset(y: number): void {
        this._y = y
        this.style.setProperty('--bs-bottom-sheet-y', `${Math.round(y * 100) / 100}px`)
    }

    private get _draggable(): boolean {
        // A single-snap sheet that cannot be dismissed has nowhere to go, so the
        // gesture is dead weight — and a surface that follows the finger and then
        // springs back every time reads as broken rather than as locked.
        return this.dismissible || this._snaps.length > 1
    }

    private _bodyEl(): HTMLElement | null {
        return this.querySelector<HTMLElement>(BODY_SELECTOR)
    }

    /**
     * True when the CSS is rendering this sheet as a centred desktop dialog —
     * the `up(lg)` block in style/components/_bottom-sheet.scss. The condition
     * restates that block's scope exactly: inside the overlay layer of a
     * `tc-mobile-shell[desktop]`, at the desktop width.
     */
    private _dialogMode(): boolean {
        if (typeof window.matchMedia !== 'function') return false
        if (!window.matchMedia(DESKTOP_DIALOG_MEDIA).matches) return false
        const overlay = this.closest('[slot="overlay"]')
        return !!overlay?.parentElement?.matches('tc-mobile-shell[desktop]')
    }

    private _onPointerDown = (e: PointerEvent): void => {
        if (this._state !== 'open' || this._dragging) return
        // Stale tracking from a press that ended off this element (so no pointerup
        // reached it). Cleared rather than bailed out on, or one such press would
        // leave the sheet undraggable for the rest of its life.
        if (this._pending) this._endDrag()
        if (!this._draggable) return
        // As a centred desktop dialog there is no drag: a mouse selecting text in
        // the body is indistinguishable from a drag-down, and a dialog that slides
        // away mid-selection is broken. Checked per press, not cached — the same
        // sheet crosses the boundary when the window is resized while it is open.
        if (this._dialogMode()) return
        if (e.pointerType === 'mouse' && e.button !== 0) return
        const target = e.target as Element | null
        if (target?.closest?.(NO_DRAG_SELECTOR)) return

        const body = this._bodyEl()
        this._fromBody = !!body && !!target && body.contains(target)
        this._bodyAtTop = !this._fromBody || !body || body.scrollTop <= 0
        this._pointerId = e.pointerId
        this._startY = e.clientY
        this._startOffset = this._y
        this._startIndex = this._snapIndex
        this._samples = [{ t: e.timeStamp, y: e.clientY }]
        this._pending = true
        // NO setPointerCapture HERE. Capturing at pointerdown retargets the whole
        // compatibility mouse sequence — mousedown, mouseup and therefore `click` —
        // onto the capture element, so every button, chip and link inside the sheet
        // stops working: the click lands on the sheet instead. Measured; it silently
        // broke a footer's „Примени" and a sub-sheet's trigger. Capture is taken only
        // once the press has become a real drag (see _onPointerMove), which is also
        // exactly when suppressing that click is what we want.
    }

    private _onPointerMove = (e: PointerEvent): void => {
        if (e.pointerId !== this._pointerId) return
        const dy = e.clientY - this._startY
        this._samples.push({ t: e.timeStamp, y: e.clientY })
        if (this._samples.length > 12) this._samples.shift()

        if (this._pending) {
            if (Math.abs(dy) < DRAG_SLOP) return
            // NESTED SCROLLING, the way a native sheet decides it: a gesture that
            // began in the body belongs to the BODY unless the body is already at
            // its top and the finger is heading down. Anything else — an upward
            // drag, or any drag from mid-scroll — is a scroll, and this element
            // must get out of the way for the rest of the gesture.
            if (this._fromBody && (dy < 0 || !this._bodyAtTop)) {
                this._endDrag()
                return
            }
            this._pending = false
            this._dragging = true
            this.setAttribute('data-sheet-dragging', '')
            // NOW it is a drag, so take the pointer: the rest of the gesture is
            // delivered here even if the finger leaves the sheet's box, and the
            // retargeted `click` lands on the host rather than activating whatever
            // control the drag happened to start on.
            if (typeof this.setPointerCapture === 'function') {
                try {
                    this.setPointerCapture(e.pointerId)
                } catch {
                    // The pointer ended between this move and the call. Nothing to do.
                }
            }
        }

        let y = this._startOffset + dy
        const floor = 0 // the largest snap: the sheet cannot go higher than its box
        const ceiling = this._restOffset(0)
        if (y < floor) y = floor + (y - floor) / RUBBER_BAND
        // Past the lowest snap is normally the dismiss gesture and must follow the
        // finger 1:1. When dismissal is off it is a hard end, so it resists instead.
        if (!this.dismissible && y > ceiling) y = ceiling + (y - ceiling) / RUBBER_BAND
        this._applyOffset(y)
    }

    private _onTouchMove = (e: TouchEvent): void => {
        if (!this._dragging && !this._pending) return
        if (this._dragging) {
            e.preventDefault()
            return
        }
        // Pre-emptive: the FIRST touchmove is the only cancelable one, so waiting for
        // the pointer stream to clear the slop can be one frame too late — the
        // browser has already committed to panning the body. Cancel exactly the
        // gesture this element is about to claim (downward, from a body at its top)
        // and nothing else, so an upward scroll is never stolen.
        const touch = e.touches[0]
        if (!touch) return
        if (this._fromBody && this._bodyAtTop && touch.clientY - this._startY > 0) {
            e.preventDefault()
        }
    }

    private _onPointerUp = (e: PointerEvent): void => {
        if (e.pointerId !== this._pointerId) return
        if (!this._dragging) {
            this._endDrag()
            return
        }
        const height = this.offsetHeight || 1
        const y = this._y
        const startIndex = this._startIndex
        const velocity = this._velocity()
        this._endDrag()

        if (velocity > FLICK_VELOCITY) {
            // A flick down steps one snap, and dismisses only from the lowest one.
            if (startIndex > 0) return this._snapTo(startIndex - 1, true)
            if (this.dismissible) {
                void this.hide('drag')
                return
            }
            return this._snapTo(0, true)
        }
        if (velocity < -FLICK_VELOCITY) {
            return this._snapTo(Math.min(startIndex + 1, this._snaps.length - 1), true)
        }
        if (this.dismissible && y - this._restOffset(0) > height * DISMISS_FRACTION) {
            void this.hide('drag')
            return
        }
        this._snapTo(this._nearestIndex(y), true)
    }

    private _onPointerCancel = (e: PointerEvent): void => {
        if (e.pointerId !== this._pointerId) return
        const wasDragging = this._dragging
        this._endDrag()
        // A cancel is the system taking the gesture away (a call, a system edge
        // swipe), never an intent to dismiss — so it springs back.
        if (wasDragging && this._state === 'open') this._snapTo(this._snapIndex, false)
    }

    private _endDrag(): void {
        if (this._pointerId !== -1 && this.hasPointerCapture?.(this._pointerId)) {
            this.releasePointerCapture(this._pointerId)
        }
        this._pointerId = -1
        this._pending = false
        this._dragging = false
        this._samples = []
        this.removeAttribute('data-sheet-dragging')
    }

    /** px/ms over the last VELOCITY_WINDOW of samples. Downward positive. */
    private _velocity(): number {
        const samples = this._samples
        if (samples.length < 2) return 0
        const last = samples[samples.length - 1]
        let first = samples[0]
        for (let i = samples.length - 1; i >= 0; i--) {
            first = samples[i]
            if (last.t - samples[i].t >= VELOCITY_WINDOW) break
        }
        const dt = last.t - first.t
        if (dt <= 0) return 0
        return (last.y - first.y) / dt
    }

    // ── Keyboard and focus ───────────────────────────────────────────────────

    private _onKeydown = (e: KeyboardEvent): void => {
        // Topmost in BOTH registries: the sheet stack settles which of two sheets
        // owns Escape, and the shared overlay stack settles a sheet against a
        // tc-lightbox or tc-command-palette opened on top of it.
        if (sheetStack[sheetStack.length - 1] !== this) return
        if (overlayStack.top() !== this) return

        if (e.key === 'Escape') {
            if (!this.dismissible) return
            e.preventDefault()
            // Stopped, so one Escape does not also close a dialog underneath.
            e.stopPropagation()
            void this.hide('escape')
            return
        }
        if (e.key !== 'Tab') return

        const focusable = this._focusable()
        if (focusable.length === 0) {
            e.preventDefault()
            this.focus()
            return
        }
        const active = document.activeElement
        if (!(active instanceof HTMLElement) || !this.contains(active)) {
            e.preventDefault()
            focusable[e.shiftKey ? focusable.length - 1 : 0].focus()
            return
        }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!e.shiftKey && active === last) {
            e.preventDefault()
            first.focus()
        } else if (e.shiftKey && active === first) {
            e.preventDefault()
            last.focus()
        }
    }

    private _focusable(): HTMLElement[] {
        return Array.from(this.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            (el) => !el.closest('[hidden]') && !el.closest('[inert]') && el.tabIndex >= 0,
        )
    }

    // BOTH FOCUS MOVES ARE DEFERRED BY A MICROTASK, and that is not defensive
    // padding — it is the difference between working and not.
    //   Opening a sheet from React means React sets the `open` prop, this element's
    //   setter writes the attribute, and the reaction runs INSIDE React's commit.
    //   react-dom brackets every commit with prepareForCommit / resetAfterCommit,
    //   which save the focused element beforehand and RESTORE it afterwards (its
    //   selection-restoration path, there so a re-render cannot drop the caret out
    //   of an input). A focus() called mid-commit is therefore undone a moment
    //   later: measured as focusin(sheet) → focusout(sheet) → focusin(trigger),
    //   leaving the sheet open with focus outside it and Tab starting in the page.
    //   A microtask runs after React's synchronous flush has finished, so the move
    //   is the last word — and it is not a frame, so nothing is visible.
    private _focusIn(): void {
        queueMicrotask(() => {
            if (this._state !== 'open') return
            // The HOST is the default target, not the first field: focusing an input
            // raises the software keyboard, and a filter sheet that opens with the
            // keyboard up has just hidden half of itself. `autofocus` is the
            // consumer saying they want that (a search sheet does).
            //
            // `data-autofocus` is listed FIRST and is the one React consumers can
            // use: react-dom does not render `autoFocus` as an attribute at all — it
            // calls `.focus()` itself at mount, which for a sheet means focusing
            // something inside a `display: none` subtree, silently doing nothing. A
            // `data-*` attribute is passed through verbatim, so it is the only form
            // that survives to be queried here.
            const wanted = this.querySelector<HTMLElement>('[data-autofocus],[autofocus]')
            if (wanted) {
                wanted.focus()
                if (this.contains(document.activeElement)) return
            }
            this.focus({ preventScroll: true })
        })
    }

    private _restoreFocus(): void {
        const target = this._returnFocus
        this._returnFocus = null
        if (!target) return
        queueMicrotask(() => {
            if (this._state === 'open' || !target.isConnected) return
            // Only when focus is still ours to move. If the user has already clicked
            // into the page behind, or React's restoration has put it somewhere
            // deliberate, yanking it back to the trigger is worse than leaving it.
            const active = document.activeElement
            if (active !== null && active !== document.body && !this.contains(active)) return
            target.focus({ preventScroll: true })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BottomSheet
    }
}

import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { msg } from './messages'

// tc-day-strip — a week at a glance: N equal columns of weekday-letter-over-coloured-
// cell, where the cell's fill encodes that day's STATE and the selection is a ring.
//
// Screen `1j` („Планер") of the JADI.mk phone design draws seven of them under the
// page rail. It is the navigation and the status display at once — it is how you see
// „Thursday is over target" without opening Thursday.
//
// FOUR TAB-LIKE ELEMENTS IN THIS LIBRARY NOW, and they are not interchangeable:
//   tc-tab-bar    desktop panel switcher; WRAPS to a second line.
//   tc-page-tabs  the phone page rail — never wraps, scrolls, keeps active in view.
//   tc-tab-dock   the fixed bottom dock — N equal columns of icon-over-label.
//   tc-day-strip  this one. Also N equal columns, but each column carries a STATE of
//                 its own, drawn as the cell's fill. A dock tab is either where you
//                 are or where you are not; a day is „planned", „over target",
//                 „today" or „empty" whether or not you are looking at it.
//
// SELECTION AND STATE ARE ORTHOGONAL, and conflating them is the one bug this
// element exists to prevent.
//   On the canvas the selected day HAPPENS to also be today, so a naive reading has
//   `today` mean „selected" and ships a strip where a selected Thursday is pixel-
//   identical to a Thursday that merely IS Thursday. So selection has its own two
//   signals, both independent of the state fill:
//     * the weekday letter goes 400 #9aa189 -> 700 terracotta (the canvas's own
//       marker — day 3's „С" is `700 10px #a4472f` while its neighbours are
//       `400 10px #9aa189`). The WEIGHT change survives greyscale and colour
//       blindness on its own;
//     * the cell takes a 2px ring — an addition, because the letter alone is 10px of
//       signal for a 30px target.
//   The ring is suppressed on `today` only: there the amber fill already dominates
//   the row, and the canvas draws day 3 (today AND selected) with no ring at all.
//   Everything still distinguishes the four combinations: selected+today is amber
//   with a bold terracotta letter, today alone is amber with a faint one.
//
// `partial` IS AN ADDITION, NOT A DESIGN VALUE. The canvas shows four states; a real
// week has a fifth — „some meals planned, not all". It reuses `planned`'s fill with a
// 1px outline in `planned`'s ink, so it reads as „planned but incomplete" rather than
// as a sixth colour nobody can name. See style/components/_day-strip.scss.
//
// COLOUR IS NEVER THE ONLY SIGNAL. `over` (red tint) against `planned` (green tint)
// is the confusable pair, and „over target" vs „planned" is the whole point of the
// strip — so every day's accessible name ENDS with its status in words, from the
// message catalog (`dayStateOver`, …) or from the item's own `stateLabel`. This is a
// requirement, not boilerplate: with the words removed a colour-blind user gets
// nothing at all from this element.
//
// WHY IT RENDERS ITS OWN CHILDREN AND NEVER RE-PARENTS SLOTTED ONES
//   The days come from the `days` property, so there is nothing of the consumer's to
//   move. The library's older slot-distributing components re-parent slotted children
//   into a rendered skeleton, which breaks under react-dom (it removes a child with
//   `parentInstance.removeChild(child)` against the parent it BELIEVES the child has).
//   See the header comments in src/MobileShell.ts and src/AppBar.ts.

const TAG_NAME = 'tc-day-strip'

export type DayStripState = 'empty' | 'planned' | 'partial' | 'today' | 'over'
const STATES: DayStripState[] = ['empty', 'planned', 'partial', 'today', 'over']

/** Message-catalog key per state — the words that keep colour from being the only signal. */
const STATE_MESSAGE = {
    empty: 'dayStateEmpty',
    planned: 'dayStatePlanned',
    partial: 'dayStatePartial',
    today: 'dayStateToday',
    over: 'dayStateOver',
} as const

export interface DayStripItem {
    id: string
    /**
     * The weekday letter above the cell — „П" „В" „С" „Ч" „П" „С" „Н". SUPPLIED BY
     * THE APP: which letters a week starts with is locale knowledge, and two of the
     * Macedonian seven are the same glyph.
     */
    short: string
    /** What the cell reads — „1" … „7", or a date number. Rendered `tabular-nums`. */
    label: string
    /** Defaults to `empty`. An unknown value falls back to `empty` rather than throwing. */
    state?: DayStripState
    /**
     * How the day is NAMED to a screen reader — „Среда 3 септември, 1 840 од 1 900
     * килокалории". Strongly recommended: without it the name falls back to
     * „<short> <label>", i.e. „С 3", which is two glyphs and no information. The
     * status word is appended to whatever this says; it is not part of it.
     */
    a11yLabel?: string
    /**
     * Overrides the catalog's word for this day's status. Set it to `''` to suppress
     * the word entirely — for an app that folds the status into `a11yLabel` itself
     * and would otherwise hear it twice.
     */
    stateLabel?: string
    /** A day outside the plan — present in the week, not selectable. */
    disabled?: boolean
}

/** Detail of `tc-day-strip-change`. */
export interface DayStripEventDetail {
    id: string
    state: DayStripState
}

function normaliseState(value: DayStripState | undefined): DayStripState {
    return value && STATES.includes(value) ? value : 'empty'
}

export class DayStrip extends HTMLElement {
    private _initialised = false
    private _days: DayStripItem[] = []

    /** Called when a day is activated. Alongside `tc-day-strip-change`. */
    onChange: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['active-id', 'columns']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Left alone when the consumer has spoken. Note the days keep
            // `role="tab"` either way — see the SKILL entry's accessibility section.
            if (!this.hasAttribute('role')) this.setAttribute('role', 'tablist')
            this._applyColumns()
            this._render()
            this._initialised = true
        }
        // Re-attached on every connect: a React move/remount disconnects then
        // reconnects without re-running the one-time init above. Re-adding the same
        // handler reference is a no-op, so repeating this is safe.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this._initialised || prev === next) return
        if (name === 'columns') {
            this._applyColumns()
            return
        }
        if (name === 'active-id') this._applyActiveState()
    }

    get days(): DayStripItem[] {
        return this._days
    }
    set days(v: DayStripItem[]) {
        this._days = Array.isArray(v) ? v : []
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
     * How many columns the grid lays out — 7 by default, which is a week.
     *
     * It is a COLUMN COUNT and not a day count, so it is also how a 14-day strip
     * becomes two rows of seven rather than fourteen 26px slivers. A 5-day work week
     * sets `columns="5"`; leaving it at 7 with five days would render five cells in
     * seven tracks, i.e. narrower cells and two empty columns.
     */
    get columns(): number {
        const raw = Number(this.getAttribute('columns'))
        return Number.isInteger(raw) && raw > 0 ? raw : 7
    }
    set columns(v: number) {
        if (Number.isInteger(v) && v > 0) this.setAttribute('columns', String(v))
        else this.removeAttribute('columns')
    }

    // ── Columns ──────────────────────────────────────────────────────────────

    // The default lives in the partial, not here, so an app can re-point every strip
    // at once. Only ever written as an integer this getter already validated, so
    // `repeat(var(--bs-day-strip-columns), 1fr)` cannot be made invalid-at-computed-
    // value-time — which would silently collapse the grid to one column.
    private _applyColumns(): void {
        if (this.hasAttribute('columns')) {
            this.style.setProperty('--bs-day-strip-columns', String(this.columns))
        } else {
            this.style.removeProperty('--bs-day-strip-columns')
        }
    }

    // ── Selection ────────────────────────────────────────────────────────────

    private _enabled(): DayStripItem[] {
        return this._days.filter((d) => !d.disabled)
    }

    // The day that holds the single tab stop. Roving tabindex: everything else is -1,
    // so Tab enters and leaves the strip once instead of stepping through seven.
    //
    // Falls back to the first enabled day when `active-id` names one this strip does
    // not have — which is not an edge case: the id is usually a date, and a remembered
    // date outlives the week it belonged to on every navigation to another week.
    private _tabbableId(): string {
        const activeId = this.activeId
        const active = this._days.find((d) => d.id === activeId)
        if (active && !active.disabled) return activeId
        return this._enabled()[0]?.id ?? activeId
    }

    private _select(id: string): void {
        const item = this._days.find((d) => d.id === id)
        if (!item || item.disabled) return
        // Days are a switcher over one pane, never links, so this element owns
        // `active-id` outright — there is no URL for it to disagree with.
        this.activeId = id
        this.dispatchEvent(
            new CustomEvent<DayStripEventDetail>('tc-day-strip-change', {
                bubbles: true,
                composed: true,
                cancelable: true,
                detail: { id, state: normaliseState(item.state) },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(id)
    }

    private _applyActiveState(): void {
        const activeId = this.activeId
        const tabbableId = this._tabbableId()
        this.querySelectorAll<HTMLElement>(':scope > [role="tab"]').forEach((el) => {
            const id = el.dataset.id ?? ''
            const isActive = id === activeId
            el.setAttribute('aria-selected', String(isActive))
            el.setAttribute('tabindex', id === tabbableId ? '0' : '-1')
            el.classList.toggle('tc-day-strip-day--selected', isActive)
        })
    }

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element | null
        if (!target?.closest) return
        const day = target.closest<HTMLElement>('[role="tab"]')
        if (!day || day.parentElement !== this) return
        if (day.getAttribute('aria-disabled') === 'true') return
        const id = day.dataset.id
        if (id == null) return
        this._select(id)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as Element | null
        const day = target?.closest?.<HTMLElement>('[role="tab"]')
        if (!day || day.parentElement !== this) return

        // Enter / Space activate THROUGH THE CLICK PATH, so `_onClick` stays the
        // single place that notifies. Both keys are cancelled here (suppressing the
        // native activation the <button> would perform) and replaced by one synthetic
        // click. Notifying here as well fires the event twice per press — the defect
        // tc-page-tabs shipped with and had to fix.
        if (e.key === 'Enter' || e.key === ' ') {
            if (day.dataset.id == null) return
            e.preventDefault()
            day.click()
            return
        }

        const enabled = this._enabled()
        if (enabled.length === 0) return
        let idx = enabled.findIndex((d) => d.id === (day.dataset.id ?? ''))
        if (idx === -1) idx = 0

        let next = -1
        if (e.key === 'ArrowRight') next = (idx + 1) % enabled.length
        else if (e.key === 'ArrowLeft') next = (idx - 1 + enabled.length) % enabled.length
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = enabled.length - 1
        if (next === -1) return

        e.preventDefault()
        const item = enabled[next]
        this.querySelector<HTMLElement>(
            `:scope > [role="tab"][data-id="${CSS.escape(item.id)}"]`,
        )?.focus()
        // Arrows ACTIVATE as they move: showing the day's meals is free (the pane is
        // already in the DOM), which is the case the ARIA tabs pattern prefers
        // automatic activation for. There are no link days to push history entries.
        this._select(item.id)
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private _render(): void {
        const activeId = this.activeId
        const tabbableId = this._tabbableId()

        patchHtml(
            this,
            this._days
                .map((item) => {
                    const state = normaliseState(item.state)
                    const isActive = item.id === activeId
                    const cls =
                        `tc-day-strip-day${isActive ? ' tc-day-strip-day--selected' : ''}` +
                        (item.disabled ? ' tc-day-strip-day--disabled' : '')
                    // THE STATUS IN WORDS. `stateLabel` may legitimately be `''`, which
                    // suppresses it — so the fallback is on `== null`, not on falsiness.
                    const word =
                        item.stateLabel == null ? msg(STATE_MESSAGE[state]) : item.stateLabel
                    const identity = item.a11yLabel || `${item.short} ${item.label}`.trim()
                    const spoken = word ? `${identity}, ${word}` : identity
                    const attrs =
                        ` role="tab" class="${cls}" data-id="${esc(item.id)}"` +
                        ` data-state="${state}"` +
                        ` aria-selected="${isActive}"` +
                        ` tabindex="${item.id === tabbableId ? '0' : '-1'}"` +
                        ` aria-label="${esc(spoken)}"` +
                        // The machine-readable half of „this is today", which no amount of
                        // fill colour can carry. `date` is the token for „the current date
                        // within a collection" and is exactly this case.
                        (state === 'today' ? ' aria-current="date"' : '')

                    // aria-hidden on both spans: their text is already in the day's name
                    // above, and read again a screen reader announces „С 3" after the
                    // sentence that said what С and 3 mean.
                    const inner =
                        `<span class="tc-day-strip-weekday" aria-hidden="true">${esc(item.short)}</span>` +
                        `<span class="tc-day-strip-cell" aria-hidden="true">${esc(item.label)}</span>`

                    if (item.disabled) {
                        // An inert <span> cannot be clicked or focused into, which is what
                        // „a day outside the plan" should be.
                        return `<span${attrs} aria-disabled="true">${inner}</span>`
                    }
                    return `<button type="button"${attrs}>${inner}</button>`
                })
                .join(''),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DayStrip
    }
}

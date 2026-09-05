import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

// tc-check-row — the tick-off list row: a drawn checkbox, a name, an optional hint
// and an optional right-aligned trailing figure, where THE WHOLE ROW is the target.
//
// Screen `1h` („Листа", the offline shopping list) of the JADI.mk phone design, and
// the same row again as `1j`'s meal "done" toggle and `1b`'s onboarding tick.
//
// THREE CHECKBOX-ISH ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-check       a FORM FIELD. 17px control in the shared `.form-control` lane,
//                  form-associated via ElementInternals, with help/error/required/
//                  indeterminate/validity. Use it in a form.
//   tc-checkbox-group  N tc-checks with one group label and one validation message.
//   tc-check-row   this one. A LIST ROW: no field furniture, a 24-30px drawn box,
//                  a two-line body, a trailing figure, and a 48px-floor hit box
//                  that covers the entire row rather than the control.
//
// WHY A REAL <input type="checkbox"> INSIDE A REAL <label>
//   Keyboard operation (Space), the `:checked` pseudo-class, form submission, and
//   the state a screen reader reports are all things the platform already does.
//   `role="checkbox"` would mean reimplementing every one of them, and the fourth
//   is the one that gets missed: the design conveys "bought" with a line-through,
//   and text-decoration is invisible to assistive tech. The state has to come from
//   the control.
//   The input is `.visually-hidden` (clipped, 1x1, still in the layout) and NOT
//   `display: none`, which would remove it from the tab order and from the form.
//
// WHY THE VISUAL STATE NEEDS NO JAVASCRIPT
//   Every checked style is a sibling selector off `.tc-check-row-input:checked`
//   (see style/components/_check-row.scss), so the box fills, the tick appears and
//   the label strikes through in the same frame the browser flips the control —
//   before any listener runs, and with nothing to wait for. That is the one hard
//   requirement of a shopping list used with no signal: ticking must never depend
//   on a round trip. The `checked` ATTRIBUTE is reflected for consumers to read and
//   write, but no styling reads it.
//   Consequence worth knowing: this element is UNCONTROLLED. A React consumer that
//   renders `checked={fromServer}` will see the box flip before the server agrees.
//   That is the intended behaviour — mirror the flip back into your own state, and
//   write `checked` again only if you need to REJECT it.
//
// WHY IT RENDERS ITS OWN TEXT INSTEAD OF SLOTTING IT
//   The label, hint and trailing figure are ATTRIBUTES. The library's older
//   slot-distributing components re-parent slotted children into a rendered
//   skeleton, which breaks under react-dom — it removes a child with
//   `parentInstance.removeChild(child)` against the parent it BELIEVES the child
//   has (see the header comments in src/MobileShell.ts and src/AppBar.ts). Owning
//   the text also means the structure is built ONCE: `1h`'s rows re-render on every
//   tick-off, and rebuilding the subtree would destroy the focused input every
//   time.
//   The one exception is `[slot="trailing"]`, for a right-hand control (an "edit"
//   button, a quantity stepper). It stays a child of the HOST, outside the
//   <label> — inside it, tapping it would toggle the checkbox — and is positioned
//   by CSS off its `slot` attribute. Nothing is moved, so nothing can go stale.

const TAG_NAME = 'tc-check-row'

export type CheckRowShape = 'square' | 'circle'
const SHAPES: CheckRowShape[] = ['square', 'circle']

export type CheckRowTone = 'accent' | 'success'
const TONES: CheckRowTone[] = ['accent', 'success']

export type CheckRowDivider = 'dashed' | 'solid' | 'none'
const DIVIDERS: CheckRowDivider[] = ['dashed', 'solid', 'none']

/** Detail of `tc-check-row-change`. */
export interface CheckRowChangeDetail {
    checked: boolean
    /** The input's `name`, or `null` — enough to key a queue of pending ticks. */
    name: string | null
    value: string
}

// The design's own tick path, on all three screens (1b, 1h, 1j). Deliberately NOT
// lucide's `check` (`M20 6 9 17l-5-5`): this one is steeper and its elbow sits
// lower, which is what makes it read at 12px inside a 22px circle.
const TICK_PATH = 'M4 12.5 9.5 18 20 6.5'

export class CheckRow extends HTMLElement {
    private _main: HTMLLabelElement | null = null
    private _built = false
    // Set while THIS element is writing the `checked` attribute from a native
    // change, so attributeChangedCallback does not write the input back and
    // re-enter. Rapid taps stay consistent because the input is the single source
    // of truth and the attribute only ever mirrors it.
    private _reflecting = false

    /** Called on every toggle. Alongside `tc-check-row-change`. */
    onChange: ((checked: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        // `no-dim`, `no-strike`, `shape`, `tone` and `divider` are pure CSS state
        // and are observed only so that scripts/gen-react-types.mjs types them as
        // JSX props — it reads this list.
        return [
            'checked',
            'disabled',
            'divider',
            'hint',
            'label',
            'name',
            'no-dim',
            'no-strike',
            'shape',
            'tone',
            'trailing',
            'value',
        ]
    }

    connectedCallback(): void {
        this._render()
        // Re-attached on every connect: a React move/remount disconnects then
        // reconnects without re-running any one-time init. Re-adding the same
        // handler reference is a no-op, so repeating this is safe.
        //
        // Listening on the HOST rather than on the input: `change` bubbles, and a
        // host listener survives the input being replaced. (It is not, today — the
        // structure is built once — but a listener that cannot go stale is free.)
        this.addEventListener('change', this._onChange)
    }

    disconnectedCallback(): void {
        this.removeEventListener('change', this._onChange)
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        if (name === 'checked') {
            if (this._reflecting) return
            const input = this.input
            if (input) input.checked = next !== null
            return
        }
        // The rest are CSS state, or text/form attributes patched below.
        if (name === 'divider' || name === 'shape' || name === 'tone') return
        if (name === 'no-dim' || name === 'no-strike') return
        this._render()
    }

    /** The real control. `null` before the first render. */
    get input(): HTMLInputElement | null {
        return this.querySelector<HTMLInputElement>(':scope > label > .tc-check-row-input')
    }

    /**
     * Reads the LIVE control state once rendered, so a tap is visible here in the
     * same turn it happened. Writing it sets the control and reflects the attribute.
     */
    get checked(): boolean {
        return this.input?.checked ?? this.hasAttribute('checked')
    }
    set checked(v: boolean) {
        const input = this.input
        if (input) input.checked = v
        this._reflect(v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        this.toggleAttribute('disabled', v)
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    /** The muted second line — „во фрижидер: 120 г". Absent ⇒ no second line at all. */
    get hint(): string | null {
        return this.getAttribute('hint')
    }
    set hint(v: string | null) {
        if (v != null) this.setAttribute('hint', v)
        else this.removeAttribute('hint')
    }

    /**
     * The right-aligned figure — „500 г". Rendered with `tabular-nums`, so a list
     * of amounts does not jitter as rows are ticked.
     *
     * For a right-hand CONTROL rather than a figure, slot it instead:
     * `<button slot="trailing">`. Slotted content sits outside the <label>, so
     * pressing it does not toggle the row.
     */
    get trailing(): string | null {
        return this.getAttribute('trailing')
    }
    set trailing(v: string | null) {
        if (v != null) this.setAttribute('trailing', v)
        else this.removeAttribute('trailing')
    }

    get shape(): CheckRowShape {
        const raw = this.getAttribute('shape') as CheckRowShape
        return SHAPES.includes(raw) ? raw : 'square'
    }
    set shape(v: CheckRowShape) {
        this.setAttribute('shape', SHAPES.includes(v) ? v : 'square')
    }

    get tone(): CheckRowTone {
        const raw = this.getAttribute('tone') as CheckRowTone
        return TONES.includes(raw) ? raw : 'accent'
    }
    set tone(v: CheckRowTone) {
        this.setAttribute('tone', TONES.includes(v) ? v : 'accent')
    }

    get divider(): CheckRowDivider {
        const raw = this.getAttribute('divider') as CheckRowDivider
        return DIVIDERS.includes(raw) ? raw : 'dashed'
    }
    set divider(v: CheckRowDivider) {
        this.setAttribute('divider', DIVIDERS.includes(v) ? v : 'dashed')
    }

    /**
     * Keep the label un-struck when checked.
     *
     * NEGATED because a boolean attribute cannot default to true: `strike="false"`
     * is still a present attribute, and HTML has no way to say "absent means on".
     * `1h` wants the strike, `1j`'s meal toggle does not.
     */
    get noStrike(): boolean {
        return this.hasAttribute('no-strike')
    }
    set noStrike(v: boolean) {
        this.toggleAttribute('no-strike', v)
    }

    /** Keep the row at full opacity when checked. Negated for the same reason as `no-strike`. */
    get noDim(): boolean {
        return this.hasAttribute('no-dim')
    }
    set noDim(v: boolean) {
        this.toggleAttribute('no-dim', v)
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    /** Submitted when checked. Defaults to the platform's `on`. */
    get value(): string {
        return this.getAttribute('value') ?? 'on'
    }
    set value(v: string) {
        setAttr(this, 'value', v)
    }

    /** Flip the row and notify, as a tap would. */
    toggle(): void {
        const input = this.input
        if (!input || input.disabled) return
        // Through click(), so the platform fires `change` and _onChange stays the
        // single place a toggle is reported. Assigning `.checked` fires nothing.
        input.click()
    }

    // ── Change ───────────────────────────────────────────────────────────────

    private _onChange = (e: Event): void => {
        const input = this.input
        if (!input || e.target !== input) return
        this._reflect(input.checked)
        const detail: CheckRowChangeDetail = {
            checked: input.checked,
            name: this.name,
            value: this.value,
        }
        // NOT cancelable. By the time this fires the control has already flipped and
        // the row has already repainted; a consumer that "cancelled" it would leave
        // the two disagreeing. Reject by writing `checked` back instead.
        this.dispatchEvent(
            new CustomEvent<CheckRowChangeDetail>('tc-check-row-change', {
                bubbles: true,
                composed: true,
                detail,
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(input.checked)
    }

    private _reflect(checked: boolean): void {
        this._reflecting = true
        this.toggleAttribute('checked', checked)
        this._reflecting = false
    }

    // ── Render ───────────────────────────────────────────────────────────────

    // TEXT IS PATCHED, STRUCTURE IS BUILT ONCE. Rewriting innerHTML on an
    // attribute change would replace the <input>, and with it the focus ring, the
    // `input` getter's target and any listener bound straight to the control.
    // That is not hypothetical here: `1h`'s app bar carries a live „N од 7 купено"
    // counter, so a row's siblings re-render on every single tick.
    private _render(): void {
        const main = this._ensureMain()
        if (!this._built || !main.firstChild) {
            main.innerHTML = this._skeleton()
            this._built = true
        }
        this._patch(main)
    }

    // No text interpolation: every string goes in through textContent /
    // setAttribute in _patch, which escapes for free. `esc` is used only for the
    // one attribute value written here.
    private _skeleton(): string {
        return (
            `<input type="checkbox" class="tc-check-row-input visually-hidden">` +
            `<span class="tc-check-row-box">` +
            `<svg class="tc-check-row-tick" viewBox="0 0 24 24" fill="none"` +
            ` stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"` +
            ` aria-hidden="true"><path d="${esc(TICK_PATH)}"/></svg>` +
            `</span>` +
            `<span class="tc-check-row-body">` +
            `<span class="tc-check-row-label"></span>` +
            `<span class="tc-check-row-hint"></span>` +
            `</span>` +
            `<span class="tc-check-row-trailing"></span>`
        )
    }

    private _patch(main: HTMLLabelElement): void {
        const write = (selector: string, text: string): void => {
            const el = main.querySelector(selector)
            if (!el) return
            // Compared before writing so an unchanged string never touches the DOM —
            // `textContent =` replaces the text node, which is enough to break a
            // selection or interrupt an in-progress screen-reader read.
            if (el.textContent !== text) el.textContent = text
            // An EMPTY hint or trailing collapses the slot entirely rather than
            // leaving a 2px margin and an empty line box behind.
            ;(el as HTMLElement).hidden = text === ''
        }
        write('.tc-check-row-label', this.label)
        write('.tc-check-row-hint', this.hint ?? '')
        write('.tc-check-row-trailing', this.trailing ?? '')

        const input = main.querySelector<HTMLInputElement>('.tc-check-row-input')
        if (!input) return
        input.disabled = this.disabled
        const name = this.name
        if (name != null) input.name = name
        else input.removeAttribute('name')
        input.value = this.value
        // The authored `checked` attribute is the initial state; after that the
        // control owns it and this only runs for attributes the consumer wrote.
        if (!this._reflecting) input.checked = this.hasAttribute('checked')
    }

    // Created once and reused. A <label> and not a click handler on the host: label
    // activation is what makes the whole padded row toggle the control, on every
    // input modality, with no JS and no synthetic click to double-fire.
    private _ensureMain(): HTMLLabelElement {
        let main = this._main
        if (main?.parentNode === this) return main
        main = this.querySelector<HTMLLabelElement>(':scope > label.tc-check-row-main')
        if (!main) {
            main = document.createElement('label')
            main.className = 'tc-check-row-main tc-no-tap-highlight'
            // FIRST, so the control precedes a slotted trailing button in tab order.
            // Visual order is CSS's job; sequential focus order is the DOM's.
            this.insertBefore(main, this.firstChild)
            // A rebuilt skeleton belongs to a rebuilt label.
            this._built = false
        }
        this._main = main
        return main
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CheckRow
    }
}

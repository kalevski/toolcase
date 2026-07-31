import { lucideByName } from './internal/lucide'

// tc-add-slot — the dashed „there could be something here" tap target: an icon and a
// label centred inside a dashed rounded frame, sized like the card it would become.
//
// Screen `1j` („Планер") draws one for ужина, the meal the day has no entries for. The
// shape recurs well beyond the planner — adding a week to a plan, adding an ingredient
// line in the recipe wizard, adding a pantry item — which is why it is an element and
// not four copies of a div.
//
// IT IS NOT tc-empty-state, AND THE DIFFERENCE IS STRUCTURAL
//   tc-empty-state fills a region that has nothing in it: a glyph, a heading, a
//   sentence and an optional action, centred in the space where a list would be. This
//   fills ONE MISSING ITEM in a list that already has others — it is the same size and
//   shape as its filled siblings, and the dashed border is the whole message. One is
//   „nothing here yet", the other is „one more could go here".
//
// IT IS A REAL BUTTON, not a div with a click handler. Keyboard-activatable, in the
// tab order, with a focus ring, `disabled` honoured by the platform rather than
// simulated — all of which a dashed div silently is not, and all of which matter for
// an affordance whose only visual cue is a border style.
//
// THE 2px IT DOES NOT MATCH THE CANVAS BY
//   `1j` draws it at `padding:12px` around a 16px icon, i.e. 42px tall. A tap target
//   floors at `--tc-min-touch-target` (44px), so this renders 44px. That is the one
//   deliberate departure from the canvas in this element; the alternative is shipping
//   a control two pixels under the guideline it exists to satisfy.
//
// WHY IT RENDERS ITS OWN CHILDREN AND NEVER RE-PARENTS SLOTTED ONES
//   The icon and label come from attributes, so there is nothing of the consumer's to
//   move. The library's older slot-distributing components re-parent slotted children
//   into a rendered skeleton, which breaks under react-dom. See the header comments in
//   src/MobileShell.ts and src/AppBar.ts.

const TAG_NAME = 'tc-add-slot'

export type AddSlotTone = 'muted' | 'accent'
const TONES: AddSlotTone[] = ['muted', 'accent']

export class AddSlot extends HTMLElement {
    // Which shape the button's contents were built for — the icon name. A label change
    // patches that DOM in place; only a change of icon rebuilds it. See _render.
    private _builtFor = ''

    static get observedAttributes(): string[] {
        return ['disabled', 'icon', 'label', 'tone']
    }

    connectedCallback(): void {
        this._render()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        if (name === 'tone') return // pure CSS state, observed only so the React typings carry it
        this._render()
    }

    /**
     * A lucide icon name (kebab or Pascal). Drawn at 16px, stroke 2. Defaults to
     * `plus`, which is what „add one of these" looks like on every screen that has
     * one; an unknown name renders no glyph rather than a broken box.
     */
    get icon(): string {
        return this.getAttribute('icon') ?? 'plus'
    }
    set icon(v: string) {
        if (v) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    /**
     * What would go here — „Ужина", „Состојка", „Нова недела". REQUIRED: it is the
     * button's whole accessible name as well as its visible text, and a dashed box
     * with a bare plus in it names nothing.
     */
    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        if (v) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    /**
     * `muted` (the design's own, and the default) reads as a placeholder among filled
     * siblings. `accent` reads as an invitation — right when the slot IS the section's
     * primary action because the section is otherwise empty.
     */
    get tone(): AddSlotTone {
        const raw = this.getAttribute('tone') as AddSlotTone
        return TONES.includes(raw) ? raw : 'muted'
    }
    set tone(v: AddSlotTone) {
        this.setAttribute('tone', TONES.includes(v) ? v : 'muted')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        this.toggleAttribute('disabled', v)
    }

    /** The `<button>`. Listen for `click` on it or on the host — it bubbles. */
    get button(): HTMLButtonElement | null {
        return this.querySelector<HTMLButtonElement>(':scope > .tc-add-slot-button')
    }

    // ── Render ───────────────────────────────────────────────────────────────

    // TEXT IS PATCHED, STRUCTURE IS REBUILT — and only when the structure changed, the
    // same rule tc-fab and tc-app-bar follow. Rewriting the button on every `label`
    // write would destroy the focused element mid-press and leave the public `button`
    // getter stale.
    private _render(): void {
        const button = this.button
        // `!button` covers the other way the DOM can go missing: a React move/remount
        // hands back a host whose children were replaced wholesale.
        if (!button || this.icon !== this._builtFor) {
            this.innerHTML =
                `<button type="button" class="tc-add-slot-button tc-no-tap-highlight">` +
                lucideByName(this.icon, 'tc-add-slot-glyph') +
                `<span class="tc-add-slot-label"></span>` +
                `</button>`
            this._builtFor = this.icon
        }
        this._patch()
    }

    private _patch(): void {
        const button = this.button
        if (!button) return
        const text = button.querySelector('.tc-add-slot-label')
        // Compared before writing so an unchanged string never touches the DOM —
        // `textContent =` replaces the text node, which is enough to interrupt an
        // in-progress screen-reader read.
        if (text && text.textContent !== this.label) text.textContent = this.label
        // The visible text IS the accessible name, so no aria-label: with one, voice
        // control („tap Ужина") matches the override rather than what the user can
        // read, and WCAG 2.5.3 Label in Name is at risk.
        //
        // `disabled` is forwarded to the real button rather than simulated with
        // pointer-events, so the platform takes it out of the tab order too.
        button.disabled = this.disabled
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AddSlot
    }
}

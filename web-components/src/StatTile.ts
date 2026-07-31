// tc-stat-tile — one number, its label, and nothing else: the atom of every
// numeric display in the JADI.mk phone design.
//
//   1k  three bordered tiles      4.8 / 37 оцени · 62 / соработки · 4 ч / одговара за
//   1i  the day's kcal target     1 900 + „ккал / ден", at 38px
//   1i  three macro tiles on a well, in per-macro hues   (via tc-macro-grid)
//   1d  the 4-up per-serving row, un-boxed               (via tc-macro-grid)
//
// FOUR NUMBER-TILE ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-metric-tile   a DASHBOARD KPI: icon-led, `unit` inside the figure, a hint
//                    slot. Distributes slotted children by re-parenting them into
//                    a rendered skeleton and rewrites its whole subtree on every
//                    attribute write — see the hazard note below.
//   tc-stat-card     a KPI CARD: title, icon, delta chip with a trend arrow, a
//                    footer. A card, not a tile — it is the whole panel.
//   tc-stat-row      a LABEL/VALUE ROW, horizontal, with a trend arrow.
//   tc-stat-tile     this one. A tile with NO icon, NO delta, NO card furniture:
//                    a figure over a label, sized by the phone scale, tabular by
//                    construction, and cheap enough to put four in a 390px row.
//
// WHY IT RENDERS ITS OWN TEXT AND PATCHES IT IN PLACE
//   `1d`'s four numbers are driven by the serving scaler — they change on every tap
//   of the -/+ stepper. Rewriting `innerHTML` on each write (which is what
//   tc-metric-tile does) throws away and rebuilds four text nodes per tap, which
//   interrupts an in-progress screen-reader read and drops any selection. So the
//   structure is built ONCE and every subsequent write is a `textContent` compare.
//   The one exception is `[slot="trailing"]`, which stays a child of the HOST and is
//   positioned by CSS off its `slot` attribute. Nothing is re-parented, so nothing
//   can go stale under react-dom — which removes a child with
//   `parentInstance.removeChild(child)` against the parent it BELIEVES the child has
//   (see the header comments in src/MobileShell.ts and src/AppBar.ts).
//
// TABULAR FIGURES ARE NOT OPTIONAL HERE
//   Every number in this design carries `font-variant-numeric: tabular-nums`, and
//   the reason is mechanical: the `--m-font-*` tokens are `font` SHORTHANDS, and the
//   shorthand resets font-variant-numeric — so the partial declares it AFTER the
//   font, and a consumer who re-points `--bs-stat-tile-value-font` keeps it. Without
//   it a proportional „1" is narrower than a „9" and 1d's four columns twitch on
//   every serving change.

const TAG_NAME = 'tc-stat-tile'

/** `card` = 1k's bordered tile · `well` = 1i's tinted inner tile · `bare` = 1d's un-boxed cell. */
export type StatTileVariant = 'card' | 'well' | 'bare'
const VARIANTS: StatTileVariant[] = ['card', 'well', 'bare']

export type StatTileTone = 'ink' | 'accent' | 'lead' | 'success' | 'warning' | 'danger' | 'info'
const TONES: StatTileTone[] = ['ink', 'accent', 'lead', 'success', 'warning', 'danger', 'info']

/** `sm` 16px (1i macros) · `md` 20px (1d, 1k) · `lg` 38px (1i's daily target). */
export type StatTileSize = 'sm' | 'md' | 'lg'
const SIZES: StatTileSize[] = ['sm', 'md', 'lg']

export type StatTileAlign = 'center' | 'start'
const ALIGNS: StatTileAlign[] = ['center', 'start']

export class StatTile extends HTMLElement {
    private _main: HTMLElement | null = null
    private _built = false

    static get observedAttributes(): string[] {
        // `align`, `size`, `tone` and `variant` are pure CSS state and are observed
        // only so that scripts/gen-react-types.mjs types them as JSX props — it reads
        // this list.
        return [
            'align',
            'color',
            'hint',
            'label',
            'size',
            'spoken',
            'tone',
            'unit',
            'value',
            'variant',
        ]
    }

    connectedCallback(): void {
        this._render()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        if (name === 'align' || name === 'size' || name === 'tone' || name === 'variant') return
        this._render()
    }

    /** The figure itself — „1 900", „4.8", „128 г". Written as text, never parsed. */
    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string | null) {
        if (v != null) this.setAttribute('value', String(v))
        else this.removeAttribute('value')
    }

    /**
     * A unit set BESIDE the figure on its baseline — `1i`'s „ккал / ден".
     *
     * The design only does this at `size="lg"`. At the smaller sizes the unit is
     * either part of the value („128 г") or it IS the label („ккал"), because a
     * second inline run beside a 16px figure costs more width than a 60px grid cell
     * has. Absent ⇒ no unit run at all.
     */
    get unit(): string | null {
        return this.getAttribute('unit')
    }
    set unit(v: string | null) {
        if (v != null) this.setAttribute('unit', v)
        else this.removeAttribute('unit')
    }

    /** The muted caption under the figure — „37 оцени", „белковини". */
    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    /** A third line under the label — the admin overview's „+8 во последните 30 дена". */
    get hint(): string | null {
        return this.getAttribute('hint')
    }
    set hint(v: string | null) {
        if (v != null) this.setAttribute('hint', v)
        else this.removeAttribute('hint')
    }

    get tone(): StatTileTone {
        const raw = this.getAttribute('tone') as StatTileTone
        return TONES.includes(raw) ? raw : 'ink'
    }
    set tone(v: StatTileTone) {
        this.setAttribute('tone', TONES.includes(v) ? v : 'ink')
    }

    /**
     * An arbitrary CSS colour for the figure, for a hue that is DATA rather than a
     * tone: `1i`'s per-macro pigments (белковини `#4e6b3c`, масти `#8a6d2f`,
     * јаглехидрати `#3c5d6b`) mean something in this product and belong to the app,
     * not to the theme. Beats `tone`.
     *
     * Applied to the figure's own inline `style.color` and NOT to a custom property
     * on the host: React owns the host's `style` attribute whenever a consumer passes
     * a `style` prop, and would silently drop a property written there.
     */
    get color(): string | null {
        return this.getAttribute('color')
    }
    set color(v: string | null) {
        if (v != null) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get variant(): StatTileVariant {
        const raw = this.getAttribute('variant') as StatTileVariant
        return VARIANTS.includes(raw) ? raw : 'card'
    }
    set variant(v: StatTileVariant) {
        this.setAttribute('variant', VARIANTS.includes(v) ? v : 'card')
    }

    get size(): StatTileSize {
        const raw = this.getAttribute('size') as StatTileSize
        return SIZES.includes(raw) ? raw : 'md'
    }
    set size(v: StatTileSize) {
        this.setAttribute('size', SIZES.includes(v) ? v : 'md')
    }

    get align(): StatTileAlign {
        const raw = this.getAttribute('align') as StatTileAlign
        return ALIGNS.includes(raw) ? raw : 'center'
    }
    set align(v: StatTileAlign) {
        this.setAttribute('align', ALIGNS.includes(v) ? v : 'center')
    }

    /**
     * The tile's accessible name, SPOKEN — „1 900 килокалории на ден" for a tile
     * that reads „1 900 · ккал / ден".
     *
     * Present ⇒ the tile becomes one `role="img"` node carrying this string, so a
     * screen reader announces the fact instead of the glyphs. Absent ⇒ no ARIA at
     * all and the text is read as text, which is right for a figure whose label is
     * already a word.
     *
     * It exists because this design's units are ABBREVIATIONS — „ккал", „г", „мг",
     * „ч" — and every screen reader mangles them. Only the app knows the spoken
     * Macedonian form, so the library cannot derive this.
     */
    get spoken(): string | null {
        return this.getAttribute('spoken')
    }
    set spoken(v: string | null) {
        if (v != null) this.setAttribute('spoken', v)
        else this.removeAttribute('spoken')
    }

    // ── Render ───────────────────────────────────────────────────────────────

    // TEXT IS PATCHED, STRUCTURE IS BUILT ONCE — see the header comment. `1d`'s four
    // tiles re-render on every tap of the serving stepper.
    private _render(): void {
        const main = this._ensureMain()
        if (!this._built || !main.firstChild) {
            main.innerHTML = this._skeleton()
            this._built = true
        }
        this._patch(main)
    }

    // No text interpolation anywhere: every string goes in through textContent /
    // setAttribute in _patch, which escapes for free.
    private _skeleton(): string {
        return (
            `<span class="tc-stat-tile-figure">` +
            `<span class="tc-stat-tile-value"></span>` +
            `<span class="tc-stat-tile-unit"></span>` +
            `</span>` +
            `<span class="tc-stat-tile-label"></span>` +
            `<span class="tc-stat-tile-hint"></span>`
        )
    }

    private _patch(main: HTMLElement): void {
        const write = (selector: string, text: string, collapse = true): void => {
            const el = main.querySelector<HTMLElement>(selector)
            if (!el) return
            // Compared before writing so an unchanged string never touches the DOM —
            // `textContent =` replaces the text node, which is enough to interrupt an
            // in-progress screen-reader read or drop a selection.
            if (el.textContent !== text) el.textContent = text
            // An empty unit / label / hint collapses entirely rather than leaving an
            // empty line box and its margin behind.
            if (collapse) el.hidden = text === ''
        }
        // The figure never collapses: a tile with no value is a rendering fault, and
        // hiding it would silently shrink the grid cell it sits in.
        write('.tc-stat-tile-value', this.value, false)
        write('.tc-stat-tile-unit', this.unit ?? '')
        write('.tc-stat-tile-label', this.label)
        write('.tc-stat-tile-hint', this.hint ?? '')

        const value = main.querySelector<HTMLElement>('.tc-stat-tile-value')
        if (value) value.style.color = this.color ?? ''

        // `role="img"` makes the tile a LEAF in the accessibility tree, so the figure
        // and label inside it are not announced a second time — no aria-hidden needed
        // on the children, and none is written, because a hidden subtree would also
        // hide them from a consumer that later removes `spoken`.
        const spoken = this.spoken
        if (spoken) {
            main.setAttribute('role', 'img')
            main.setAttribute('aria-label', spoken)
        } else {
            main.removeAttribute('role')
            main.removeAttribute('aria-label')
        }
    }

    // Created once and reused, so re-rendering the text never touches a consumer's
    // slotted trailing content. Inserted FIRST so the figure precedes a slotted
    // control in tab order — visual order is CSS's job, sequential focus order is
    // the DOM's.
    private _ensureMain(): HTMLElement {
        let main = this._main
        if (main?.parentNode === this) return main
        main = this.querySelector<HTMLElement>(':scope > .tc-stat-tile-main')
        if (!main) {
            main = document.createElement('div')
            main.className = 'tc-stat-tile-main'
            this.insertBefore(main, this.firstChild)
            // A rebuilt main belongs to a rebuilt skeleton.
            this._built = false
        }
        this._main = main
        return main
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StatTile
    }
}

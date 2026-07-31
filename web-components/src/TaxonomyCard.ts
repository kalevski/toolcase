// tc-taxonomy-card — the content card whose whole visual identity comes from ONE
// accent hue: a 3px rule of it across the top, a 3%-tint of it as the surface, an
// eyebrow and a floated metric figure in it, a serif title, and slotted rows under.
//
// The most repeated surface in the JADI.mk phone design:
//   1b  „Рецепт на неделата" — one card, tighter padding, a 19px title, no drop shadow
//   1c  the cookbook list — three cards, each in its category's hue, with a chip row
//   1f  the community feed — two cards with a `social` footer (counters + „Додади")
//   1g  three of them blurred behind the filter sheet, as flat skeletons
//
// THE HUE IS THE CONSUMER'S, NOT THE THEME'S.
//   Which colour „Салата" is (#4e6b3c) is a fact about this product's taxonomy, so it
//   comes in through `accent` / --bs-taxonomy-card-accent and the library never learns
//   about recipe categories. Same call tc-stat-tile's `color` makes.
//
// WHY THE METRIC BOX FLOATS, AND WHY THAT IS NOT LEGACY CSS
//   `float: right` + a `clear`ed row under it is the design's own technique and it is
//   the right one at 390px: a floated box shortens only the LINE BOXES beside it, so a
//   long Cyrillic title („Американски палачинки со нутела и вишни") wraps AROUND the
//   kcal figure and then runs full width underneath. The obvious modernisation — a
//   flex row of [text | kcal] — squeezes that title into a 270px column for its whole
//   height and costs a line. Do not "fix" it.
//
// THE NESTED-INTERACTIVE PROBLEM, AND WHICH SOLUTION SHIPPED
//   `1f`'s card is tappable AND carries a „Додади" button. A <button> inside a
//   <button> is invalid HTML and behaves unpredictably, so the card is NOT a button:
//
//     * the ACTIVATION REGION is the title — a real <a href> (or a <button> without
//       one) wrapping the heading text, so it is one tab stop with one accessible
//       name, Enter/Space work for free, and a long-press on a link gives the OS
//       context menu (which is why the partial sets `-webkit-tap-highlight-color`
//       but NOT `-webkit-touch-callout: none`, and why .tc-no-tap-highlight — which
//       sets both — is deliberately not used here);
//     * its ::after is STRETCHED over the host's padding box, so the whole card is
//       the hit target;
//     * slotted CONTROLS (`:is(a, button, input, …)` inside any slotted region) are
//       raised above that overlay by the partial, so a tap on „Додади" hits the
//       button and never the card. The host is `isolation: isolate` so those
//       z-indexes stay local to the card.
//
//   The alternative — an activation region that covers only the text block — was
//   rejected because it makes the chip row and the whole right-hand column of the
//   card dead to a thumb, which is most of a 362x142 target.
//
// WHY IT RENDERS ITS OWN TEXT AND RE-PARENTS NOTHING
//   `eyebrow`/`heading`/`subheading`/`description`/`metric-*` are attributes, built
//   ONCE into `.tc-taxonomy-card-main` and afterwards patched with a `textContent`
//   compare — a feed re-renders these on every filter change, and rewriting the
//   subtree would destroy the focused link each time. The four slots stay children of
//   the HOST and are placed by CSS off their `slot` attribute, because the library's
//   older slot-distributing components re-parent slotted children into a rendered
//   skeleton and that throws NotFoundError under react-dom, which removes a child
//   with `parentInstance.removeChild(child)` against the parent it BELIEVES the child
//   has. See the header comments in src/MobileShell.ts and src/AppBar.ts.
//
// `static` IS THE ATTRIBUTE; `interactive` IS THE PROPERTY.
//   Interactive is the DEFAULT (6 of the design's 9 cards are tappable), and an
//   HTML boolean attribute cannot express "true unless you say otherwise" — presence
//   is the only signal it has. So the opt-out is the presence attribute, named after
//   tc-chip/tc-tag's existing `static`, and the positive sense stays a JS property.
//   This also keeps the generated React typings honest: scripts/gen-react-types.mjs
//   types an attribute as `boolean` only when its getter returns `hasAttribute`.

const TAG_NAME = 'tc-taxonomy-card'

/** Detail of `tc-taxonomy-card-activate`. */
export interface TaxonomyCardActivateDetail {
    /** The card's `href`, or `null` when it activates as a button — a router needs the target. */
    href: string | null
}

export class TaxonomyCard extends HTMLElement {
    private _main: HTMLElement | null = null
    // Which shape `_main`'s contents were built for. Text changes patch that DOM in
    // place; only a change of shape (link vs button vs static, heading level)
    // rebuilds it. See _render.
    private _builtFor = ''

    /** Called when the card is activated. Alongside `tc-taxonomy-card-activate`. */
    onActivate: ((href: string | null) => void) | null = null

    static get observedAttributes(): string[] {
        // `clamp` and `static` are (nearly) pure CSS state and are observed so that
        // scripts/gen-react-types.mjs types them as JSX props — it reads this list.
        return [
            'accent',
            'clamp',
            'description',
            'eyebrow',
            'heading',
            'heading-level',
            'href',
            'metric-spoken',
            'metric-unit',
            'metric-value',
            'spoken',
            'static',
            'subheading',
        ]
    }

    connectedCallback(): void {
        this._render()
        // Re-attached on every connect: a React move/remount disconnects then
        // reconnects without re-running any one-time init. Re-adding the same
        // handler reference is a no-op, so repeating this is safe.
        this.addEventListener('click', this._onClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        if (name === 'clamp') return // pure CSS state, read by the partial off the host
        this._render()
    }

    /**
     * The card's hue — a hex or any CSS colour. Sets `--bs-taxonomy-card-accent`,
     * which drives the top rule, the surface tint, the eyebrow, the metric figure and
     * the metric border.
     *
     * Written onto the HOST's `style` (as tc-basic-card's `color` is), not onto a
     * child: four of those five surfaces are the host's own box. React only clears
     * style properties it set itself on a previous render, so a consumer's `style`
     * prop coexists with this — but a consumer that passes `--bs-taxonomy-card-accent`
     * through that prop should not also set this attribute.
     */
    get accent(): string | null {
        return this.getAttribute('accent')
    }
    set accent(v: string | null) {
        if (v != null) this.setAttribute('accent', v)
        else this.removeAttribute('accent')
    }

    /** The tracked uppercase overline — „ГЛАВНО ЈАДЕЊЕ", or `1f`'s „Супа · Марија П.". */
    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? ''
    }
    set eyebrow(v: string | null) {
        if (v != null) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    /** The serif title. Also the activation region's accessible name unless `spoken` overrides it. */
    get heading(): string {
        return this.getAttribute('heading') ?? ''
    }
    set heading(v: string | null) {
        if (v != null) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    /**
     * `1`–`6` render the heading as that `<hN>`; `0` (the default) keeps a `<div>`.
     *
     * Not assumed: a list of cards under one page heading is a list of `<h3>`s, but a
     * card used as a page's hero („Рецепт на неделата") is not a heading at all, and a
     * card inside a `tc-list-section` may already sit under one. The consumer knows
     * the document outline; this element does not.
     */
    get headingLevel(): number {
        const raw = Number(this.getAttribute('heading-level'))
        return Number.isInteger(raw) && raw >= 1 && raw <= 6 ? raw : 0
    }
    set headingLevel(v: number | null) {
        if (v != null && v >= 1 && v <= 6) this.setAttribute('heading-level', String(v))
        else this.removeAttribute('heading-level')
    }

    /** A small muted line under the title — the source bundle, the author, a date. */
    get subheading(): string {
        return this.getAttribute('subheading') ?? ''
    }
    set subheading(v: string | null) {
        if (v != null) this.setAttribute('subheading', v)
        else this.removeAttribute('subheading')
    }

    /** Body copy, clamped to `clamp` lines. Absent ⇒ the line collapses entirely. */
    get description(): string {
        return this.getAttribute('description') ?? ''
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    /**
     * Lines the description is clamped to. `2` by default (the design's own),
     * `0` ⇒ no clamp at all.
     *
     * Read by the partial straight off the host, so it is CSS state and changing it
     * never re-renders.
     */
    get clamp(): number {
        const raw = Number(this.getAttribute('clamp'))
        return Number.isInteger(raw) && raw >= 0 ? raw : 2
    }
    set clamp(v: number | null) {
        if (v != null) this.setAttribute('clamp', String(v))
        else this.removeAttribute('clamp')
    }

    /** The floated figure — „486". Omit both this and `metric-unit` ⇒ no box at all. */
    get metricValue(): string {
        return this.getAttribute('metric-value') ?? ''
    }
    set metricValue(v: string | null) {
        if (v != null) this.setAttribute('metric-value', String(v))
        else this.removeAttribute('metric-value')
    }

    /** The unit under it — „ККАЛ". Uppercase and tracked by the partial, not by the string. */
    get metricUnit(): string {
        return this.getAttribute('metric-unit') ?? ''
    }
    set metricUnit(v: string | null) {
        if (v != null) this.setAttribute('metric-unit', v)
        else this.removeAttribute('metric-unit')
    }

    /**
     * How the metric box is SPOKEN — „486 килокалории по порција" for a box that
     * reads „486 · ККАЛ".
     *
     * Present ⇒ the box becomes one `role="img"` node carrying this string, so the
     * figure and its unit are not announced a second time. Absent ⇒ the glyphs are
     * read as text, and „ККАЛ" is an abbreviation every screen reader mangles — only
     * the app knows the spoken Macedonian form, so the library cannot derive it. Same
     * knob as tc-stat-tile's `spoken`.
     */
    get metricSpoken(): string | null {
        return this.getAttribute('metric-spoken')
    }
    set metricSpoken(v: string | null) {
        if (v != null) this.setAttribute('metric-spoken', v)
        else this.removeAttribute('metric-spoken')
    }

    /**
     * The activation region's accessible name, when the title alone is not enough
     * („Отвори: Тавче гравче"). Absent ⇒ the visible title IS the name, which is the
     * right default — WCAG 2.5.3 wants the visible label inside the accessible one,
     * and a card's title is already that label.
     */
    get spoken(): string | null {
        return this.getAttribute('spoken')
    }
    set spoken(v: string | null) {
        if (v != null) this.setAttribute('spoken', v)
        else this.removeAttribute('spoken')
    }

    /**
     * Renders the activation region as a real `<a href>` — right-click, long-press,
     * middle-click and "open in new tab" all work, and the app intercepts the click
     * for SPA routing by cancelling `tc-taxonomy-card-activate`.
     *
     * Absent ⇒ a `<button type="button">` that only fires the event.
     */
    get href(): string | null {
        return this.getAttribute('href')
    }
    set href(v: string | null) {
        if (v != null) this.setAttribute('href', v)
        else this.removeAttribute('href')
    }

    /**
     * Presence ⇒ a static panel: no activation region, no hit-target overlay, no
     * press or hover feedback. `1g`'s blurred skeletons, and any card that is a
     * read-only summary.
     *
     * The negation is the attribute because interactive is the default — see the
     * header comment.
     */
    get isStatic(): boolean {
        return this.hasAttribute('static')
    }
    set isStatic(v: boolean) {
        this.toggleAttribute('static', v)
    }

    /** Inverse of `static`. `true` by default. */
    get interactive(): boolean {
        return !this.hasAttribute('static')
    }
    set interactive(v: boolean) {
        this.toggleAttribute('static', !v)
    }

    /** The `<a>`/`<button>` that activates the card, or `null` on a static one. */
    get activationElement(): HTMLElement | null {
        return this.querySelector<HTMLElement>('.tc-taxonomy-card-link')
    }

    // ── Activation ───────────────────────────────────────────────────────────

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element | null
        if (!target?.closest) return
        // `:scope` is not valid in closest(); scope by containment instead, so a
        // nested tc-taxonomy-card's own link cannot activate this one.
        const link = target.closest<HTMLElement>('.tc-taxonomy-card-link')
        if (!link || link.closest(TAG_NAME) !== this) return

        const detail: TaxonomyCardActivateDetail = { href: this.href }
        const event = new CustomEvent<TaxonomyCardActivateDetail>('tc-taxonomy-card-activate', {
            bubbles: true,
            composed: true,
            // Cancelable so a router can suppress the anchor's own navigation and
            // route in-app instead. Also the only way to say "not this time".
            cancelable: true,
            detail,
        })
        this.dispatchEvent(event)
        if (typeof this.onActivate === 'function') this.onActivate(detail.href)
        if (event.defaultPrevented) e.preventDefault()
    }

    // ── Render ───────────────────────────────────────────────────────────────

    // TEXT IS PATCHED, STRUCTURE IS REBUILT — and only when the structure changed.
    // See the header comment: a feed rewrites these attributes on every filter change.
    private _render(): void {
        const main = this._ensureMain()
        // `firstChild` covers the other way the DOM can go missing: a React
        // move/remount hands back a brand-new (empty) main from _ensureMain.
        const shape = `${this.isStatic ? 'static' : this.href != null ? 'link' : 'button'}/${this.headingLevel}`
        if (shape !== this._builtFor || !main.firstChild) {
            main.innerHTML = this._skeleton()
            this._builtFor = shape
        }
        this._patch(main)
        // The host's own box paints four of the five accent surfaces, so the property
        // goes here. Cleared rather than set to `''` so the partial's default applies
        // again when the attribute is removed.
        const accent = this.accent
        if (accent) this.style.setProperty('--bs-taxonomy-card-accent', accent)
        else this.style.removeProperty('--bs-taxonomy-card-accent')
    }

    // No text interpolation anywhere in here: every string goes in through
    // `textContent`/`setAttribute` in _patch, which escapes for free.
    private _skeleton(): string {
        const tag = this.headingLevel ? `h${this.headingLevel}` : 'div'
        // The link/button wraps the title TEXT and nothing else. Its stretched ::after
        // is what makes the card a target — see the header comment.
        const title = this.isStatic
            ? ''
            : this.href != null
              ? `<a class="tc-taxonomy-card-link"></a>`
              : `<button type="button" class="tc-taxonomy-card-link"></button>`

        return (
            // First in the DOM because it is `float: right`: a float is placed against
            // the line box it starts on, so it has to precede the text it sits beside.
            `<div class="tc-taxonomy-card-metric">` +
            `<span class="tc-taxonomy-card-metric-value"></span>` +
            `<span class="tc-taxonomy-card-metric-unit"></span>` +
            `</div>` +
            `<div class="tc-taxonomy-card-eyebrow"></div>` +
            `<${tag} class="tc-taxonomy-card-heading">${title}</${tag}>` +
            `<div class="tc-taxonomy-card-subheading"></div>` +
            `<p class="tc-taxonomy-card-desc"></p>`
        )
    }

    private _patch(main: HTMLElement): void {
        const write = (selector: string, text: string): HTMLElement | null => {
            const el = main.querySelector<HTMLElement>(selector)
            if (!el) return null
            // Compared before writing so an unchanged string never touches the DOM —
            // `textContent =` replaces the text node, which is enough to interrupt an
            // in-progress screen-reader read or drop a selection.
            if (el.textContent !== text) el.textContent = text
            // An empty run collapses entirely rather than leaving an empty line box
            // and its margin behind. The sibling rules in the partial are keyed on
            // `:not([hidden])` for exactly this.
            el.hidden = text === ''
            return el
        }

        write('.tc-taxonomy-card-eyebrow', this.eyebrow)
        write('.tc-taxonomy-card-subheading', this.subheading)
        write('.tc-taxonomy-card-desc', this.description)

        // The heading's text belongs to the link when there is one, so that the link's
        // accessible name is the title and the whole title is the visible label.
        const heading = main.querySelector<HTMLElement>('.tc-taxonomy-card-heading')
        const link = main.querySelector<HTMLElement>('.tc-taxonomy-card-link')
        const target = link ?? heading
        if (target && target.textContent !== this.heading) target.textContent = this.heading
        if (heading) heading.hidden = this.heading === ''
        if (link instanceof HTMLAnchorElement) link.href = this.href ?? ''
        if (link) {
            const spoken = this.spoken
            if (spoken) link.setAttribute('aria-label', spoken)
            else link.removeAttribute('aria-label')
        }

        const metric = main.querySelector<HTMLElement>('.tc-taxonomy-card-metric')
        write('.tc-taxonomy-card-metric-value', this.metricValue)
        write('.tc-taxonomy-card-metric-unit', this.metricUnit)
        if (metric) {
            // No figure AND no unit ⇒ no box. A box with one of the two is legitimate:
            // „4.6" with no unit, or a unit-only badge.
            metric.hidden = this.metricValue === '' && this.metricUnit === ''
            const metricSpoken = this.metricSpoken
            // `role="img"` makes the box a LEAF in the accessibility tree, so the
            // figure and unit inside are not announced a second time — no aria-hidden
            // is written, so removing `metric-spoken` restores plain text.
            if (metricSpoken) {
                metric.setAttribute('role', 'img')
                metric.setAttribute('aria-label', metricSpoken)
            } else {
                metric.removeAttribute('role')
                metric.removeAttribute('aria-label')
            }
        }

        // A card with no text at all is `1g`'s skeleton: hide the block so its gap to
        // the first slotted row does not become the card's whole content.
        main.hidden =
            this.eyebrow === '' &&
            this.heading === '' &&
            this.subheading === '' &&
            this.description === '' &&
            this.metricValue === '' &&
            this.metricUnit === ''
    }

    // Created once and reused, so re-rendering the text never touches a consumer's
    // slotted rows. Inserted FIRST so the title's link precedes a slotted control in
    // tab order — the regions' visual order is CSS's job, sequential focus order is
    // the DOM's.
    private _ensureMain(): HTMLElement {
        let main = this._main
        if (main?.parentNode === this) return main
        main = this.querySelector<HTMLElement>(':scope > .tc-taxonomy-card-main')
        if (!main) {
            main = document.createElement('div')
            main.className = 'tc-taxonomy-card-main'
            this.insertBefore(main, this.firstChild)
            // A rebuilt main belongs to a rebuilt skeleton.
            this._builtFor = ''
        }
        this._main = main
        return main
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TaxonomyCard
    }
}

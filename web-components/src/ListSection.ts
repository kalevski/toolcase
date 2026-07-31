import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'

// tc-list-section — a titled group of rows: a tinted header band carrying an icon, an
// eyebrow label and a right-aligned figure, over rows separated by hairlines, inside
// one clipped rounded frame.
//
// Screen `1j` („Планер") of the JADI.mk phone design draws three of them per day —
// појадок / ручек / вечера, each with the meal's own hue on its icon and label.
//
// WHY THIS AND NOT tc-panel / tc-card. Both were tried first:
//   * tc-panel's frame is `border-radius: 0` and has no `overflow`, and neither is
//     reachable through a `--bs-*` knob. This band is a filled strip that has to be
//     CLIPPED by a 10px corner, so making tc-panel do it means overriding two
//     hardcoded properties — on every tc-panel in every app that consumes the
//     sunshine theme, not just on this one.
//   * tc-panel-header's heading is `font-weight: 500` with no tracking and no
//     transform, so the eyebrow (700 / .13em / uppercase) is a third override; its
//     only trailing region is the `action` SLOT, which is re-parented — and slot
//     re-parenting is what breaks under react-dom (see src/AppBar.ts).
//   * tc-card's `.card-header` is a gradient cap sized for desktop (0.75rem 1.5rem,
//     1.05rem heading) and `tc-card` itself re-parents slotted children.
//   The row rhythm — 11px 12px, 1px dashed between and never after the last — is not
//   expressible in either at all. So: a fourth box, and a small one.
//
// WHY THE HUE IS A CSS PROPERTY AND NOT A `tone` ATTRIBUTE
//   The header's icon and label share one colour, and which colour is domain
//   knowledge the library does not have: `1j`'s three hues are the app's meal-time
//   map (појадок `#8a6d2f`, ручек `#a4472f`, вечера `#3c5d6b`) and there is no
//   enumerable set to name. So it is one custom property, `--bs-list-section-tone`,
//   set per instance — the same split tc-taxonomy-card uses for its category accent.
//   An attribute whose value set is open-ended and whose only effect is a colour is
//   strictly worse than the colour.
//
// WHY IT NEVER MOVES A CHILD
//   The header is the ONE node this element owns; it is created once and inserted
//   first. Rows are the consumer's own children and are styled where they sit, and
//   `[slot="footer"]` is ordered last by CSS rather than appended. The library's
//   older slot-distributing components re-parent slotted children into a rendered
//   skeleton, which throws NotFoundError under react-dom on a route change — and a
//   planner whose rows change with the selected day is exactly that case. See the
//   header comments in src/MobileShell.ts and src/AppBar.ts.

const TAG_NAME = 'tc-list-section'

let _idCounter = 0

export class ListSection extends HTMLElement {
    private _header: HTMLElement | null = null
    private _headingId: string
    // Which shape `_header`'s contents were built for — `icon/meta` presence. Text
    // changes patch that DOM in place; only a change of shape rebuilds it.
    private _builtFor = ''

    static get observedAttributes(): string[] {
        return ['heading', 'icon', 'meta']
    }

    constructor() {
        super()
        this._headingId = `tc-list-section-heading-${++_idCounter}`
    }

    connectedCallback(): void {
        // A titled group of related rows IS a group, and naming it is the whole point
        // of the header. `aria-labelledby` and not `aria-label`: the heading is inside
        // this element, so copying its text into a label would have a screen reader
        // read it twice — once as the group's name and once as its first content.
        // Left alone when the consumer has spoken; a list of links is arguably a nav.
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        this._render()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        this._render()
    }

    get heading(): string {
        return this.getAttribute('heading') ?? ''
    }
    set heading(v: string | null) {
        if (v != null) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    /** A lucide icon name (kebab or Pascal). Rendered at 14px in the tone colour. */
    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    /** The right-aligned figure in the band — „628 ккал". Rendered with `tabular-nums`. */
    get meta(): string | null {
        return this.getAttribute('meta')
    }
    set meta(v: string | null) {
        if (v != null) this.setAttribute('meta', v)
        else this.removeAttribute('meta')
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private _render(): void {
        const heading = this.heading
        const iconName = this.icon
        const meta = this.meta
        // Nothing to title ⇒ no band at all, rather than an empty 34px strip. The
        // frame and the row rhythm are still worth having on their own.
        if (!heading && !iconName && meta == null) {
            this._header?.remove()
            this._header = null
            this._builtFor = ''
            this.removeAttribute('aria-labelledby')
            return
        }

        const header = this._ensureHeader()
        const shape = `${iconName ?? ''}/${meta == null ? '' : 'meta'}`
        if (shape !== this._builtFor || !header.firstChild) {
            header.innerHTML = this._skeleton(iconName, meta != null)
            this._builtFor = shape
        }
        this._patch(header)
        if (heading) this.setAttribute('aria-labelledby', this._headingId)
        else this.removeAttribute('aria-labelledby')
    }

    // No text interpolation: the heading and the meta go in through `textContent` in
    // _patch, which escapes for free. The only interpolated value is the id.
    private _skeleton(iconName: string | null, hasMeta: boolean): string {
        // lucideByName goes through icon(), which strips the fixed width/height so
        // CSS owns the size and marks the svg aria-hidden — the glyph restates the
        // label („sun" beside „Појадок"), and a decorative icon announced before the
        // group's name is noise. An unknown name yields '' rather than a broken box.
        const iconHtml = iconName ? lucideByName(iconName, 'tc-list-section-icon') : ''
        return (
            iconHtml +
            `<span class="tc-list-section-heading" id="${esc(this._headingId)}"></span>` +
            (hasMeta ? `<span class="tc-list-section-meta"></span>` : '')
        )
    }

    private _patch(header: HTMLElement): void {
        const write = (selector: string, text: string): void => {
            const el = header.querySelector(selector)
            // Compared before writing so an unchanged string never touches the DOM —
            // `textContent =` replaces the text node, which interrupts a screen-reader
            // read in progress. `1j`'s meta is a live kcal total.
            if (el && el.textContent !== text) el.textContent = text
        }
        write('.tc-list-section-heading', this.heading)
        write('.tc-list-section-meta', this.meta ?? '')
    }

    // Created once and reused, so re-rendering the band never touches a consumer's
    // rows. Inserted FIRST so the group's name precedes its content in reading order.
    private _ensureHeader(): HTMLElement {
        let header = this._header
        if (header?.parentNode === this) return header
        header = this.querySelector<HTMLElement>(':scope > .tc-list-section-header')
        if (!header) {
            header = document.createElement('div')
            header.className = 'tc-list-section-header'
            this.insertBefore(header, this.firstChild)
            this._builtFor = ''
        }
        this._header = header
        return header
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ListSection
    }
}

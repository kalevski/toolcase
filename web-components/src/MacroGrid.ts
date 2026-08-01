// tc-macro-grid — the row of numbers, in the design's two arrangements:
//
//   1d  variant="bare"  columns="4"   ккал · белк. г · јагл. г · масти г, un-boxed,
//                                     the first one accent-coloured, and a dashed
//                                     footer rule carrying „Проценето од 8 од 11
//                                     состојки" / „Целосно ⌄"
//   1i  variant="tiled" columns="3"   белковини · масти · јаглехидрати, each on a
//                                     tinted well in its own per-macro hue
//
// TWO GRID-OF-TILES ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-metric-grid   a DASHBOARD grid of tc-metric-tiles. It distributes its
//                    children by re-parenting them into a rendered wrapper div,
//                    which under react-dom throws NotFoundError on unmount, and it
//                    imposes tc-metric-tile's icon-led KPI shape on every cell.
//   tc-macro-grid    this one. Renders NOTHING, owns only the tracks and the gaps,
//                    and re-points its children's `--bs-stat-tile-*` knobs so a row
//                    is one decision instead of N.
//
// WHY IT RENDERS NOTHING
//   Its children are the consumer's tc-stat-tiles, and a macro row is mapped
//   straight off data (`stats.perServing`, `targets`). An element that re-parented
//   them would throw NotFoundError under react-dom, which removes a child with
//   `parentInstance.removeChild(child)` against the parent it BELIEVES the child
//   has. So this element renders no markup at all and exists in TypeScript only for
//   its typed attributes; everything else is the partial. Same call tc-action-bar
//   and tc-mobile-shell make.
//   There is deliberately no `items` property either: an array of
//   `{ value, label, color }` would have to become tiles this element created and
//   owned, sitting as siblings of children React believes it owns. The tiles ARE the
//   API — `columns` and `variant` are the only things the row knows that a tile
//   cannot.
//
// THE GRID'S VARIANT WINS OVER A TILE'S OWN
//   `tc-macro-grid[variant='…'] > tc-stat-tile` is one attribute more specific than
//   `tc-stat-tile[variant='…']`, so a tile inside a grid takes the ROW's shape even
//   if it carries its own `variant`. That is intended: the design has no row of
//   mismatched tiles, and a single card-shaped cell in a bare row reads as a
//   rendering fault. Re-point `--bs-stat-tile-*` on the one child if you genuinely
//   need it.
//
// ROW-GAP IS THE FOOTER GAP
//   The design never wraps a macro row onto a second line — four cells at 390px, and
//   at 320px the narrowest cell is still 60px. So the grid's `row-gap` is spent on
//   the ONE place a second row appears: the `footer` slot. That is what makes 1d's
//   11px footer offset and 1i's 12px exact without a margin that would have to be
//   subtracted from the gap. A row that does wrap gets the footer's gap between its
//   lines; if that ever matters, set `--bs-macro-grid-row-gap`.

const TAG_NAME = 'tc-macro-grid'

export type MacroGridVariant = 'bare' | 'tiled'
const VARIANTS: MacroGridVariant[] = ['bare', 'tiled']

export type MacroGridColumns = 2 | 3 | 4
const COLUMNS: MacroGridColumns[] = [2, 3, 4]

export class MacroGrid extends HTMLElement {
    static get observedAttributes(): string[] {
        // Both are pure CSS state, observed only so that scripts/gen-react-types.mjs
        // types them as JSX props — it reads this list.
        return ['columns', 'variant']
    }

    get variant(): MacroGridVariant {
        const raw = this.getAttribute('variant') as MacroGridVariant
        return VARIANTS.includes(raw) ? raw : 'bare'
    }
    set variant(v: MacroGridVariant) {
        this.setAttribute('variant', VARIANTS.includes(v) ? v : 'bare')
    }

    /**
     * 2, 3 or 4 equal tracks. Not open-ended: five 700-weight figures do not fit
     * across 390px minus a 14px gutter and a card's own padding, and the design's own
     * arrangements are 3 and 4. Anything else is a grid, not a macro row — use
     * `tc-grid`.
     */
    get columns(): MacroGridColumns {
        const raw = Number(this.getAttribute('columns')) as MacroGridColumns
        return COLUMNS.includes(raw) ? raw : 4
    }
    set columns(v: MacroGridColumns) {
        // Number(v), not v: react-dom writes a JSX prop as a PROPERTY whenever one
        // exists on the instance, so `columns="3"` — the form this element's own
        // documentation uses — arrives here as the STRING '3', and
        // `[2, 3, 4].includes('3')` is false. The row then silently fell back to
        // four tracks: at 390px a 76px cell instead of a 105px one, which wraps
        // „јаглехидрати" onto two lines. Measured on screen `1i`. Same coercion
        // the tri-state boolean setters already do, for the same reason.
        const parsed = Number(v) as MacroGridColumns
        this.setAttribute('columns', String(COLUMNS.includes(parsed) ? parsed : 4))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MacroGrid
    }
}

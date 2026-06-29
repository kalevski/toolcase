const TAG_NAME = 'tc-grid'

// Mobile-first breakpoints, ascending. Mirror tc-col's convention: a bare
// attribute (e.g. `columns`) is the base/mobile value; per-breakpoint variants
// (`columns-md`) override it from that viewport up.
const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', 'xxl'] as const
type Breakpoint = (typeof BREAKPOINTS)[number]

// The base layout attributes plus their per-breakpoint `-{bp}` variants. Kept as
// an explicit string-literal list (rather than a computed flatMap) so the
// gen-react-types scanner can expand it into the JSX typings.
const GRID_ATTRIBUTES = [
    'columns',
    'rows',
    'gap',
    'cell-size',
    'columns-sm',
    'columns-md',
    'columns-lg',
    'columns-xl',
    'columns-xxl',
    'rows-sm',
    'rows-md',
    'rows-lg',
    'rows-xl',
    'rows-xxl',
    'gap-sm',
    'gap-md',
    'gap-lg',
    'gap-xl',
    'gap-xxl',
    'cell-size-sm',
    'cell-size-md',
    'cell-size-lg',
    'cell-size-xl',
    'cell-size-xxl',
] as const

// Bare integers (e.g. cell-size="48" or gap="8") are treated as px lengths;
// any other value (a fraction unit like "1fr", a keyword like "auto", or an
// explicit length like "1rem") is passed through untouched.
function resolveLength(raw: string | null): string {
    if (raw === null) return ''
    const trimmed = raw.trim()
    return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}px` : trimmed
}

function nonEmpty(raw: string | null): string | null {
    if (raw === null) return null
    const trimmed = raw.trim()
    return trimmed === '' ? null : trimmed
}

export class Grid extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return [...GRID_ATTRIBUTES]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // tc-grid is a pure layout primitive — it never owns its children's
            // markup, so there is no slot capture/re-append cycle (cf. Spacer).
            this.classList.add('tc-grid')
            this.applyLayout()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.applyLayout()
    }

    get columns(): string {
        return this.getAttribute('columns') ?? ''
    }
    set columns(value: string) {
        this.setAttribute('columns', value)
    }

    get rows(): string {
        return this.getAttribute('rows') ?? ''
    }
    set rows(value: string) {
        this.setAttribute('rows', value)
    }

    get gap(): string {
        return this.getAttribute('gap') ?? ''
    }
    set gap(value: string) {
        this.setAttribute('gap', value)
    }

    get cellSize(): string {
        return this.getAttribute('cell-size') ?? ''
    }
    set cellSize(value: string) {
        this.setAttribute('cell-size', value)
    }

    // Mobile-first value of an attribute at a level: the base attribute,
    // overridden by each specified breakpoint up to and including `levelIdx`
    // (0 = base, 1 = sm … 5 = xxl).
    private _effective(name: string, levelIdx: number): string | null {
        let value = nonEmpty(this.getAttribute(name))
        for (let i = 0; i < levelIdx; i++) {
            const bp = nonEmpty(this.getAttribute(`${name}-${BREAKPOINTS[i]}`))
            if (bp !== null) value = bp
        }
        return value
    }

    // Does this breakpoint explicitly own a value for the family? Used so a
    // level only writes a staging var when it introduces an override — otherwise
    // the SCSS fallback chain inherits the next-smaller level (and the base
    // var stays the public theming entry point).
    private _owns(name: string, bp: Breakpoint): boolean {
        return nonEmpty(this.getAttribute(`${name}-${bp}`)) !== null
    }

    private _setOrClear(prop: string, value: string | null): void {
        if (value) this.style.setProperty(prop, value)
        else this.style.removeProperty(prop)
    }

    // Cosmetics flow through --bs-grid-* custom properties (the public theming
    // contract); the SCSS partial declares the defaults, builds the mobile-first
    // media cascade, and consumes them. The base level writes the unsuffixed
    // vars (backward compatible); each breakpoint writes `--bs-grid-*-{bp}` only
    // when it overrides that family.
    private applyLayout(): void {
        const levels: Array<{ bp: '' | Breakpoint; idx: number }> = [
            { bp: '', idx: 0 },
            ...BREAKPOINTS.map((bp, i) => ({ bp, idx: i + 1 })),
        ]

        for (const { bp, idx } of levels) {
            const suffix = bp ? `-${bp}` : ''
            const size = resolveLength(this._effective('cell-size', idx)) || '1fr'
            const columns = this._effective('columns', idx)
            const rows = this._effective('rows', idx)
            const gap = resolveLength(this._effective('gap', idx))

            // cell-size feeds both the column and row tracks, so a `cell-size-{bp}`
            // override owns the columns/rows families at that breakpoint too.
            const ownsColumns = bp === '' || this._owns('columns', bp) || this._owns('cell-size', bp)
            const ownsRows = bp === '' || this._owns('rows', bp) || this._owns('cell-size', bp)
            const ownsGap = bp === '' || this._owns('gap', bp)

            this._setOrClear(
                `--bs-grid-template-columns${suffix}`,
                ownsColumns && columns ? `repeat(${columns}, ${size})` : null,
            )
            this._setOrClear(
                `--bs-grid-template-rows${suffix}`,
                ownsRows && rows ? `repeat(${rows}, ${size})` : null,
            )
            this._setOrClear(`--bs-grid-gap${suffix}`, ownsGap && gap ? gap : null)
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Grid
    }
}

import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { msg } from './messages'
import { num, setAttr } from './internal/tc-element'

// tc-filter-bar — a filter TOOLBAR: several labelled chip rows, a result count and
// a clear-all.
//
// From webgame.cloud's `FilterBar` (157 lines). It is the desktop sibling of
// polovni.mk's sheet-plus-trigger pair, and the difference is not cosmetic: a bar
// keeps every dimension on screen, so the reader sees what they have narrowed
// without opening anything — which is worth the vertical space on a wide viewport
// and is exactly wrong on a phone. `tc-filter-trigger` + a sheet is the phone
// shape; this is the desktop one.
//
// IT COMPOSES `tc-facet-picker` RATHER THAN REDRAWING CHIPS. Each row is one
// dimension and one dimension is a facet, so the bar owns the frame — the
// legends, the count line, the clear — and the facet owns the chips. That also
// means the two answer the same event, so a consumer wires one handler.
//
// THE COUNT LINE IS NOT DECORATION. "48 of 210" is the answer to "did that
// filter do anything", which is the question a reader asks after every tap and
// the reason a filter bar exists rather than a row of chips.

const TAG_NAME = 'tc-filter-bar'

export interface FilterBarOption {
    value: string
    label: string
    count?: number
    disabled?: boolean
}

export interface FilterBarRow {
    key: string
    legend: string
    options: FilterBarOption[]
    /** The picked value for this row, or `null`. */
    value?: string | null
    layout?: 'rail' | 'wrap'
}

export class FilterBar extends HTMLElement {
    private _built = false
    private _rows: FilterBarRow[] = []
    private _list: HTMLElement | null = null

    /** Invoked when a dimension changes. The `tc-change` event is the primary API. */
    onChange: ((key: string, value: string | null) => void) | null = null
    /** Invoked by the clear-all. The `tc-clear` event is the primary API. */
    onClear: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['total', 'matches', 'unit', 'clear-label', 'active', 'class']
    }

    connectedCallback(): void {
        if (!this._built) {
            this.insertAdjacentHTML(
                'afterbegin',
                `<div class="tc-filter-bar__rows"></div>` +
                    `<div class="tc-filter-bar__foot">` +
                    `<span class="tc-filter-bar__count"></span>` +
                    `<button type="button" class="tc-filter-bar__clear"></button>` +
                    `</div>`,
            )
            this._list = this.querySelector(':scope > .tc-filter-bar__rows')
            this._built = true
        }
        this.addEventListener('click', this._onClick)
        this.addEventListener('tc-pick', this._onPick)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('tc-pick', this._onPick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** The dimensions. A JS property: React cannot pass an array. */
    get rows(): FilterBarRow[] {
        return this._rows
    }
    set rows(v: FilterBarRow[]) {
        this._rows = Array.isArray(v) ? v : []
        if (this._built) this._renderRows()
    }

    /** How many things exist before filtering. */
    get total(): number {
        return num(this.getAttribute('total'), 0)
    }
    set total(v: number) {
        this.setAttribute('total', String(v))
    }

    /**
     * How many survive the current filter.
     *
     * The ATTRIBUTE is `matches`; the property is `matchCount`, because
     * `Element.matches()` already exists and shadowing a DOM method with a number
     * is what makes two elements in this library unassignable to `HTMLElement`
     * (tc-diff-viewer's `after`, tc-offcanvas's `scroll`). Not repeating that.
     */
    get matchCount(): number {
        return num(this.getAttribute('matches'), 0)
    }
    set matchCount(v: number) {
        this.setAttribute('matches', String(v))
    }

    /** The noun in the count line — "games", "results". */
    get unit(): string {
        return this.getAttribute('unit') ?? ''
    }
    set unit(v: string) {
        setAttr(this, 'unit', v)
    }

    get clearLabel(): string {
        return this.getAttribute('clear-label') ?? msg('clear')
    }
    set clearLabel(v: string) {
        setAttr(this, 'clear-label', v)
    }

    /** Anything is set. Shows the clear-all and marks the bar. */
    get active(): boolean {
        return this.hasAttribute('active')
    }
    set active(v: boolean) {
        if (v) this.setAttribute('active', '')
        else this.removeAttribute('active')
    }

    private patch(): void {
        setHostClass(this, 'tc-filter-bar')
        this.setAttribute('data-active', this.active ? 'true' : 'false')

        const count = this.querySelector<HTMLElement>('.tc-filter-bar__count')
        if (count) {
            const total = this.total
            const matches = this.matchCount
            const unit = this.unit
            // "210 games" while nothing is set, "48 of 210 games" once something is:
            // the unfiltered case has no comparison to draw, and printing one makes
            // an untouched list look narrowed.
            const text =
                this.active && matches !== total
                    ? `${matches} / ${total}${unit ? ` ${unit}` : ''}`
                    : `${total}${unit ? ` ${unit}` : ''}`
            if (count.textContent !== text) count.textContent = text
            count.setAttribute('role', 'status')
        }

        const clear = this.querySelector<HTMLButtonElement>('.tc-filter-bar__clear')
        if (clear) {
            const label = this.clearLabel
            if (clear.textContent !== label) clear.textContent = label
            clear.type = 'button'
            clear.hidden = !this.active
        }

        this._renderRows()
    }

    // The row frames are element-owned; the chips inside each row belong to a
    // `tc-facet-picker`, which owns them in turn. No consumer node is touched.
    private _renderRows(): void {
        const list = this._list
        if (!list) return
        const html = this._rows
            .map(
                (row) =>
                    `<div class="tc-filter-bar__row" data-key="${esc(row.key)}">` +
                    `<tc-facet-picker class="tc-filter-bar__facet"` +
                    ` label="${esc(row.legend)}" layout="${esc(row.layout ?? 'wrap')}"` +
                    `${row.value ? ` value="${esc(row.value)}"` : ''}></tc-facet-picker>` +
                    `</div>`,
            )
            .join('')
        if (list.innerHTML !== html) {
            list.innerHTML = html
        }
        // The options are a PROPERTY on each facet — an array cannot travel as an
        // attribute, and stringifying it here would be the bug this library keeps
        // telling consumers not to write.
        const pickers = Array.from(list.querySelectorAll<HTMLElement>('.tc-filter-bar__facet'))
        this._rows.forEach((row, index) => {
            const picker = pickers[index] as HTMLElement & { options?: FilterBarOption[] }
            if (picker) picker.options = row.options
        })
    }

    private _onPick = (event: Event): void => {
        const origin = event.target as HTMLElement | null
        const row = origin?.closest<HTMLElement>('.tc-filter-bar__row')
        if (!row) return
        const key = row.dataset.key ?? ''
        const value = (event as CustomEvent<{ value: string | null }>).detail?.value ?? null
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { key, value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(key, value)
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        if (!origin?.closest('.tc-filter-bar__clear')) return
        this.dispatchEvent(new CustomEvent('tc-clear', { bubbles: true, composed: true }))
        if (typeof this.onClear === 'function') this.onClear()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FilterBar
    }
}

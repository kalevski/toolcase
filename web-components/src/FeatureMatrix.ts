import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-feature-matrix'

export type MatrixValue = boolean | 'partial' | string

export interface MatrixColumn {
    id: string
    label: string
    highlight?: boolean
}

export interface MatrixRow {
    label: string
    hint?: string
    values: Record<string, MatrixValue>
}

// Pre-compute icons once at module load.
const checkIconHtml = lucideByName('check')
const xIconHtml = lucideByName('x')
const minusIconHtml = lucideByName('minus')

function renderValueCell(value: MatrixValue): string {
    if (value === true) {
        return (
            `<span class="tc-feature-matrix__indicator tc-feature-matrix__indicator--yes" aria-label="Supported">` +
            checkIconHtml +
            `</span>`
        )
    }
    if (value === false) {
        return (
            `<span class="tc-feature-matrix__indicator tc-feature-matrix__indicator--no" aria-label="Not supported">` +
            xIconHtml +
            `</span>`
        )
    }
    if (value === 'partial') {
        return (
            `<span class="tc-feature-matrix__indicator tc-feature-matrix__indicator--partial" aria-label="Partial">` +
            minusIconHtml +
            `</span>`
        )
    }
    // Custom text value — mono rendering, safely escaped.
    return `<span class="tc-feature-matrix__value-text">${esc(String(value))}</span>`
}

export class FeatureMatrix extends HTMLElement {
    private _initialised = false
    private _columns: MatrixColumn[] = []
    private _rows: MatrixRow[] = []
    private _titleSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('title')) {
                this._titleSlotNodes = Array.from(this.querySelectorAll('[slot="title"]'))
            }
            this.render()
            const slot = this.querySelector('.tc-feature-matrix__title-slot')
            if (slot) this._titleSlotNodes.forEach((n) => slot.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    // NOTE: title getter/setter intentionally omitted — HTMLElement already
    // reflects the `title` attribute natively; defining our own would collide.

    get columns(): MatrixColumn[] {
        return this._columns
    }
    set columns(v: MatrixColumn[]) {
        this._columns = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get rows(): MatrixRow[] {
        return this._rows
    }
    set rows(v: MatrixRow[]) {
        this._rows = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        const slotContainer = this.querySelector('.tc-feature-matrix__title-slot')
        if (slotContainer) {
            this._titleSlotNodes = Array.from(slotContainer.querySelectorAll('[slot="title"]'))
        }
        this.render()
        const newSlot = this.querySelector('.tc-feature-matrix__title-slot')
        if (newSlot) this._titleSlotNodes.forEach((n) => newSlot.appendChild(n))
    }

    private render(): void {
        const titleAttr = this.getAttribute('title')
        const columns = this._columns
        const rows = this._rows

        // Header: attribute wins; fall back to named slot container.
        let headerHtml = ''
        if (titleAttr) {
            headerHtml =
                `<div class="tc-feature-matrix__header">` +
                `<p class="tc-feature-matrix__title">${esc(titleAttr)}</p>` +
                `</div>`
        } else if (this._titleSlotNodes.length > 0) {
            headerHtml =
                `<div class="tc-feature-matrix__header">` +
                `<div class="tc-feature-matrix__title-slot"></div>` +
                `</div>`
        }

        // Header row: feature label corner + one <th> per column.
        const colHeadCells = columns
            .map((col) => {
                const highlightClass = col.highlight
                    ? ' tc-feature-matrix__col-head--highlight'
                    : ''
                return (
                    `<th scope="col" class="tc-feature-matrix__cell tc-feature-matrix__col-head${highlightClass}">` +
                    `<span class="tc-feature-matrix__col-label">${esc(col.label)}</span>` +
                    `</th>`
                )
            })
            .join('')

        const theadHtml =
            `<thead>` +
            `<tr class="tc-feature-matrix__head-row">` +
            `<th scope="col" class="tc-feature-matrix__cell tc-feature-matrix__feature-head">Feature</th>` +
            colHeadCells +
            `</tr>` +
            `</thead>`

        // Body: one <tr> per row, first cell is the feature label + hint.
        const tbodyHtml = rows
            .map((row) => {
                const valueCells = columns
                    .map((col) => {
                        const raw = row.values?.[col.id]
                        const value: MatrixValue = raw !== undefined ? raw : false
                        const highlightClass = col.highlight
                            ? ' tc-feature-matrix__cell--highlight'
                            : ''
                        return (
                            `<td class="tc-feature-matrix__cell tc-feature-matrix__value-cell${highlightClass}">` +
                            renderValueCell(value) +
                            `</td>`
                        )
                    })
                    .join('')

                const hintHtml = row.hint
                    ? `<span class="tc-feature-matrix__row-hint">${esc(row.hint)}</span>`
                    : ''

                return (
                    `<tr class="tc-feature-matrix__row">` +
                    `<th scope="row" class="tc-feature-matrix__cell tc-feature-matrix__feature-cell">` +
                    `<span class="tc-feature-matrix__row-label">${esc(row.label)}</span>` +
                    hintHtml +
                    `</th>` +
                    valueCells +
                    `</tr>`
                )
            })
            .join('')

        patchHtml(
            this,
            `<div class="tc-feature-matrix">` +
                headerHtml +
                `<div class="tc-feature-matrix__scroll">` +
                `<table class="tc-feature-matrix__table">` +
                theadHtml +
                `<tbody>${tbodyHtml}</tbody>` +
                `</table>` +
                `</div>` +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FeatureMatrix
    }
}

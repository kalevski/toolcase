import { esc } from './internal/esc'
import { ArrowDown, ArrowUp } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-item-compare'

// A single stat row of an item — a human-readable label and its value. Numeric
// values drive the side-by-side delta computation; string values are shown
// verbatim and excluded from the diff.
export interface CompareStat {
    label: string
    value: string | number
}

// An item presented in one column of the comparison. Pared down from the
// game-components TooltipItem to the fields the design-system port renders:
// name, an optional mono type micro-label, and the comparable stat list.
// Rarity / requirements / flavor are fantasy chrome and are intentionally
// dropped — only the stat comparison survives.
export interface CompareItem {
    id?: string
    name?: string
    typeLabel?: string
    stats?: CompareStat[]
}

function formatValue(v: string | number): string {
    return typeof v === 'number' ? v.toLocaleString() : v
}

// Lucide inline SVG arrows — the design system forbids unicode glyphs as icons,
// so the gc source's ▲/▼ become recolourable stroke="currentColor" svgs.
const arrowUpIcon = icon(ArrowUp, 'tc-item-compare__delta-arrow')
const arrowDownIcon = icon(ArrowDown, 'tc-item-compare__delta-arrow')

// tc-item-compare — side-by-side item stat comparison. Port of the
// game-components `gc-item-compare`: two columns (current vs candidate), with the
// candidate column annotated by a per-stat difference block. Re-skinned to the
// web-components design system — no gilded frames or fantasy fills; sharp
// hairline columns, slate ink, mono machine-facing labels, and status colour
// (success up / danger down) only on the delta arrows. The public API mirrors
// the source: the `current` and `candidate` JS properties, no attributes, no
// events, no slots. All cosmetics flow through --bs-item-compare-* custom
// properties.
export class ItemCompare extends HTMLElement {
    private _initialised = false
    private _current: CompareItem | null = null
    private _candidate: CompareItem | null = null

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
            if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Item comparison')
            this.render()
            this._initialised = true
        }
    }

    // --- Public API (mirrors gc-item-compare) ---

    get current(): CompareItem | null {
        return this._current
    }
    set current(value: CompareItem | null) {
        this._current = value && typeof value === 'object' ? value : null
        if (this._initialised) this.render()
    }

    get candidate(): CompareItem | null {
        return this._candidate
    }
    set candidate(value: CompareItem | null) {
        this._candidate = value && typeof value === 'object' ? value : null
        if (this._initialised) this.render()
    }

    // Numeric stat deltas of candidate relative to current, keyed by label.
    // Only computed when both items are present; non-numeric and zero diffs are
    // omitted (matches the gc source).
    private computeDeltas(): Record<string, number> | null {
        if (!this._current || !this._candidate) return null
        const map: Record<string, number> = {}
        const currentStats = (this._current.stats ?? []).filter((s) => typeof s.value === 'number')
        const candidateStats = (this._candidate.stats ?? []).filter(
            (s) => typeof s.value === 'number',
        )
        const allLabels = new Set<string>([
            ...currentStats.map((s) => s.label),
            ...candidateStats.map((s) => s.label),
        ])
        // First occurrence wins, matching the previous .find() behaviour on
        // duplicate labels.
        const firstByLabel = (stats: typeof currentStats): Map<string, number> => {
            const byLabel = new Map<string, number>()
            for (const s of stats) {
                if (!byLabel.has(s.label)) byLabel.set(s.label, s.value as number)
            }
            return byLabel
        }
        const currentByLabel = firstByLabel(currentStats)
        const candidateByLabel = firstByLabel(candidateStats)
        for (const label of allLabels) {
            const diff = (candidateByLabel.get(label) ?? 0) - (currentByLabel.get(label) ?? 0)
            if (diff !== 0) map[label] = diff
        }
        return map
    }

    private renderStats(item: CompareItem): string {
        const rows = (item.stats ?? [])
            .map(
                (s) => `
            <div class="tc-item-compare__stat">
                <span class="tc-item-compare__stat-label">${esc(s.label)}</span>
                <span class="tc-item-compare__stat-value">${esc(formatValue(s.value))}</span>
            </div>
        `,
            )
            .join('')
        return rows ? `<div class="tc-item-compare__stats">${rows}</div>` : ''
    }

    private renderDeltas(deltas: Record<string, number> | null): string {
        if (!deltas) return ''
        const rows = Object.entries(deltas)
            .map(([label, diff]) => {
                const dir = diff > 0 ? 'up' : 'down'
                const arrow = diff > 0 ? arrowUpIcon : arrowDownIcon
                const sign = diff > 0 ? '+' : ''
                return `<div class="tc-item-compare__delta tc-item-compare__delta--${dir}">
                <span class="tc-item-compare__delta-label">${esc(label)}</span>
                <span class="tc-item-compare__delta-value">${arrow}${sign}${diff.toLocaleString()}</span>
            </div>`
            })
            .join('')
        if (!rows) return ''
        return `<div class="tc-item-compare__deltas">
            <tc-eyebrow class="tc-item-compare__deltas-label">Difference</tc-eyebrow>
            ${rows}
        </div>`
    }

    private renderColumn(
        item: CompareItem | null,
        label: string,
        deltas: Record<string, number> | null,
    ): string {
        const labelMarkup = `<tc-eyebrow class="tc-item-compare__col-label">${esc(label)}</tc-eyebrow>`
        if (!item) {
            return `<div class="tc-item-compare__col tc-item-compare__col--empty">
                ${labelMarkup}
                <div class="tc-item-compare__empty" aria-hidden="true">—</div>
            </div>`
        }
        const typeMarkup = item.typeLabel
            ? `<tc-eyebrow class="tc-item-compare__type">${esc(item.typeLabel)}</tc-eyebrow>`
            : ''
        const nameMarkup = `<div class="tc-item-compare__name">${esc(item.name ?? '')}</div>`
        return `<div class="tc-item-compare__col">
            ${labelMarkup}
            <div class="tc-item-compare__item">
                ${typeMarkup}
                ${nameMarkup}
                ${this.renderStats(item)}
            </div>
            ${this.renderDeltas(deltas)}
        </div>`
    }

    private render(): void {
        const deltas = this.computeDeltas()
        this.innerHTML = `<div class="tc-item-compare__grid">
            ${this.renderColumn(this._current, 'Equipped', null)}
            ${this.renderColumn(this._candidate, 'Candidate', deltas)}
        </div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ItemCompare
    }
}

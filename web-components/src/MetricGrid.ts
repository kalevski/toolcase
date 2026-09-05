import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { setHostClass } from './internal/host-class'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-metric-grid'

const COLUMNS = [2, 3, 4] as const
export type MetricGridColumns = 2 | 3 | 4

function resolveIcon(name: string): string {
    const svgStr = (LucideIcons as Record<string, string>)[name]
    return svgStr ? icon(svgStr, 'tc-metric-tile-icon-svg') : ''
}

export interface MetricGridItem {
    key?: string
    label: string
    value: string
    unit?: string
    icon?: string
    hint?: string
}

export class MetricGrid extends HTMLElement {
    private _initialised = false
    private _items: MetricGridItem[] = []

    static get observedAttributes(): string[] {
        return ['columns']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get columns(): MetricGridColumns {
        const v = parseInt(this.getAttribute('columns') ?? '3', 10)
        return (COLUMNS as readonly number[]).includes(v) ? (v as MetricGridColumns) : 3
    }
    set columns(v: MetricGridColumns) {
        this.setAttribute('columns', String(v))
    }

    get items(): MetricGridItem[] {
        return this._items
    }
    set items(v: MetricGridItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private _renderTile(item: MetricGridItem): string {
        const iconSvg = item.icon ? resolveIcon(item.icon) : ''
        const iconHtml = iconSvg
            ? `<span class="tc-metric-tile-icon" aria-hidden="true">${iconSvg}</span>`
            : ''

        const unitHtml = item.unit
            ? `<span class="tc-metric-tile-unit">${esc(item.unit)}</span>`
            : ''

        const valueHtml = [
            '<div class="tc-metric-tile-value-row">',
            `<span class="tc-metric-tile-value">${esc(item.value)}</span>`,
            unitHtml,
            '</div>',
        ].join('')

        const hintHtml = item.hint
            ? `<span class="tc-metric-tile-hint">${esc(item.hint)}</span>`
            : ''

        return [
            '<div class="tc-metric-tile">',
            iconHtml,
            '<div class="tc-metric-tile-body">',
            `<span class="tc-metric-tile-label">${esc(item.label)}</span>`,
            valueHtml,
            hintHtml,
            '</div>',
            '</div>',
        ].join('')
    }

    /** THE HOST IS THE GRID. Tiles built from `items` are element-owned and are
     *  patched in place ahead of whatever the consumer slotted in — which stays a
     *  direct child of the host, exactly where they wrote it (rule 1). */
    private render(): void {
        setHostClass(this, `tc-metric-grid tc-metric-grid--cols-${this.columns}`)
        patchHtml(this, this._items.map((item) => this._renderTile(item)).join(''))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MetricGrid
    }
}

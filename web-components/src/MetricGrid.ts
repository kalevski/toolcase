import { esc } from './internal/esc'
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
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const grid = this.querySelector('.tc-metric-grid')
            if (grid) slotContent.forEach((n) => grid.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
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
        if (this._initialised) this._rerenderWithSlots()
    }

    private _isGenerated(node: Node): boolean {
        return node instanceof Element && node.hasAttribute('data-mg-gen')
    }

    private _rerenderWithSlots(): void {
        const grid = this.querySelector('.tc-metric-grid')
        const slotContent = grid
            ? Array.from(grid.childNodes).filter((n) => !this._isGenerated(n))
            : []
        this.render()
        const newGrid = this.querySelector('.tc-metric-grid')
        if (newGrid) slotContent.forEach((n) => newGrid.appendChild(n))
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
            '<div class="tc-metric-tile" data-mg-gen>',
            iconHtml,
            '<div class="tc-metric-tile-body">',
            `<span class="tc-metric-tile-label">${esc(item.label)}</span>`,
            valueHtml,
            hintHtml,
            '</div>',
            '</div>',
        ].join('')
    }

    private render(): void {
        const cols = this.columns
        const tilesHtml = this._items.map((item) => this._renderTile(item)).join('')
        this.innerHTML = `<div class="tc-metric-grid tc-metric-grid--cols-${cols}">${tilesHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MetricGrid
    }
}

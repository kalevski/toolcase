import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-level-select'

export interface LevelNode {
    id: string
    x: number
    y: number
    label?: string
    icon?: string
    locked?: boolean
    completed?: boolean
    /** Maximum star count for this level (default 3). */
    stars?: number
    /** Best achieved star count. Stars row is hidden when omitted. */
    bestStars?: number
}

export interface LevelEdge {
    from: string
    to: string
}

function resolveLucide(name: string, cls?: string): string {
    const pascal = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    const titled = pascal.charAt(0).toUpperCase() + pascal.slice(1)
    const svgStr = (LucideIcons as Record<string, string>)[titled]
    return svgStr ? icon(svgStr, cls) : ''
}

function firstLucide(names: string[], cls?: string): string {
    for (const name of names) {
        const html = resolveLucide(name, cls)
        if (html) return html
    }
    return ''
}

const LOCK_ICON = firstLucide(['Lock', 'LockKeyhole', 'LockClosed'], 'tc-level-select__glyph-icon')
const CHECK_ICON = firstLucide(
    ['Check', 'CheckCircle2', 'CheckCircle'],
    'tc-level-select__glyph-icon',
)

export class LevelSelect extends HTMLElement {
    private _initialised = false
    private _nodes: LevelNode[] = []
    private _edges: LevelEdge[] = []

    onSelect: ((detail: { id: string }) => void) | null = null
    onConfirm: ((detail: { id: string }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id', 'width', 'height']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    private _numAttr(name: string, fallback: number): number {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(v: string) {
        if (v) this.setAttribute('selected-id', v)
        else this.removeAttribute('selected-id')
    }

    get width(): number {
        return this._numAttr('width', 600)
    }
    set width(v: number) {
        this.setAttribute('width', String(v))
    }

    get height(): number {
        return this._numAttr('height', 360)
    }
    set height(v: number) {
        this.setAttribute('height', String(v))
    }

    get nodes(): LevelNode[] {
        return this._nodes.slice()
    }
    set nodes(v: LevelNode[]) {
        this._nodes = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get edges(): LevelEdge[] {
        return this._edges.slice()
    }
    set edges(v: LevelEdge[]) {
        this._edges = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    private _fireSelect(id: string): void {
        const detail = { id }
        this.dispatchEvent(new CustomEvent('tc-select', { bubbles: true, composed: true, detail }))
        if (typeof this.onSelect === 'function') this.onSelect(detail)
    }

    private _fireConfirm(id: string): void {
        const detail = { id }
        this.dispatchEvent(new CustomEvent('tc-confirm', { bubbles: true, composed: true, detail }))
        if (typeof this.onConfirm === 'function') this.onConfirm(detail)
    }

    private _renderStars(best: number, max: number): string {
        const filled = Math.max(0, Math.min(max, best))
        let stars = ''
        for (let i = 0; i < max; i++) {
            const cls =
                i < filled
                    ? 'tc-level-select__star tc-level-select__star--filled'
                    : 'tc-level-select__star'
            stars += `<span class="${cls}" aria-hidden="true">★</span>`
        }
        return `<span class="tc-level-select__stars" aria-label="${filled} of ${max} stars">${stars}</span>`
    }

    private _renderGlyph(n: LevelNode): string {
        if (n.locked) {
            return LOCK_ICON || '<span class="tc-level-select__glyph-text">—</span>'
        }
        if (n.icon) {
            const resolved = resolveLucide(n.icon, 'tc-level-select__glyph-icon')
            if (resolved) return resolved
        }
        if (n.completed) {
            return CHECK_ICON || '<span class="tc-level-select__glyph-text">✓</span>'
        }
        return '<span class="tc-level-select__glyph-dot" aria-hidden="true"></span>'
    }

    private render(): void {
        const w = this.width
        const h = this.height
        const selected = this.selectedId
        const nodeMap = new Map(this._nodes.map((n) => [n.id, n]))

        const edgesMarkup = this._edges
            .map((e) => {
                const a = nodeMap.get(e.from)
                const b = nodeMap.get(e.to)
                if (!a || !b) return ''
                // completed beats locked when a level is replayed after the far
                // node has since been unlocked and cleared.
                const cls =
                    a.completed && b.completed
                        ? 'tc-level-select__edge tc-level-select__edge--completed'
                        : a.locked || b.locked
                          ? 'tc-level-select__edge tc-level-select__edge--locked'
                          : 'tc-level-select__edge'
                return `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`
            })
            .join('')

        const nodesMarkup = this._nodes
            .map((n) => {
                const isSelected = n.id === selected
                let cls = 'tc-level-select__node'
                if (n.locked) {
                    cls += ' tc-level-select__node--locked'
                } else if (isSelected) {
                    cls += ' tc-level-select__node--selected'
                } else if (n.completed) {
                    cls += ' tc-level-select__node--completed'
                }

                const labelHtml = n.label
                    ? `<span class="tc-level-select__label">${esc(n.label)}</span>`
                    : ''

                const starsHtml =
                    typeof n.bestStars === 'number'
                        ? this._renderStars(n.bestStars, n.stars ?? 3)
                        : ''

                // Nodes are centered on (x, y); SVG edges also target (x, y).
                return `<div
                role="option"
                tabindex="${n.locked ? '-1' : '0'}"
                class="${cls}"
                data-id="${esc(n.id)}"
                aria-selected="${isSelected ? 'true' : 'false'}"
                aria-disabled="${n.locked ? 'true' : 'false'}"
                style="left:${n.x}px;top:${n.y}px;">
                <span class="tc-level-select__glyph">${this._renderGlyph(n)}</span>
                ${labelHtml}
                ${starsHtml}
            </div>`
            })
            .join('')

        if (!this.hasAttribute('role')) this.setAttribute('role', 'listbox')
        if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Level select')

        patchHtml(
            this,
            `
            <div class="tc-level-select__canvas" style="width:${w}px;height:${h}px;">
                <svg class="tc-level-select__edges"
                     viewBox="0 0 ${w} ${h}"
                     width="${w}"
                     height="${h}"
                     aria-hidden="true">${edgesMarkup}</svg>
                ${nodesMarkup}
            </div>
        `,
        )

        // Delegate events on the canvas to avoid per-node listener leaks across re-renders.
        const canvas = this.querySelector<HTMLElement>('.tc-level-select__canvas')
        if (!canvas) return

        bindOnce(canvas, 'click', (e: Event) => {
            const node = (e.target as Element).closest<HTMLElement>('.tc-level-select__node')
            if (!node || node.getAttribute('aria-disabled') === 'true') return
            const id = node.dataset.id ?? ''
            if (!id) return
            this.selectedId = id
            this._fireSelect(id)
        })

        bindOnce(canvas, 'dblclick', (e: Event) => {
            const node = (e.target as Element).closest<HTMLElement>('.tc-level-select__node')
            if (!node || node.getAttribute('aria-disabled') === 'true') return
            const id = node.dataset.id ?? ''
            if (!id) return
            this._fireConfirm(id)
        })

        bindOnce(canvas, 'keydown', (e: KeyboardEvent) => {
            const node = (e.target as Element).closest<HTMLElement>('.tc-level-select__node')
            if (!node || node.getAttribute('aria-disabled') === 'true') return
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                const id = node.dataset.id ?? ''
                if (!id) return
                this.selectedId = id
                this._fireSelect(id)
            }
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LevelSelect
    }
}

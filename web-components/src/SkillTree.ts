import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-skill-tree'

export interface SkillNode {
    id: string
    x: number
    y: number
    label?: string
    icon?: string
    locked?: boolean
    unlocked?: boolean
    rank?: number
    maxRank?: number
    description?: string
}

export interface SkillTreeEdge {
    from: string
    to: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
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

const LOCK_ICON = firstLucide(['Lock', 'LockKeyhole'], 'tc-skill-tree__glyph-icon')

export class SkillTree extends HTMLElement {
    private _initialised = false
    private _nodes: SkillNode[] = []
    private _edges: SkillTreeEdge[] = []

    onSelect: ((detail: { id: string }) => void) | null = null
    onUnlock: ((detail: { id: string }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id', 'points', 'width', 'height']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'tree')
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

    get selectedId(): string { return this.getAttribute('selected-id') ?? '' }
    set selectedId(v: string) {
        if (v) this.setAttribute('selected-id', v)
        else this.removeAttribute('selected-id')
    }

    get points(): number | null {
        const raw = this.getAttribute('points')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set points(v: number | null) {
        if (v == null) this.removeAttribute('points')
        else this.setAttribute('points', String(v))
    }

    get width(): number { return this._numAttr('width', 600) }
    set width(v: number) { this.setAttribute('width', String(v)) }

    get height(): number { return this._numAttr('height', 400) }
    set height(v: number) { this.setAttribute('height', String(v)) }

    get nodes(): SkillNode[] { return this._nodes.slice() }
    set nodes(v: SkillNode[]) {
        this._nodes = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get edges(): SkillTreeEdge[] { return this._edges.slice() }
    set edges(v: SkillTreeEdge[]) {
        this._edges = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    private _fireSelect(id: string): void {
        const detail = { id }
        this.dispatchEvent(new CustomEvent('tc-select', { bubbles: true, composed: true, detail }))
        if (typeof this.onSelect === 'function') this.onSelect(detail)
    }

    private _fireUnlock(id: string): void {
        const detail = { id }
        this.dispatchEvent(new CustomEvent('tc-unlock', { bubbles: true, composed: true, detail }))
        if (typeof this.onUnlock === 'function') this.onUnlock(detail)
    }

    private _renderGlyph(n: SkillNode): string {
        if (n.locked) {
            return LOCK_ICON || '<span class="tc-skill-tree__glyph-text">—</span>'
        }
        if (n.icon) {
            const resolved = resolveLucide(n.icon, 'tc-skill-tree__glyph-icon')
            if (resolved) return resolved
        }
        if (n.unlocked) {
            return firstLucide(['Check', 'CheckCircle2'], 'tc-skill-tree__glyph-icon')
                || '<span class="tc-skill-tree__glyph-dot" aria-hidden="true"></span>'
        }
        return '<span class="tc-skill-tree__glyph-dot" aria-hidden="true"></span>'
    }

    private render(): void {
        const w = this.width
        const h = this.height
        const selected = this.selectedId
        const points = this.points
        const nodeMap = new Map(this._nodes.map(n => [n.id, n]))

        const edgesMarkup = this._edges.map(e => {
            const a = nodeMap.get(e.from)
            const b = nodeMap.get(e.to)
            if (!a || !b) return ''
            const bothUnlocked = a.unlocked && b.unlocked
            const cls = bothUnlocked
                ? 'tc-skill-tree__edge tc-skill-tree__edge--unlocked'
                : 'tc-skill-tree__edge'
            return `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`
        }).join('')

        const nodesMarkup = this._nodes.map(n => {
            const isSelected = n.id === selected
            let cls = 'tc-skill-tree__node'
            if (n.locked) {
                cls += ' tc-skill-tree__node--locked'
            } else if (isSelected) {
                cls += ' tc-skill-tree__node--selected'
            } else if (n.unlocked) {
                cls += ' tc-skill-tree__node--unlocked'
            }

            const labelHtml = n.label
                ? `<span class="tc-skill-tree__label">${esc(n.label)}</span>`
                : ''

            const rankHtml = (typeof n.rank === 'number' && typeof n.maxRank === 'number')
                ? `<span class="tc-skill-tree__rank">${n.rank}/${n.maxRank}</span>`
                : ''

            const titleAttr = n.description
                ? ` title="${esc(n.description)}"`
                : ''

            return `<div
                role="treeitem"
                tabindex="${n.locked ? '-1' : '0'}"
                class="${cls}"
                data-id="${esc(n.id)}"
                aria-selected="${isSelected ? 'true' : 'false'}"
                aria-disabled="${n.locked ? 'true' : 'false'}"${titleAttr}
                style="left:${n.x}px;top:${n.y}px;">
                <span class="tc-skill-tree__glyph">${this._renderGlyph(n)}</span>
                ${labelHtml}
                ${rankHtml}
            </div>`
        }).join('')

        const pointsHtml = points != null
            ? `<div class="tc-skill-tree__points">
                <span class="tc-skill-tree__points-label">Points</span>
                <span class="tc-skill-tree__points-value">${points}</span>
               </div>`
            : ''

        this.innerHTML = `
            ${pointsHtml}
            <div class="tc-skill-tree__canvas" style="width:${w}px;height:${h}px;">
                <svg class="tc-skill-tree__edges"
                     viewBox="0 0 ${w} ${h}"
                     width="${w}"
                     height="${h}"
                     aria-hidden="true">${edgesMarkup}</svg>
                ${nodesMarkup}
            </div>
        `

        const canvas = this.querySelector<HTMLElement>('.tc-skill-tree__canvas')
        if (!canvas) return

        canvas.addEventListener('click', (e: Event) => {
            const node = (e.target as Element).closest<HTMLElement>('.tc-skill-tree__node')
            if (!node || node.getAttribute('aria-disabled') === 'true') return
            const id = node.dataset.id ?? ''
            if (!id) return
            this.selectedId = id
            this._fireSelect(id)
        })

        canvas.addEventListener('dblclick', (e: Event) => {
            const node = (e.target as Element).closest<HTMLElement>('.tc-skill-tree__node')
            if (!node || node.getAttribute('aria-disabled') === 'true') return
            const id = node.dataset.id ?? ''
            if (!id) return
            this.selectedId = id
            this._fireUnlock(id)
        })

        canvas.addEventListener('keydown', (e: KeyboardEvent) => {
            const node = (e.target as Element).closest<HTMLElement>('.tc-skill-tree__node')
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
    interface HTMLElementTagNameMap { [TAG_NAME]: SkillTree }
}

const TAG_NAME = 'gc-skill-tree'

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

export interface SkillTreeEventMap {
    select: CustomEvent<{ id: string }>
    unlock: CustomEvent<{ id: string }>
}

export class SkillTree extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id', 'points', 'width', 'height']
    }

    private _nodes: SkillNode[] = []
    private _edges: SkillTreeEdge[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'tree')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    private numberAttr(name: string, fallback: number): number {
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

    get width(): number { return this.numberAttr('width', 600) }
    set width(v: number) { this.setAttribute('width', String(v)) }

    get height(): number { return this.numberAttr('height', 400) }
    set height(v: number) { this.setAttribute('height', String(v)) }

    get nodes(): SkillNode[] {
        return this._nodes.slice()
    }
    set nodes(value: SkillNode[]) {
        this._nodes = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    get edges(): SkillTreeEdge[] {
        return this._edges.slice()
    }
    set edges(value: SkillTreeEdge[]) {
        this._edges = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const w = this.width
        const h = this.height
        const selected = this.selectedId
        const points = this.points
        const nodeMap = new Map(this._nodes.map((n) => [n.id, n]))

        const edgesMarkup = this._edges.map((e) => {
            const a = nodeMap.get(e.from)
            const b = nodeMap.get(e.to)
            if (!a || !b) return ''
            const unlocked = a.unlocked && b.unlocked
            const cls = `gc-skill-tree-edge${unlocked ? ' is-unlocked' : ''}`
            return `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`
        }).join('')

        const nodesMarkup = this._nodes.map((n) => {
            const isSelected = n.id === selected
            const stateCls = n.locked ? ' is-locked' : (n.unlocked ? ' is-unlocked' : '')
            const cls = `gc-skill-tree-node${isSelected ? ' is-selected' : ''}${stateCls}`
            const tabindex = n.locked ? '-1' : '0'
            const rankMarkup = (typeof n.rank === 'number' && typeof n.maxRank === 'number')
                ? `<div class="gc-skill-tree-rank">${n.rank}/${n.maxRank}</div>`
                : ''
            const labelMarkup = n.label
                ? `<div class="gc-skill-tree-label">${this.escape(n.label)}</div>`
                : ''
            const icon = n.locked ? '🔒' : (n.icon || '✦')
            return `<div role="treeitem" tabindex="${tabindex}" class="${cls}" data-id="${this.escape(n.id)}" aria-selected="${isSelected ? 'true' : 'false'}" aria-disabled="${n.locked ? 'true' : 'false'}" style="left:${n.x}px;top:${n.y}px;">
                <div class="gc-skill-tree-glyph">${this.escape(icon)}</div>
                ${labelMarkup}
                ${rankMarkup}
            </div>`
        }).join('')

        const pointsMarkup = points != null
            ? `<div class="gc-skill-tree-points"><gc-eyebrow class="gc-skill-tree-points-eyebrow">Points</gc-eyebrow><span class="gc-skill-tree-points-value">${points}</span></div>`
            : ''

        this.innerHTML = `
            ${pointsMarkup}
            <div class="gc-skill-tree-canvas" style="width:${w}px;height:${h}px;">
                <svg class="gc-skill-tree-edges" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${edgesMarkup}</svg>
                ${nodesMarkup}
            </div>
        `

        this.querySelectorAll<HTMLElement>('.gc-skill-tree-node').forEach((el) => {
            const id = el.dataset.id || ''
            const node = nodeMap.get(id)
            if (!node || node.locked) return
            el.addEventListener('click', () => {
                this.selectedId = id
                this.emit('select', { id })
            })
            el.addEventListener('dblclick', () => {
                this.selectedId = id
                this.emit('unlock', { id })
            })
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    this.selectedId = id
                    this.emit('select', { id })
                }
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, SkillTree)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SkillTree
    }
}

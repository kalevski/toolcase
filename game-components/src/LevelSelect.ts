const TAG_NAME = 'gc-level-select'

export interface LevelNode {
    id: string
    x: number
    y: number
    label?: string
    icon?: string
    locked?: boolean
    completed?: boolean
    stars?: number
    bestStars?: number
}

export interface LevelEdge {
    from: string
    to: string
}

export interface LevelSelectEventMap {
    select: CustomEvent<{ id: string }>
    confirm: CustomEvent<{ id: string }>
}

export class LevelSelect extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id', 'width', 'height']
    }

    private _nodes: LevelNode[] = []
    private _edges: LevelEdge[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'listbox')
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

    get width(): number { return this.numberAttr('width', 600) }
    set width(v: number) { this.setAttribute('width', String(v)) }

    get height(): number { return this.numberAttr('height', 360) }
    set height(v: number) { this.setAttribute('height', String(v)) }

    get nodes(): LevelNode[] {
        return this._nodes.slice()
    }
    set nodes(value: LevelNode[]) {
        this._nodes = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    get edges(): LevelEdge[] {
        return this._edges.slice()
    }
    set edges(value: LevelEdge[]) {
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

    private renderStars(stars: number, max: number): string {
        const filled = Math.max(0, Math.min(max, stars))
        let out = ''
        for (let i = 0; i < max; i++) {
            out += i < filled
                ? `<span class="gc-level-select-star is-filled">★</span>`
                : `<span class="gc-level-select-star">☆</span>`
        }
        return out
    }

    private render(): void {
        const w = this.width
        const h = this.height
        const selected = this.selectedId
        const nodeMap = new Map(this._nodes.map((n) => [n.id, n]))

        const edgesMarkup = this._edges.map((e) => {
            const a = nodeMap.get(e.from)
            const b = nodeMap.get(e.to)
            if (!a || !b) return ''
            const completed = a.completed && b.completed
            const cls = `gc-level-select-edge${completed ? ' is-completed' : ''}`
            return `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`
        }).join('')

        const nodesMarkup = this._nodes.map((n) => {
            const isSelected = n.id === selected
            const stateCls = n.locked ? ' is-locked' : (n.completed ? ' is-completed' : '')
            const cls = `gc-level-select-node${isSelected ? ' is-selected' : ''}${stateCls}`
            const tabindex = n.locked ? '-1' : '0'
            const starsMarkup = (typeof n.bestStars === 'number')
                ? `<div class="gc-level-select-stars">${this.renderStars(n.bestStars, n.stars ?? 3)}</div>`
                : ''
            const labelMarkup = n.label
                ? `<div class="gc-level-select-label">${this.escape(n.label)}</div>`
                : ''
            const icon = n.locked ? '🔒' : (n.icon || (n.completed ? '✓' : '◆'))
            return `<div role="option" tabindex="${tabindex}" class="${cls}" data-id="${this.escape(n.id)}" aria-selected="${isSelected ? 'true' : 'false'}" aria-disabled="${n.locked ? 'true' : 'false'}" style="left:${n.x}px;top:${n.y}px;">
                <div class="gc-level-select-glyph">${this.escape(icon)}</div>
                ${labelMarkup}
                ${starsMarkup}
            </div>`
        }).join('')

        this.innerHTML = `
            <div class="gc-level-select-canvas" style="width:${w}px;height:${h}px;">
                <svg class="gc-level-select-edges" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${edgesMarkup}</svg>
                ${nodesMarkup}
            </div>
        `

        this.querySelectorAll<HTMLElement>('.gc-level-select-node').forEach((el) => {
            const id = el.dataset.id || ''
            const node = nodeMap.get(id)
            if (!node || node.locked) return
            el.addEventListener('click', () => {
                this.selectedId = id
                this.emit('select', { id })
            })
            el.addEventListener('dblclick', () => {
                this.selectedId = id
                this.emit('confirm', { id })
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
    customElements.define(TAG_NAME, LevelSelect)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LevelSelect
    }
}

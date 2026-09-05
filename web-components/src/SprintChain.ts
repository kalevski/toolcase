import { patchHtml } from './internal/patch-html'
import { adoptChildren, adoptedChildren } from './internal/adopt-children'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-sprint-chain'

// `slot="header"`/`slot="header-end"` name the region a consumer child belongs
// in; anything else is left where it is (this component renders nothing else).
function slotOf(node: Node): string {
    if (!(node instanceof Element)) return ''
    const s = node.getAttribute('slot')
    return s === 'header' || s === 'header-end' ? s : ''
}

export type SprintChainState = 'past' | 'now' | 'future'

export interface SprintChainItem {
    id: string
    label: string
    tag?: string
    state?: SprintChainState
}

function deriveState(items: SprintChainItem[], currentId: string, idx: number): SprintChainState {
    const currentIdx = items.findIndex((it) => it.id === currentId)
    if (currentIdx < 0) return 'future'
    if (idx < currentIdx) return 'past'
    if (idx === currentIdx) return 'now'
    return 'future'
}

export class SprintChain extends HTMLElement {
    private _initialised = false
    private _items: SprintChainItem[] = []

    static get observedAttributes(): string[] {
        return ['current-id', 'columns']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            const hasHeader = slotContent.some((n) => slotOf(n) !== '')

            this.render(hasHeader)
            this._adopt(slotContent)

            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get currentId(): string | null {
        return this.getAttribute('current-id')
    }
    set currentId(v: string | null) {
        if (v != null) this.setAttribute('current-id', v)
        else this.removeAttribute('current-id')
    }

    get columns(): number | null {
        const v = this.getAttribute('columns')
        if (v === null) return null
        const n = parseInt(v, 10)
        return isNaN(n) ? null : n
    }
    set columns(v: number | null) {
        if (v != null) this.setAttribute('columns', String(v))
        else this.removeAttribute('columns')
    }

    get items(): SprintChainItem[] {
        return this._items
    }
    set items(v: SprintChainItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        // The header/header-end slots were adopted into nested containers on
        // connect (see adopt-children.ts), so they are no longer direct
        // children of the host — adoptedChildren() finds them regardless of
        // depth, and re-adopting after the container is rebuilt (or a new
        // child arrives) re-homes everything into the fresh nodes.
        const nodes = adoptedChildren(this)
        const hasHeader = nodes.some((n) => slotOf(n) !== '')

        this.render(hasHeader)
        this._adopt(nodes)
    }

    /** The consumer's header/header-end slot content — see adopt-children.ts. */
    private _adopt(nodes?: Node[]): void {
        adoptChildren(
            this,
            (node) => {
                const slot = slotOf(node)
                if (slot === 'header') return this.querySelector('.tc-sprint-chain-header-start')
                if (slot === 'header-end') return this.querySelector('.tc-sprint-chain-header-end')
                return null
            },
            nodes,
        )
    }

    private render(showHeader: boolean): void {
        const currentId = this.getAttribute('current-id') ?? ''
        const colsAttr = this.getAttribute('columns')
        const cols = colsAttr ? Math.max(1, parseInt(colsAttr, 10) || 1) : this._items.length || 1

        const headerHtml = showHeader
            ? `<div class="tc-sprint-chain-header"><div class="tc-sprint-chain-header-start"></div><div class="tc-sprint-chain-header-end"></div></div>`
            : ''

        const itemsHtml = this._items
            .map((it, i) => {
                const state = it.state ?? deriveState(this._items, currentId, i)
                const ariaCurrent = state === 'now' ? ' aria-current="step"' : ''
                // `columns` wraps the grid onto multiple rows, so `:first-child`/
                // `:last-child` alone can't tell a connector when to stop — every
                // row-wrapped item but the true first/last is neither. Compute
                // row position from the same `cols` the grid itself uses so the
                // connector hairline never bridges across a row wrap.
                const isRowStart = i % cols === 0
                const isRowEnd = i % cols === cols - 1 || i === this._items.length - 1
                const rowClass =
                    (isRowStart ? ' tc-sprint-chain-item-row-start' : '') +
                    (isRowEnd ? ' tc-sprint-chain-item-row-end' : '')
                const tagHtml =
                    it.tag != null ? `<span class="tc-sprint-chain-tag">${esc(it.tag)}</span>` : ''
                return (
                    `<li class="tc-sprint-chain-item tc-sprint-chain-item-${state}${rowClass}"${ariaCurrent}>` +
                    `<span class="tc-sprint-chain-node" aria-hidden="true"></span>` +
                    `<span class="tc-sprint-chain-label">${esc(it.label)}</span>` +
                    tagHtml +
                    `</li>`
                )
            })
            .join('')

        patchHtml(
            this,
            `<div class="tc-sprint-chain">` +
                headerHtml +
                `<ol class="tc-sprint-chain-items" style="--cols:${cols}">${itemsHtml}</ol>` +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SprintChain
    }
}

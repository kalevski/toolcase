import { esc } from './internal/esc'
const TAG_NAME = 'tc-sprint-chain'

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
            const headerNodes = Array.from(this.querySelectorAll('[slot="header"]'))
            const headerEndNodes = Array.from(this.querySelectorAll('[slot="header-end"]'))
            const hasHeader = headerNodes.length > 0 || headerEndNodes.length > 0

            this.render(hasHeader)

            if (hasHeader) {
                const startEl = this.querySelector('.tc-sprint-chain-header-start')
                if (startEl) headerNodes.forEach((n) => startEl.appendChild(n))
                const endEl = this.querySelector('.tc-sprint-chain-header-end')
                if (endEl) headerEndNodes.forEach((n) => endEl.appendChild(n))
            }

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
        const headerNodes = Array.from(
            this.querySelectorAll('.tc-sprint-chain-header-start [slot="header"]'),
        )
        const headerEndNodes = Array.from(
            this.querySelectorAll('.tc-sprint-chain-header-end [slot="header-end"]'),
        )
        const hasHeader = headerNodes.length > 0 || headerEndNodes.length > 0

        this.render(hasHeader)

        if (hasHeader) {
            const startEl = this.querySelector('.tc-sprint-chain-header-start')
            if (startEl) headerNodes.forEach((n) => startEl.appendChild(n))
            const endEl = this.querySelector('.tc-sprint-chain-header-end')
            if (endEl) headerEndNodes.forEach((n) => endEl.appendChild(n))
        }
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
                const tagHtml =
                    it.tag != null ? `<span class="tc-sprint-chain-tag">${esc(it.tag)}</span>` : ''
                return (
                    `<li class="tc-sprint-chain-item tc-sprint-chain-item-${state}"${ariaCurrent}>` +
                    `<span class="tc-sprint-chain-node" aria-hidden="true"></span>` +
                    `<span class="tc-sprint-chain-label">${esc(it.label)}</span>` +
                    tagHtml +
                    `</li>`
                )
            })
            .join('')

        this.innerHTML =
            `<div class="tc-sprint-chain">` +
            headerHtml +
            `<ol class="tc-sprint-chain-items" style="--cols:${cols}">${itemsHtml}</ol>` +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SprintChain
    }
}

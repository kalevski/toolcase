import { esc } from './internal/esc'
import { msg } from './messages'

const TAG_NAME = 'tc-pagination'

export type PaginationSize = 'sm' | 'lg'
export type PaginationAlign = 'start' | 'center' | 'end'

const ALIGNS: PaginationAlign[] = ['start', 'center', 'end']

export class Pagination extends HTMLElement {
    private _onClick: (e: Event) => void

    static get observedAttributes(): string[] {
        return ['total', 'current', 'size', 'max-visible', 'align']
    }

    constructor() {
        super()
        this._onClick = (e: Event) => {
            const target = (e.target as HTMLElement).closest('[data-page]') as HTMLElement | null
            if (!target) return
            e.preventDefault()

            const page = parseInt(target.dataset['page'] ?? '', 10)
            if (isNaN(page) || page === this.current) return

            this.setAttribute('current', String(page))
            this.dispatchEvent(
                new CustomEvent('tc-page-change', {
                    bubbles: true,
                    composed: true,
                    detail: { page },
                }),
            )
        }
    }

    connectedCallback(): void {
        this.addEventListener('click', this._onClick)
        this.render()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get total(): number {
        return Math.max(1, parseInt(this.getAttribute('total') ?? '1', 10) || 1)
    }
    set total(v: number) {
        this.setAttribute('total', String(v))
    }

    get current(): number {
        const c = parseInt(this.getAttribute('current') ?? '1', 10) || 1
        return Math.min(Math.max(1, c), this.total)
    }
    set current(v: number) {
        this.setAttribute('current', String(v))
    }

    get size(): PaginationSize | null {
        const v = this.getAttribute('size') as PaginationSize
        return v === 'sm' || v === 'lg' ? v : null
    }
    set size(v: PaginationSize | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    get maxVisible(): number {
        const v = parseInt(this.getAttribute('max-visible') ?? '7', 10) || 7
        return Math.max(3, v)
    }
    set maxVisible(v: number) {
        this.setAttribute('max-visible', String(v))
    }

    get align(): PaginationAlign | null {
        const v = this.getAttribute('align') as PaginationAlign
        return ALIGNS.includes(v) ? v : null
    }
    set align(v: PaginationAlign | null) {
        if (v != null) this.setAttribute('align', v)
        else this.removeAttribute('align')
    }

    private _computePages(): Array<number | '...'> {
        const total = this.total
        const current = this.current
        const maxVisible = this.maxVisible

        if (total <= maxVisible) {
            return Array.from({ length: total }, (_, i) => i + 1)
        }

        // Show first, last, current ± neighbours; fill gaps with ellipsis
        const sideCount = Math.max(1, Math.floor((maxVisible - 3) / 2))
        const pages: Array<number | '...'> = []

        const rangeStart = Math.min(Math.max(2, current - sideCount), total - sideCount * 2 - 1)
        const rangeEnd = Math.max(Math.min(total - 1, current + sideCount), sideCount * 2 + 2)

        pages.push(1)
        if (rangeStart > 2) pages.push('...')
        for (let p = rangeStart; p <= rangeEnd; p++) pages.push(p)
        if (rangeEnd < total - 1) pages.push('...')
        pages.push(total)

        return pages
    }

    private render(): void {
        const total = this.total
        const current = this.current
        const size = this.size
        const align = this.align
        const pages = this._computePages()

        const sizeClass = size ? ` pagination-${size}` : ''
        const prevDisabled = current === 1
        const nextDisabled = current === total

        const pageItems = pages
            .map((p) => {
                if (p === '...') {
                    return `<li class="page-item disabled"><span class="page-link">&hellip;</span></li>`
                }
                const active = p === current ? ' active' : ''
                const ariaCurrent = p === current ? ' aria-current="page"' : ''
                return `<li class="page-item${active}"${ariaCurrent}><a class="page-link" href="#" data-page="${p}">${p}</a></li>`
            })
            .join('')

        const ul =
            `<ul class="pagination${sizeClass}">` +
            `<li class="page-item${prevDisabled ? ' disabled' : ''}">` +
            `<a class="page-link" href="#" data-page="${current - 1}" aria-label="${esc(msg('paginationPrevious'))}">&laquo;</a></li>` +
            pageItems +
            `<li class="page-item${nextDisabled ? ' disabled' : ''}">` +
            `<a class="page-link" href="#" data-page="${current + 1}" aria-label="${esc(msg('paginationNext'))}">&raquo;</a></li>` +
            `</ul>`

        const nav = `<nav aria-label="${esc(msg('paginationLabel'))}">${ul}</nav>`

        if (align) {
            this.innerHTML = `<div class="d-flex justify-content-${align}">${nav}</div>`
        } else {
            this.innerHTML = nav
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Pagination
    }
}

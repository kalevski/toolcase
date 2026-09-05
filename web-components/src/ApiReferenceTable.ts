import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-api-reference-table'

export interface ApiItem {
    name: string
    signature?: string
    returns?: string
    description?: string
    deprecated?: boolean | string
}

export interface ApiReferenceGroup {
    category: string
    items: ApiItem[]
}

const deprecationIconHtml = lucideByName('triangle-alert')

export class ApiReferenceTable extends HTMLElement {
    private _initialised = false
    private _groups: ApiReferenceGroup[] = []
    private _items: ApiItem[] = []

    static get observedAttributes(): string[] {
        return ['title']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get groups(): ApiReferenceGroup[] {
        return this._groups
    }
    set groups(v: ApiReferenceGroup[]) {
        this._groups = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get items(): ApiItem[] {
        return this._items
    }
    set items(v: ApiItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string | null) {
        if (v != null) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    private _rerenderWithSlots(): void {
        this.render()
    }

    private _renderItem(item: ApiItem): string {
        const isDepr = item.deprecated === true || typeof item.deprecated === 'string'
        const rowClass = isDepr ? ' class="tc-api-item--deprecated"' : ''

        const nameHtml = `<td class="tc-api-name"><code>${esc(item.name)}</code></td>`

        const sigHtml = item.signature
            ? `<td class="tc-api-signature"><code>${esc(item.signature)}</code></td>`
            : `<td class="tc-api-signature"></td>`

        const retsHtml = item.returns
            ? `<td class="tc-api-returns"><code>${esc(item.returns)}</code></td>`
            : `<td class="tc-api-returns"></td>`

        let descContent = ''
        if (item.description) {
            descContent += `<p class="tc-api-reference-desc">${esc(item.description)}</p>`
        }
        if (isDepr) {
            descContent += `<span class="tc-api-deprecated-badge" role="note">${deprecationIconHtml}<span>Deprecated</span></span>`
            if (typeof item.deprecated === 'string') {
                descContent += `<p class="tc-api-deprecated-note">${esc(item.deprecated)}</p>`
            }
        }
        const descHtml = `<td class="tc-api-desc">${descContent}</td>`

        return `<tr${rowClass}>${nameHtml}${sigHtml}${retsHtml}${descHtml}</tr>`
    }

    private _renderGroup(group: ApiReferenceGroup, showHeading: boolean): string {
        const headingHtml =
            showHeading && group.category
                ? `<div class="tc-api-reference-group-heading">${esc(group.category)}</div>`
                : ''

        const rowsHtml = group.items.map((item) => this._renderItem(item)).join('')

        const tableHtml =
            `<table class="table tc-api-reference-table-table">` +
            `<thead><tr>` +
            `<th scope="col">Name</th>` +
            `<th scope="col">Signature</th>` +
            `<th scope="col">Returns</th>` +
            `<th scope="col">Description</th>` +
            `</tr></thead>` +
            `<tbody>${rowsHtml}</tbody>` +
            `</table>`

        return `<div class="tc-api-reference-group">${headingHtml}${tableHtml}</div>`
    }

    private render(): void {
        const titleAttr = this.getAttribute('title')
        // A slotted title stays the consumer's own child at the top of the host and
        // is dressed by CSS; only an attribute title is element-owned (rule 1).
        const titleHtml =
            titleAttr != null
                ? `<div class="tc-api-reference-table-title">${esc(titleAttr)}</div>`
                : ''

        let groupsToRender: ApiReferenceGroup[]
        let showHeadings: boolean

        if (this._groups.length > 0) {
            groupsToRender = this._groups
            showHeadings = true
        } else if (this._items.length > 0) {
            groupsToRender = [{ category: '', items: this._items }]
            showHeadings = false
        } else {
            groupsToRender = []
            showHeadings = false
        }

        const groupsHtml = groupsToRender.map((g) => this._renderGroup(g, showHeadings)).join('')

        setHostClass(this, 'tc-api-reference-table')
        patchHtml(this, `${titleHtml}${groupsHtml}`, { at: 'end' })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ApiReferenceTable
    }
}

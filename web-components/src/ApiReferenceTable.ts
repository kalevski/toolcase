import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

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

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

const deprecationIconHtml = lucideByName('triangle-alert')

export class ApiReferenceTable extends HTMLElement {
    private _initialised = false
    private _groups: ApiReferenceGroup[] = []
    private _items: ApiItem[] = []
    private _titleNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('title')) {
                this._titleNodes = Array.from(this.childNodes)
            }
            this.render()
            if (!this.hasAttribute('title')) {
                const titleEl = this.querySelector('.tc-api-reference-table-title')
                if (titleEl) this._titleNodes.forEach(n => titleEl.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
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
        if (!this.hasAttribute('title')) {
            const titleEl = this.querySelector('.tc-api-reference-table-title')
            if (titleEl) this._titleNodes = Array.from(titleEl.childNodes)
        }
        this.render()
        if (!this.hasAttribute('title')) {
            const newTitleEl = this.querySelector('.tc-api-reference-table-title')
            if (newTitleEl) this._titleNodes.forEach(n => newTitleEl.appendChild(n))
        }
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
        const headingHtml = showHeading && group.category
            ? `<div class="tc-api-reference-group-heading">${esc(group.category)}</div>`
            : ''

        const rowsHtml = group.items.map(item => this._renderItem(item)).join('')

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
        const titleInner = titleAttr != null ? esc(titleAttr) : ''
        const titleHtml = `<div class="tc-api-reference-table-title">${titleInner}</div>`

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

        const groupsHtml = groupsToRender
            .map(g => this._renderGroup(g, showHeadings))
            .join('')

        this.innerHTML = `<div class="tc-api-reference-table">${titleHtml}${groupsHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ApiReferenceTable
    }
}

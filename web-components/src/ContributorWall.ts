import { patchHtml } from './internal/patch-html'
import { deriveInitials } from './internal/initials'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-contributor-wall'

export interface Contributor {
    name: string
    avatarUrl?: string
    profileUrl?: string
    contributions?: number
}

export class ContributorWall extends HTMLElement {
    private _initialised = false
    private _contributors: Contributor[] = []

    static get observedAttributes(): string[] {
        return ['max-visible', 'title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const hasTitleAttr = this.hasAttribute('title')
            const slotNodes = hasTitleAttr
                ? []
                : Array.from(this.querySelectorAll('[slot="title"]'))
            this.render()
            if (!hasTitleAttr) {
                const slot = this.querySelector('.tc-contributor-wall-title-slot')
                if (slot) slotNodes.forEach((n) => slot.appendChild(n))
                this._updateHeaderVisibility()
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get contributors(): Contributor[] {
        return this._contributors
    }
    set contributors(v: Contributor[]) {
        this._contributors = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get maxVisible(): number | null {
        const raw = this.getAttribute('max-visible')
        if (raw === null) return null
        const n = parseInt(raw, 10)
        return isNaN(n) || n < 0 ? null : n
    }
    set maxVisible(v: number | null) {
        if (v != null) this.setAttribute('max-visible', String(v))
        else this.removeAttribute('max-visible')
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    private _rerenderWithSlots(): void {
        const hasTitleAttr = this.hasAttribute('title')
        const slot = this.querySelector('.tc-contributor-wall-title-slot')
        const slotNodes =
            !hasTitleAttr && slot ? Array.from(slot.querySelectorAll('[slot="title"]')) : []
        this.render()
        if (!hasTitleAttr) {
            const newSlot = this.querySelector('.tc-contributor-wall-title-slot')
            if (newSlot) slotNodes.forEach((n) => newSlot.appendChild(n))
            this._updateHeaderVisibility()
        }
    }

    private _updateHeaderVisibility(): void {
        const header = this.querySelector(
            '.tc-contributor-wall__header--slot',
        ) as HTMLElement | null
        if (!header) return
        const slot = header.querySelector('.tc-contributor-wall-title-slot')
        if (slot && slot.hasChildNodes()) {
            header.style.removeProperty('display')
        } else {
            header.style.display = 'none'
        }
    }

    private _itemHtml(c: Contributor): string {
        const accessibleLabel =
            c.contributions != null
                ? `${esc(c.name)} — ${c.contributions} contributions`
                : esc(c.name)

        let inner: string
        if (c.avatarUrl) {
            inner = `<img class="tc-contributor-wall-item__img" src="${esc(c.avatarUrl)}" alt="" loading="lazy">`
        } else {
            inner = `<span class="tc-contributor-wall-item__initials" aria-hidden="true">${esc(deriveInitials(c.name, '?'))}</span>`
        }

        if (c.profileUrl) {
            return (
                `<a class="tc-contributor-wall-item" href="${esc(c.profileUrl)}" ` +
                `target="_blank" rel="noopener noreferrer" role="listitem" ` +
                `aria-label="${accessibleLabel}" title="${accessibleLabel}">${inner}</a>`
            )
        }
        return (
            `<span class="tc-contributor-wall-item" role="listitem" ` +
            `aria-label="${accessibleLabel}" title="${accessibleLabel}">${inner}</span>`
        )
    }

    private render(): void {
        this.classList.add('tc-contributor-wall')

        const titleAttr = this.getAttribute('title')
        const hasTitleAttr = titleAttr != null
        const maxVisible = this.maxVisible
        const contributors = this._contributors

        let headerHtml = ''
        if (hasTitleAttr) {
            if (titleAttr) {
                headerHtml =
                    `<div class="tc-contributor-wall__header">` +
                    `<h3 class="tc-contributor-wall__title">${esc(titleAttr)}</h3></div>`
            }
        } else {
            headerHtml =
                `<div class="tc-contributor-wall__header tc-contributor-wall__header--slot" style="display:none">` +
                `<span class="tc-contributor-wall-title-slot"></span></div>`
        }

        const hasOverflow = maxVisible != null && contributors.length > maxVisible
        const visible = hasOverflow ? contributors.slice(0, maxVisible!) : contributors
        const overflowCount = hasOverflow ? contributors.length - maxVisible! : 0

        const itemsHtml = visible.map((c) => this._itemHtml(c)).join('')

        const moreHtml =
            overflowCount > 0
                ? `<span class="tc-contributor-wall-more" ` +
                  `aria-label="${overflowCount} more contributors" ` +
                  `title="${overflowCount} more contributors">+${overflowCount}</span>`
                : ''

        patchHtml(
            this,
            `${headerHtml}` +
                `<div class="tc-contributor-wall-grid" role="list">` +
                `${itemsHtml}${moreHtml}</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ContributorWall
    }
}

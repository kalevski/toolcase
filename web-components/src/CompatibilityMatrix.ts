import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-compatibility-matrix'

export type CompatStatus = 'yes' | 'no' | 'partial' | 'unknown'
const STATUSES: CompatStatus[] = ['yes', 'no', 'partial', 'unknown']

// Module-level icon constants — resolved once at load time.
const checkIconHtml = lucideByName('check')
const xIconHtml = lucideByName('x')
const minusIconHtml = lucideByName('minus')
const helpCircleIconHtml = lucideByName('help-circle')

function statusIconHtml(status: CompatStatus): string {
    switch (status) {
        case 'yes':
            return checkIconHtml
        case 'no':
            return xIconHtml
        case 'partial':
            return minusIconHtml
        case 'unknown':
            return helpCircleIconHtml
    }
}

function statusText(status: CompatStatus): string {
    switch (status) {
        case 'yes':
            return 'Supported'
        case 'no':
            return 'Not supported'
        case 'partial':
            return 'Partial support'
        case 'unknown':
            return 'Unknown'
    }
}

function renderStatusCell(status: CompatStatus): string {
    return (
        `<span class="tc-compatibility-matrix__indicator tc-compatibility-matrix__indicator--${status}">` +
        statusIconHtml(status) +
        `<span class="tc-compatibility-matrix__sr-only">${statusText(status)}</span>` +
        `</span>`
    )
}

export class CompatibilityMatrix extends HTMLElement {
    private _initialised = false
    private _versions: string[] = []
    private _platforms: string[] = []
    private _support: Record<string, Record<string, CompatStatus>> = {}
    private _titleSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('title')) {
                this._titleSlotNodes = Array.from(this.querySelectorAll('[slot="title"]'))
            }
            this.render()
            const slot = this.querySelector('.tc-compatibility-matrix__title-slot')
            if (slot) this._titleSlotNodes.forEach((n) => slot.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string | null) {
        if (v != null) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get versions(): string[] {
        return this._versions
    }
    set versions(v: string[]) {
        this._versions = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get platforms(): string[] {
        return this._platforms
    }
    set platforms(v: string[]) {
        this._platforms = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get support(): Record<string, Record<string, CompatStatus>> {
        return this._support
    }
    set support(v: Record<string, Record<string, CompatStatus>>) {
        this._support = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
        if (this._initialised) this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        const slotContainer = this.querySelector('.tc-compatibility-matrix__title-slot')
        if (slotContainer) {
            this._titleSlotNodes = Array.from(slotContainer.querySelectorAll('[slot="title"]'))
        }
        this.render()
        const newSlot = this.querySelector('.tc-compatibility-matrix__title-slot')
        if (newSlot) this._titleSlotNodes.forEach((n) => newSlot.appendChild(n))
    }

    private render(): void {
        const titleAttr = this.getAttribute('title')
        const versions = this._versions
        const platforms = this._platforms
        const support = this._support

        // Header: attribute title wins; fall back to named slot container.
        let headerHtml = ''
        if (titleAttr) {
            headerHtml =
                `<div class="tc-compatibility-matrix__header">` +
                `<p class="tc-compatibility-matrix__title">${esc(titleAttr)}</p>` +
                `</div>`
        } else if (this._titleSlotNodes.length > 0) {
            headerHtml =
                `<div class="tc-compatibility-matrix__header">` +
                `<div class="tc-compatibility-matrix__title-slot"></div>` +
                `</div>`
        }

        // Table head: corner + platform columns.
        const platformHeadCells = platforms
            .map(
                (p) =>
                    `<th scope="col" class="tc-compatibility-matrix__cell tc-compatibility-matrix__platform-head">` +
                    `<span class="tc-compatibility-matrix__platform-label">${esc(p)}</span>` +
                    `</th>`,
            )
            .join('')

        const theadHtml =
            `<thead>` +
            `<tr class="tc-compatibility-matrix__head-row">` +
            `<th scope="col" class="tc-compatibility-matrix__cell tc-compatibility-matrix__corner"></th>` +
            platformHeadCells +
            `</tr>` +
            `</thead>`

        // Table body: one row per version.
        const tbodyHtml = versions
            .map((v) => {
                const statusCells = platforms
                    .map((p) => {
                        const raw = support[v]?.[p]
                        const status: CompatStatus = STATUSES.includes(raw as CompatStatus)
                            ? (raw as CompatStatus)
                            : 'unknown'
                        return (
                            `<td class="tc-compatibility-matrix__cell tc-compatibility-matrix__status-cell">` +
                            renderStatusCell(status) +
                            `</td>`
                        )
                    })
                    .join('')

                return (
                    `<tr class="tc-compatibility-matrix__row">` +
                    `<th scope="row" class="tc-compatibility-matrix__cell tc-compatibility-matrix__version-cell">` +
                    `<span class="tc-compatibility-matrix__version-label">${esc(v)}</span>` +
                    `</th>` +
                    statusCells +
                    `</tr>`
                )
            })
            .join('')

        // Legend — all four statuses.
        const legendEntriesHtml = (STATUSES as CompatStatus[])
            .map(
                (s) =>
                    `<span class="tc-compatibility-matrix__legend-item tc-compatibility-matrix__legend-item--${s}">` +
                    statusIconHtml(s) +
                    `<span class="tc-compatibility-matrix__legend-label">${statusText(s)}</span>` +
                    `</span>`,
            )
            .join('')

        const legendHtml =
            `<div class="tc-compatibility-matrix__legend">` + legendEntriesHtml + `</div>`

        this.innerHTML =
            `<div class="tc-compatibility-matrix">` +
            headerHtml +
            `<div class="tc-compatibility-matrix-table">` +
            `<table class="tc-compatibility-matrix__table">` +
            theadHtml +
            `<tbody>${tbodyHtml}</tbody>` +
            `</table>` +
            `</div>` +
            legendHtml +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CompatibilityMatrix
    }
}

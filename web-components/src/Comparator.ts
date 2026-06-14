import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-comparator'

export interface ComparatorTechnology {
    name: string
    icon?: string
    label?: string
}

export interface ComparatorFeature {
    label: string
    left: boolean | string | number
    right: boolean | string | number
    description?: string
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

const checkIconHtml = lucideByName('check')
const xIconHtml = lucideByName('x')

function compareValues(
    left: boolean | string | number,
    right: boolean | string | number,
): 'left' | 'right' | null {
    if (typeof left === 'boolean' && typeof right === 'boolean') {
        if (left && !right) return 'left'
        if (!left && right) return 'right'
        return null
    }
    const ln = typeof left === 'number' ? left : Number(left)
    const rn = typeof right === 'number' ? right : Number(right)
    if (!isNaN(ln) && !isNaN(rn)) {
        if (ln > rn) return 'left'
        if (rn > ln) return 'right'
        return null
    }
    return null
}

function renderCellValue(val: boolean | string | number): string {
    if (val === true) {
        return (
            `<span class="tc-comparator__indicator tc-comparator__indicator--yes">` +
                checkIconHtml +
                `<span class="tc-comparator__sr-only">Supported</span>` +
            `</span>`
        )
    }
    if (val === false) {
        return (
            `<span class="tc-comparator__indicator tc-comparator__indicator--no">` +
                xIconHtml +
                `<span class="tc-comparator__sr-only">Not supported</span>` +
            `</span>`
        )
    }
    return `<span class="tc-comparator__value">${esc(String(val))}</span>`
}

function renderTechHead(tech: ComparatorTechnology | null): string {
    if (!tech) return '<div class="tc-comparator__tech"></div>'
    const iconHtml = tech.icon
        ? `<span class="tc-comparator__tech-icon">${lucideByName(tech.icon)}</span>`
        : ''
    const labelHtml = tech.label
        ? `<span class="tc-comparator__tech-label">${esc(tech.label)}</span>`
        : ''
    return (
        `<div class="tc-comparator__tech">` +
            iconHtml +
            `<span class="tc-comparator__tech-name">${esc(tech.name)}</span>` +
            labelHtml +
        `</div>`
    )
}

export class Comparator extends HTMLElement {
    private _initialised = false
    private _left: ComparatorTechnology | null = null
    private _right: ComparatorTechnology | null = null
    private _features: ComparatorFeature[] = []

    static get observedAttributes(): string[] {
        return ['title', 'description', 'show-summary', 'loading', 'loading-count']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get title(): string | null {
        return this.getAttribute('title')
    }
    set title(v: string | null) {
        if (v != null) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get description(): string | null {
        return this.getAttribute('description')
    }
    set description(v: string | null) {
        if (v != null) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    // Default true: absent or non-"false" value → summary shown.
    get showSummary(): boolean {
        return this.getAttribute('show-summary') !== 'false'
    }
    set showSummary(v: boolean) {
        if (v) this.removeAttribute('show-summary')
        else this.setAttribute('show-summary', 'false')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get loadingCount(): number {
        return parseInt(this.getAttribute('loading-count') ?? '5', 10) || 5
    }
    set loadingCount(v: number) {
        this.setAttribute('loading-count', String(v))
    }

    get left(): ComparatorTechnology | null {
        return this._left
    }
    set left(v: ComparatorTechnology | null) {
        this._left = v
        if (this._initialised) this.render()
    }

    get right(): ComparatorTechnology | null {
        return this._right
    }
    set right(v: ComparatorTechnology | null) {
        this._right = v
        if (this._initialised) this.render()
    }

    get features(): ComparatorFeature[] {
        return this._features
    }
    set features(v: ComparatorFeature[]) {
        this._features = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const titleAttr = this.getAttribute('title')
        const descAttr = this.getAttribute('description')
        const isLoading = this.loading
        const count = this.loadingCount
        const showSum = this.showSummary
        const features = this._features

        const headerHtml =
            titleAttr || descAttr
                ? `<div class="tc-comparator__header">${
                    titleAttr ? `<p class="tc-comparator__title">${esc(titleAttr)}</p>` : ''
                }${
                    descAttr ? `<p class="tc-comparator__desc">${esc(descAttr)}</p>` : ''
                }</div>`
                : ''

        const leftHeadHtml = renderTechHead(this._left)
        const rightHeadHtml = renderTechHead(this._right)

        const theadHtml =
            `<thead>` +
                `<tr class="tc-comparator__head-row">` +
                    `<th class="tc-comparator__cell tc-comparator__cell--left tc-comparator__tech-head" scope="col">${leftHeadHtml}</th>` +
                    `<th class="tc-comparator__cell tc-comparator__cell--feature" scope="col"></th>` +
                    `<th class="tc-comparator__cell tc-comparator__cell--right tc-comparator__tech-head" scope="col">${rightHeadHtml}</th>` +
                `</tr>` +
            `</thead>`

        if (isLoading) {
            const skeletonRows = Array.from({ length: count }, () =>
                `<tr class="tc-comparator__row tc-comparator__row--skeleton">` +
                    `<td class="tc-comparator__cell tc-comparator__cell--left"><span class="tc-comparator__skel-cell"></span></td>` +
                    `<td class="tc-comparator__cell tc-comparator__cell--feature"><span class="tc-comparator__skel-label"></span></td>` +
                    `<td class="tc-comparator__cell tc-comparator__cell--right"><span class="tc-comparator__skel-cell"></span></td>` +
                `</tr>`,
            ).join('')

            this.innerHTML =
                `<div class="tc-comparator">${headerHtml}` +
                    `<div class="tc-comparator-table">` +
                        `<table class="tc-comparator__table" aria-busy="true">` +
                            theadHtml +
                            `<tbody>${skeletonRows}</tbody>` +
                        `</table>` +
                    `</div>` +
                `</div>`
            return
        }

        // Compute winners
        let leftWins = 0
        let rightWins = 0
        const winners = features.map(f => {
            const w = compareValues(f.left, f.right)
            if (w === 'left') leftWins++
            if (w === 'right') rightWins++
            return w
        })

        const featureRowsHtml = features
            .map((f, i) => {
                const winner = winners[i]
                const leftWinner = winner === 'left'
                const rightWinner = winner === 'right'
                const leftCls =
                    `tc-comparator__cell tc-comparator__cell--left` +
                    (leftWinner ? ' tc-comparator__cell--winner' : '')
                const rightCls =
                    `tc-comparator__cell tc-comparator__cell--right` +
                    (rightWinner ? ' tc-comparator__cell--winner' : '')
                const descHtml = f.description
                    ? `<span class="tc-comparator__feature-desc">${esc(f.description)}</span>`
                    : ''
                return (
                    `<tr class="tc-comparator__row">` +
                        `<td class="${leftCls}">${renderCellValue(f.left)}</td>` +
                        `<td class="tc-comparator__cell tc-comparator__cell--feature">` +
                            `<span class="tc-comparator__feature-label">${esc(f.label)}</span>` +
                            descHtml +
                        `</td>` +
                        `<td class="${rightCls}">${renderCellValue(f.right)}</td>` +
                    `</tr>`
                )
            })
            .join('')

        const summaryHtml =
            showSum && features.length > 0
                ? `<tr class="tc-comparator__summary">` +
                      `<td class="tc-comparator__cell tc-comparator__cell--left">` +
                          `<span class="tc-comparator__tally">${leftWins} win${leftWins !== 1 ? 's' : ''}</span>` +
                      `</td>` +
                      `<td class="tc-comparator__cell tc-comparator__cell--feature">` +
                          `<span class="tc-comparator__tally-label">Summary</span>` +
                      `</td>` +
                      `<td class="tc-comparator__cell tc-comparator__cell--right">` +
                          `<span class="tc-comparator__tally">${rightWins} win${rightWins !== 1 ? 's' : ''}</span>` +
                      `</td>` +
                  `</tr>`
                : ''

        this.innerHTML =
            `<div class="tc-comparator">${headerHtml}` +
                `<div class="tc-comparator-table">` +
                    `<table class="tc-comparator__table">` +
                        theadHtml +
                        `<tbody>${featureRowsHtml}${summaryHtml}</tbody>` +
                    `</table>` +
                `</div>` +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Comparator
    }
}

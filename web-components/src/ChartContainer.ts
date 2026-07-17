import { esc } from './internal/esc'
import { msg } from './messages'
const TAG_NAME = 'tc-chart-container'

function fillRegion(el: Element, val: string | Node | null | undefined): void {
    if (typeof val === 'string') {
        el.innerHTML = val
    } else if (val instanceof Node) {
        el.appendChild(val)
    }
}

export class ChartContainer extends HTMLElement {
    private _initialised = false
    private _bodyNodes: Node[] = []
    private _legend: string | Node | null = null
    private _actions: string | Node | null = null
    private _emptySlot: string | Node | null = null

    static get observedAttributes(): string[] {
        return ['title', 'subtitle', 'loading', 'empty']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._bodyNodes = Array.from(this.childNodes)
            this._initialised = true
        }
        this.render()
        this._reattach()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
        this._reattach()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get subtitle(): string | null {
        return this.getAttribute('subtitle')
    }
    set subtitle(v: string | null) {
        if (v != null) this.setAttribute('subtitle', v)
        else this.removeAttribute('subtitle')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get empty(): boolean {
        return this.hasAttribute('empty')
    }
    set empty(v: boolean) {
        if (v) this.setAttribute('empty', '')
        else this.removeAttribute('empty')
    }

    get legend(): string | Node | null {
        return this._legend
    }
    set legend(v: string | Node | null) {
        this._legend = v
        if (this._initialised) this._rerenderWithSlots()
    }

    get actions(): string | Node | null {
        return this._actions
    }
    set actions(v: string | Node | null) {
        this._actions = v
        if (this._initialised) this._rerenderWithSlots()
    }

    get emptySlot(): string | Node | null {
        return this._emptySlot
    }
    set emptySlot(v: string | Node | null) {
        this._emptySlot = v
        if (this._initialised) this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        this.render()
        this._reattach()
    }

    private render(): void {
        const titleVal = this.getAttribute('title')
        const subtitle = this.getAttribute('subtitle')
        const loading = this.loading
        const empty = this.empty

        const hasActions = this._actions != null
        const hasHeader = !!(titleVal || subtitle || hasActions)

        const labelAttr = titleVal ? ` aria-label="${esc(titleVal)}"` : ''

        let headerHtml = ''
        if (hasHeader) {
            const titleHtml = titleVal
                ? `<span class="tc-chart-container-title">${esc(titleVal)}</span>`
                : ''
            const subtitleHtml = subtitle
                ? `<span class="tc-chart-container-subtitle">${esc(subtitle)}</span>`
                : ''
            const titleBlockHtml =
                titleHtml || subtitleHtml
                    ? `<div class="tc-chart-container-title-block">${titleHtml}${subtitleHtml}</div>`
                    : ''
            headerHtml = `<div class="tc-chart-container-header">${titleBlockHtml}<div class="tc-chart-container-actions"></div></div>`
        }

        let bodyHtml: string
        if (loading) {
            bodyHtml = [
                '<div class="tc-chart-container-body" aria-busy="true">',
                `<div class="tc-chart-container-skeleton" role="status" aria-label="${esc(msg('loading'))}">`,
                '<div class="tc-chart-container-skeleton-bar"></div>',
                '<div class="tc-chart-container-skeleton-bar tc-chart-container-skeleton-bar--short"></div>',
                '</div>',
                '</div>',
            ].join('')
        } else if (empty) {
            bodyHtml =
                '<div class="tc-chart-container-body"><div class="tc-chart-container-empty"></div></div>'
        } else {
            bodyHtml = '<div class="tc-chart-container-body"></div>'
        }

        const legendHtml = '<div class="tc-chart-container-legend"></div>'

        this.innerHTML = `<div class="tc-chart-container card" role="group"${labelAttr}>${headerHtml}${bodyHtml}${legendHtml}</div>`
    }

    private _reattach(): void {
        const loading = this.loading
        const empty = this.empty

        const actionsEl = this.querySelector<HTMLElement>('.tc-chart-container-actions')
        if (actionsEl) {
            actionsEl.innerHTML = ''
            if (this._actions != null && !loading) fillRegion(actionsEl, this._actions)
        }

        const legendEl = this.querySelector<HTMLElement>('.tc-chart-container-legend')
        if (legendEl) {
            legendEl.innerHTML = ''
            if (this._legend != null && !loading) fillRegion(legendEl, this._legend)
        }

        const bodyEl = this.querySelector<HTMLElement>('.tc-chart-container-body')
        if (!bodyEl) return

        if (loading) return

        if (empty) {
            const emptyEl = bodyEl.querySelector<HTMLElement>('.tc-chart-container-empty')
            if (emptyEl) {
                if (this._emptySlot != null) {
                    fillRegion(emptyEl, this._emptySlot)
                } else {
                    emptyEl.innerHTML = `<span class="tc-chart-container-empty-text">${esc(msg('noData'))}</span>`
                }
            }
            return
        }

        this._bodyNodes.forEach((n) => bodyEl.appendChild(n))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ChartContainer
    }
}

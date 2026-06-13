const TAG_NAME = 'tc-entity-cell'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export type EntityCellColor = 'slate' | 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange'
export type EntityCellSize = 'sm' | 'md' | 'lg'

const COLORS: EntityCellColor[] = ['slate', 'blue', 'green', 'red', 'yellow', 'purple', 'orange']
const SIZES: EntityCellSize[] = ['sm', 'md', 'lg']

export class EntityCell extends HTMLElement {
    private _initialised = false
    private _onClickProp: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['name', 'sub-label', 'initial', 'color', 'size', 'clickable']
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

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        this.setAttribute('name', v)
    }

    get subLabel(): string | null {
        return this.getAttribute('sub-label')
    }
    set subLabel(v: string | null) {
        if (v != null) this.setAttribute('sub-label', v)
        else this.removeAttribute('sub-label')
    }

    get initial(): string {
        return this.getAttribute('initial') ?? ''
    }
    set initial(v: string) {
        this.setAttribute('initial', v)
    }

    get color(): EntityCellColor {
        const v = this.getAttribute('color') as EntityCellColor
        return COLORS.includes(v) ? v : 'slate'
    }
    set color(v: EntityCellColor) {
        this.setAttribute('color', v)
    }

    get size(): EntityCellSize {
        const v = this.getAttribute('size') as EntityCellSize
        return SIZES.includes(v) ? v : 'md'
    }
    set size(v: EntityCellSize) {
        this.setAttribute('size', v)
    }

    get clickable(): boolean {
        return this.hasAttribute('clickable')
    }
    set clickable(v: boolean) {
        if (v) this.setAttribute('clickable', '')
        else this.removeAttribute('clickable')
    }

    get onClick(): (() => void) | null {
        return this._onClickProp
    }
    set onClick(v: (() => void) | null) {
        this._onClickProp = v
        if (this._initialised) {
            this.render()
        }
    }

    private _handleClick(): void {
        this.dispatchEvent(new CustomEvent('tc-click', {
            bubbles: true,
            composed: true,
            detail: { name: this.getAttribute('name') },
        }))
        if (typeof this._onClickProp === 'function') this._onClickProp()
    }

    private render(): void {
        const name = this.getAttribute('name') ?? ''
        const initial = this.getAttribute('initial') ?? ''
        const subLabelAttr = this.getAttribute('sub-label')
        const color = this.color
        const size = this.size
        const isClickable = this._onClickProp !== null || this.hasAttribute('clickable')

        const tag = isClickable ? 'button' : 'div'
        const typeAttr = isClickable ? ' type="button"' : ''
        const interactiveClass = isClickable ? ' tc-entity-cell--interactive' : ''
        const ariaLabel = name ? ` aria-label="${esc(name)}"` : ''
        const subLabelHtml = subLabelAttr != null
            ? `<span class="tc-entity-cell__sublabel">${esc(subLabelAttr)}</span>`
            : ''

        this.innerHTML = `<${tag}${typeAttr} class="tc-entity-cell tc-entity-cell--${size}${interactiveClass}"${ariaLabel}><span class="tc-entity-cell__tile tc-entity-cell__tile--${color}" aria-hidden="true">${esc(initial)}</span><div class="tc-entity-cell__body"><span class="tc-entity-cell__name">${esc(name)}</span>${subLabelHtml}</div></${tag}>`

        if (isClickable) {
            const inner = this.querySelector('.tc-entity-cell')
            if (inner) {
                inner.addEventListener('click', () => this._handleClick())
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EntityCell
    }
}

const TAG_NAME = 'tc-spacer'

export type SpacerAxis = 'horizontal' | 'vertical'
const AXES: SpacerAxis[] = ['horizontal', 'vertical']

export class Spacer extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['size', 'axis']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.setAttribute('aria-hidden', 'true')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get size(): string | null {
        return this.getAttribute('size')
    }
    set size(v: string | number | null) {
        if (v != null) this.setAttribute('size', String(v))
        else this.removeAttribute('size')
    }

    get axis(): SpacerAxis {
        const v = this.getAttribute('axis')
        return AXES.includes(v as SpacerAxis) ? (v as SpacerAxis) : 'vertical'
    }
    set axis(v: SpacerAxis) {
        if (AXES.includes(v)) this.setAttribute('axis', v)
        else this.removeAttribute('axis')
    }

    private render(): void {
        const axis = this.axis
        const rawSize = this.getAttribute('size')
        const isHorizontal = axis === 'horizontal'

        // Bare numbers (e.g. size="24") are treated as px lengths.
        const resolvedSize =
            rawSize != null
                ? /^\d+(\.\d+)?$/.test(rawSize.trim())
                    ? `${rawSize.trim()}px`
                    : rawSize
                : null

        if (resolvedSize != null) {
            if (isHorizontal) {
                this.style.width = resolvedSize
                this.style.height = '100%'
                this.style.flex = ''
                this.style.flexShrink = '0'
            } else {
                this.style.height = resolvedSize
                this.style.width = '100%'
                this.style.flex = ''
                this.style.flexShrink = '0'
            }
        } else {
            // No size — expand freely within a flex parent.
            this.style.flex = '1 1 auto'
            this.style.height = ''
            this.style.width = ''
            this.style.flexShrink = ''
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Spacer
    }
}

const TAG_NAME = 'gc-panel'

const CORNER_CLASS = 'gc-panel-corner'
const CORNER_POSITIONS = ['tl', 'tr', 'bl', 'br'] as const

export class Panel extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['bordered', 'corners', 'parchment', 'nine-slice', 'nine-slice-fill', 'padding']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback(): void {
        if (!this.root.firstChild) {
            this.root.innerHTML = `<slot></slot>`
        }
        this.syncCustomProps()
        this.syncCorners()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.syncCustomProps()
            this.syncCorners()
        }
    }

    get bordered(): boolean {
        return this.hasAttribute('bordered')
    }
    set bordered(value: boolean) {
        this.toggleAttribute('bordered', value)
    }

    get corners(): boolean {
        return this.hasAttribute('corners')
    }
    set corners(value: boolean) {
        this.toggleAttribute('corners', value)
    }

    get parchment(): boolean {
        return this.hasAttribute('parchment')
    }
    set parchment(value: boolean) {
        this.toggleAttribute('parchment', value)
    }

    get nineSlice(): string | null {
        return this.getAttribute('nine-slice')
    }
    set nineSlice(value: string | null) {
        if (value === null) this.removeAttribute('nine-slice')
        else this.setAttribute('nine-slice', value)
    }

    get nineSliceFill(): boolean {
        return this.hasAttribute('nine-slice-fill')
    }
    set nineSliceFill(value: boolean) {
        this.toggleAttribute('nine-slice-fill', value)
    }

    get padding(): string | null {
        return this.getAttribute('padding')
    }
    set padding(value: string | null) {
        if (value === null) this.removeAttribute('padding')
        else this.setAttribute('padding', value)
    }

    private syncCustomProps(): void {
        const padding = this.padding
        if (padding) {
            this.style.setProperty('--gc-panel-padding', padding)
        } else {
            this.style.removeProperty('--gc-panel-padding')
        }

        const nineSlice = this.nineSlice
        if (nineSlice) {
            this.style.setProperty('--gc-panel-nine-slice', nineSlice)
        } else {
            this.style.removeProperty('--gc-panel-nine-slice')
        }
    }

    private syncCorners(): void {
        const wantCorners = this.corners || this.bordered
        const existing = Array.from(this.querySelectorAll(`:scope > .${CORNER_CLASS}`))

        if (!wantCorners) {
            for (const node of existing) node.remove()
            return
        }

        if (existing.length === CORNER_POSITIONS.length) return

        for (const node of existing) node.remove()

        for (const pos of CORNER_POSITIONS) {
            const span = document.createElement('span')
            span.className = `${CORNER_CLASS} ${pos}`
            span.setAttribute('aria-hidden', 'true')
            this.appendChild(span)
        }
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Panel)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Panel
    }
}

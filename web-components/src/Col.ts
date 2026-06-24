const TAG_NAME = 'tc-col'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

const BREAKPOINTS: Breakpoint[] = ['sm', 'md', 'lg', 'xl', 'xxl']

const VALID_SPAN = new Set(['auto', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])

function buildColClasses(): string[] {
    const classes: string[] = ['col']
    for (let n = 1; n <= 12; n++) {
        classes.push(`col-${n}`, `col-auto`)
        for (const bp of BREAKPOINTS) {
            classes.push(`col-${bp}-${n}`, `col-${bp}-auto`)
        }
    }
    for (const bp of BREAKPOINTS) {
        for (let n = 0; n <= 11; n++) classes.push(`offset-${bp}-${n}`)
        for (let n = 0; n <= 5; n++) classes.push(`order-${n}`, `order-${bp}-${n}`)
        classes.push(`order-first`, `order-last`, `order-${bp}-first`, `order-${bp}-last`)
    }
    for (let n = 0; n <= 5; n++) classes.push(`order-${n}`)
    classes.push('order-first', 'order-last')
    return [...new Set(classes)]
}

const ALL_COL_CLASSES = buildColClasses()

export class Col extends HTMLElement {
    static get observedAttributes(): string[] {
        return [
            'span',
            ...BREAKPOINTS.map((bp) => `span-${bp}`),
            ...BREAKPOINTS.map((bp) => `offset-${bp}`),
            'order',
            ...BREAKPOINTS.map((bp) => `order-${bp}`),
        ]
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get span(): string | null {
        return this.getAttribute('span')
    }
    set span(v: string | null) {
        if (v != null) this.setAttribute('span', v)
        else this.removeAttribute('span')
    }

    get order(): string | null {
        return this.getAttribute('order')
    }
    set order(v: string | null) {
        if (v != null) this.setAttribute('order', v)
        else this.removeAttribute('order')
    }

    private resolveSpanClasses(): string[] {
        const classes: string[] = []
        const base = this.getAttribute('span')
        if (!base) {
            classes.push('col')
        } else if (VALID_SPAN.has(base)) {
            classes.push(base === 'auto' ? 'col-auto' : `col-${base}`)
        }
        for (const bp of BREAKPOINTS) {
            const val = this.getAttribute(`span-${bp}`)
            if (val && VALID_SPAN.has(val)) {
                classes.push(val === 'auto' ? `col-${bp}-auto` : `col-${bp}-${val}`)
            }
        }
        return classes
    }

    private resolveOffsetClasses(): string[] {
        const classes: string[] = []
        for (const bp of BREAKPOINTS) {
            const val = this.getAttribute(`offset-${bp}`)
            if (val !== null) {
                const n = parseInt(val, 10)
                if (!isNaN(n) && n >= 0 && n <= 11) classes.push(`offset-${bp}-${n}`)
            }
        }
        return classes
    }

    private resolveOrderClasses(): string[] {
        const classes: string[] = []
        const base = this.getAttribute('order')
        if (base !== null) {
            if (base === 'first' || base === 'last') {
                classes.push(`order-${base}`)
            } else {
                const n = parseInt(base, 10)
                if (!isNaN(n) && n >= 0 && n <= 5) classes.push(`order-${n}`)
            }
        }
        for (const bp of BREAKPOINTS) {
            const val = this.getAttribute(`order-${bp}`)
            if (val !== null) {
                if (val === 'first' || val === 'last') {
                    classes.push(`order-${bp}-${val}`)
                } else {
                    const n = parseInt(val, 10)
                    if (!isNaN(n) && n >= 0 && n <= 5) classes.push(`order-${bp}-${n}`)
                }
            }
        }
        return classes
    }

    private render(): void {
        this.classList.remove(...ALL_COL_CLASSES)

        const toAdd = [
            ...this.resolveSpanClasses(),
            ...this.resolveOffsetClasses(),
            ...this.resolveOrderClasses(),
        ]

        if (toAdd.length > 0) this.classList.add(...toAdd)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Col
    }
}

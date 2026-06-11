const TAG_NAME = 'tc-row'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
type AlignItems = 'start' | 'center' | 'end'
type JustifyContent = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'

const BREAKPOINTS: Breakpoint[] = ['sm', 'md', 'lg', 'xl', 'xxl']

const ALL_ROW_CLASSES = [
    ...(['', ...BREAKPOINTS].flatMap(bp => {
        const suffix = bp ? `-${bp}` : ''
        return [0, 1, 2, 3, 4, 5, 6].map(n => `row-cols${suffix}-${n}`)
    })),
    ...[0, 1, 2, 3, 4, 5].flatMap(n => [`g-${n}`, `gx-${n}`, `gy-${n}`]),
    ...(['start', 'center', 'end'].map(v => `align-items-${v}`)),
    ...(['start', 'center', 'end', 'between', 'around', 'evenly'].map(v => `justify-content-${v}`)),
]

export class Row extends HTMLElement {

    static get observedAttributes(): string[] {
        return [
            'cols', 'cols-sm', 'cols-md', 'cols-lg', 'cols-xl', 'cols-xxl',
            'gutter', 'g',
            'align',
            'justify',
        ]
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.classList.add('row')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get cols(): string | null { return this.getAttribute('cols') }
    set cols(v: string | null) { v != null ? this.setAttribute('cols', v) : this.removeAttribute('cols') }

    get align(): AlignItems | null {
        const v = this.getAttribute('align')
        return (v === 'start' || v === 'center' || v === 'end') ? v : null
    }
    set align(v: AlignItems | null) { v ? this.setAttribute('align', v) : this.removeAttribute('align') }

    get justify(): JustifyContent | null {
        const v = this.getAttribute('justify')
        return (v === 'start' || v === 'center' || v === 'end' || v === 'between' || v === 'around' || v === 'evenly') ? v : null
    }
    set justify(v: JustifyContent | null) { v ? this.setAttribute('justify', v) : this.removeAttribute('justify') }

    private resolveGutterClasses(): string[] {
        const raw = this.getAttribute('gutter') ?? this.getAttribute('g')
        if (!raw) return []

        // Support axis-prefixed values like "x2", "y3", "x2 y3"
        const tokens = raw.trim().split(/\s+/)
        const classes: string[] = []
        for (const token of tokens) {
            const axisMatch = token.match(/^([xy])(\d+)$/)
            if (axisMatch) {
                classes.push(`g${axisMatch[1]}-${axisMatch[2]}`)
            } else if (/^\d+$/.test(token)) {
                classes.push(`g-${token}`)
            }
        }
        return classes
    }

    private resolveColsClasses(): string[] {
        const classes: string[] = []
        const base = this.getAttribute('cols')
        if (base) classes.push(`row-cols-${base}`)
        for (const bp of BREAKPOINTS) {
            const val = this.getAttribute(`cols-${bp}`)
            if (val) classes.push(`row-cols-${bp}-${val}`)
        }
        return classes
    }

    private render(): void {
        this.classList.remove(...ALL_ROW_CLASSES)

        const toAdd = [
            ...this.resolveColsClasses(),
            ...this.resolveGutterClasses(),
        ]

        const align = this.align
        if (align) toAdd.push(`align-items-${align}`)

        const justify = this.justify
        if (justify) toAdd.push(`justify-content-${justify}`)

        if (toAdd.length > 0) this.classList.add(...toAdd)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Row
    }
}

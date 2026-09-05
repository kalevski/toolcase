import { classTokens } from './internal/safe-dom'
const TAG_NAME = 'tc-row'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
type AlignItems = 'start' | 'center' | 'end'
type JustifyContent = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'

const BREAKPOINTS: Breakpoint[] = ['sm', 'md', 'lg', 'xl', 'xxl']

const ALL_ROW_CLASSES = [
    ...['', ...BREAKPOINTS].flatMap((bp) => {
        const suffix = bp ? `-${bp}` : ''
        return [0, 1, 2, 3, 4, 5, 6].map((n) => `row-cols${suffix}-${n}`)
    }),
    ...[0, 1, 2, 3, 4, 5].flatMap((n) => [`g-${n}`, `gx-${n}`, `gy-${n}`]),
    ...['start', 'center', 'end'].map((v) => `align-items-${v}`),
    ...['start', 'center', 'end', 'between', 'around', 'evenly'].map((v) => `justify-content-${v}`),
]

export class Row extends HTMLElement {
    static get observedAttributes(): string[] {
        return [
            'cols',
            'cols-sm',
            'cols-md',
            'cols-lg',
            'cols-xl',
            'cols-xxl',
            'gutter',
            'g',
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

    get cols(): string | null {
        return this.getAttribute('cols')
    }
    set cols(v: string | null) {
        if (v != null) this.setAttribute('cols', v)
        else this.removeAttribute('cols')
    }

    get align(): AlignItems | null {
        const v = this.getAttribute('align')
        return v === 'start' || v === 'center' || v === 'end' ? v : null
    }
    set align(v: AlignItems | null) {
        if (v) this.setAttribute('align', v)
        else this.removeAttribute('align')
    }

    get justify(): JustifyContent | null {
        const v = this.getAttribute('justify')
        return v === 'start' ||
            v === 'center' ||
            v === 'end' ||
            v === 'between' ||
            v === 'around' ||
            v === 'evenly'
            ? v
            : null
    }
    set justify(v: JustifyContent | null) {
        if (v) this.setAttribute('justify', v)
        else this.removeAttribute('justify')
    }

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

    /** `row-cols-*` exists for 0-6 and nothing else, so the attribute is read as
     *  a column COUNT rather than pasted into a class name. React stringifies
     *  whatever the author passed — an object arrives as `'[object Object]'` and a
     *  bare space as `' '` — and both of those, interpolated, are tokens
     *  `classList.add` rejects with an exception that aborts the render. */
    private resolveColsClasses(): string[] {
        const count = (raw: string | null): string | null => {
            if (raw === null) return null
            const n = Number(raw.trim())
            return Number.isInteger(n) && n >= 0 && n <= 6 ? String(n) : null
        }
        const classes: string[] = []
        const base = count(this.getAttribute('cols'))
        if (base !== null) classes.push(`row-cols-${base}`)
        for (const bp of BREAKPOINTS) {
            const val = count(this.getAttribute(`cols-${bp}`))
            if (val !== null) classes.push(`row-cols-${bp}-${val}`)
        }
        return classes
    }

    private render(): void {
        this.classList.remove(...ALL_ROW_CLASSES)

        const toAdd = [...this.resolveColsClasses(), ...this.resolveGutterClasses()]

        const align = this.align
        if (align) toAdd.push(`align-items-${align}`)

        const justify = this.justify
        if (justify) toAdd.push(`justify-content-${justify}`)

        // classTokens is the backstop for every value above: DOMTokenList throws
        // on an empty token or one containing whitespace, and one bad attribute
        // must not cost the element its whole class list.
        const tokens = classTokens(...toAdd)
        if (tokens.length > 0) this.classList.add(...tokens)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Row
    }
}

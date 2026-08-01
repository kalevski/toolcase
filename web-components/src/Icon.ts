import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'

const TAG_NAME = 'tc-icon'

// The `set` attribute is kept for API parity with the React Icon component,
// which supports 'bi' (Bootstrap Icons) and 'tc' (ToolCase) sets. In the
// web-components package all icons are sourced from lucide-static regardless
// of the `set` value.
export type IconSet = 'bi' | 'tc'
const SETS: IconSet[] = ['bi', 'tc']

export class Icon extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['name', 'set', 'as', 'size', 'color', 'label', 'decorative']
    }

    constructor() {
        super()
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

    get set(): IconSet {
        const v = this.getAttribute('set') as IconSet
        return SETS.includes(v) ? v : 'bi'
    }
    set set(v: IconSet) {
        this.setAttribute('set', v)
    }

    get as(): string {
        return this.getAttribute('as') ?? 'span'
    }
    set as(v: string) {
        this.setAttribute('as', v)
    }

    get size(): string | null {
        return this.getAttribute('size')
    }
    set size(v: string | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    get color(): string | null {
        return this.getAttribute('color')
    }
    set color(v: string | null) {
        if (v != null) this.setAttribute('color', v)
        else this.removeAttribute('color')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get decorative(): boolean {
        return this.hasAttribute('decorative')
    }
    set decorative(v: boolean) {
        if (v) this.setAttribute('decorative', '')
        else this.removeAttribute('decorative')
    }

    // KEBAB AND PASCAL, like every other icon-bearing element in the library.
    //
    // This was the one place that indexed `lucide-static` directly, so
    // `name="book-open"` — the spelling `tc-tab-dock`, `tc-list-section`,
    // `tc-page-tabs` and `tc-side-nav` all accept — resolved to nothing and
    // rendered an empty inert wrapper: no icon, no error, nothing in the console.
    // `internal/lucide` is the library's single kebab→Pascal lookup and is a
    // strict superset of the old behaviour (a Pascal name splits to itself), so
    // this only makes previously-dead names work.
    private _resolveIcon(name: string): string {
        return lucideByName(name, 'tc-icon__svg')
    }

    private _sizeValue(raw: string | null): string {
        if (!raw) return '1em'
        // Pure numbers become px; anything else (em, %, px, etc.) passes through.
        return /^\d+(\.\d+)?$/.test(raw) ? `${raw}px` : raw
    }

    private render(): void {
        const name = this.name
        // Strip anything not valid in an HTML element name to prevent injection.
        const tag = (this.as || 'span').replace(/[^a-zA-Z0-9-]/g, '') || 'span'
        const svgHtml = this._resolveIcon(name)

        if (!svgHtml) {
            // Unknown icon name — render an empty but inert wrapper rather than throwing.
            this.innerHTML = `<${tag} class="tc-icon" aria-hidden="true"></${tag}>`
            return
        }

        const sizeVal = this._sizeValue(this.getAttribute('size'))
        const color = this.getAttribute('color')
        const decorative = this.decorative
        const labelAttr = this.getAttribute('label')

        const style = [`--bs-icon-size: ${sizeVal}`, color ? `--bs-icon-color: ${esc(color)}` : '']
            .filter(Boolean)
            .join('; ')

        let ariaAttrs = ''
        if (decorative) {
            ariaAttrs = ' aria-hidden="true"'
        } else if (labelAttr) {
            ariaAttrs = ` role="img" aria-label="${esc(labelAttr)}"`
        }

        this.innerHTML = `<${tag} class="tc-icon" style="${style}"${ariaAttrs}>${svgHtml}</${tag}>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Icon
    }
}

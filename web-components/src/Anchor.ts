const TAG_NAME = 'tc-anchor'

export type AnchorPosition =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right'

const POSITIONS: AnchorPosition[] = [
    'top-left',
    'top',
    'top-right',
    'left',
    'center',
    'right',
    'bottom-left',
    'bottom',
    'bottom-right',
]

// Bare numbers (e.g. inset="8") are treated as px lengths; any CSS length
// string is passed through untouched.
function resolveLength(raw: string | null): string | null {
    if (raw == null) return null
    const trimmed = raw.trim()
    if (trimmed === '') return null
    return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}px` : trimmed
}

/**
 * tc-anchor — layout primitive that absolutely positions its slotted content at
 * a corner/edge (or the centre) of the nearest positioned ancestor. Purely
 * structural: no visible chrome. Positioning is driven entirely from CSS via the
 * `position` attribute selector and the `--bs-anchor-inset` custom property; the
 * element only reflects the `inset` attribute into that property.
 */
export class Anchor extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['position', 'inset']
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

    get position(): AnchorPosition {
        const v = this.getAttribute('position') as AnchorPosition
        return POSITIONS.includes(v) ? v : 'top-left'
    }
    set position(v: AnchorPosition) {
        if (POSITIONS.includes(v)) this.setAttribute('position', v)
        else this.removeAttribute('position')
    }

    get inset(): string {
        return this.getAttribute('inset') ?? '0px'
    }
    set inset(v: string | number | null) {
        if (v != null) this.setAttribute('inset', String(v))
        else this.removeAttribute('inset')
    }

    private render(): void {
        // Free-form CSS length → public --bs-anchor-inset custom property. The
        // SCSS partial declares the 0px default and consumes it for every
        // position; the inline value wins by specificity when provided.
        const resolved = resolveLength(this.getAttribute('inset'))
        if (resolved != null) this.style.setProperty('--bs-anchor-inset', resolved)
        else this.style.removeProperty('--bs-anchor-inset')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Anchor
    }
}

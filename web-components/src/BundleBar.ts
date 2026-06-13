const TAG_NAME = 'tc-bundle-bar'

export interface BundleBarChip {
    label: string
    value?: string | number
    color?: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class BundleBar extends HTMLElement {
    private _initialised = false
    private _chips: BundleBarChip[] = []

    static get observedAttributes(): string[] {
        return ['segments', 'filled-segments', 'name', 'meta']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const nameSlot = Array.from(this.querySelectorAll('[slot="name"]'))
            const metaSlot = Array.from(this.querySelectorAll('[slot="meta"]'))
            this.render()
            this._distributeSlots(nameSlot, metaSlot)
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        const nameSlot = Array.from(this.querySelectorAll('.tc-bundle-bar__name [slot="name"]'))
        const metaSlot = Array.from(this.querySelectorAll('.tc-bundle-bar__meta [slot="meta"]'))
        this.render()
        this._distributeSlots(nameSlot, metaSlot)
    }

    private _distributeSlots(nameSlot: Element[], metaSlot: Element[]): void {
        const nameEl = this.querySelector('.tc-bundle-bar__name')
        if (nameEl) nameSlot.forEach(n => nameEl.appendChild(n))
        const metaEl = this.querySelector('.tc-bundle-bar__meta')
        if (metaEl) metaSlot.forEach(n => metaEl.appendChild(n))
    }

    get segments(): number {
        return Math.max(1, parseInt(this.getAttribute('segments') ?? '10', 10) || 10)
    }
    set segments(v: number) {
        this.setAttribute('segments', String(v))
    }

    get filledSegments(): number {
        const total = this.segments
        return Math.max(0, Math.min(total, parseInt(this.getAttribute('filled-segments') ?? '0', 10) || 0))
    }
    set filledSegments(v: number) {
        this.setAttribute('filled-segments', String(v))
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get meta(): string | null {
        return this.getAttribute('meta')
    }
    set meta(v: string | null) {
        if (v != null) this.setAttribute('meta', v)
        else this.removeAttribute('meta')
    }

    get chips(): BundleBarChip[] {
        return this._chips
    }
    set chips(v: BundleBarChip[]) {
        this._chips = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    private render(): void {
        const total = this.segments
        const filled = this.filledSegments
        const nameAttr = this.getAttribute('name')
        const metaAttr = this.getAttribute('meta')

        // Header: always rendered so named slots have a container to receive content.
        // CSS hides it when both children are empty (via :has / :empty).
        const nameHtml = nameAttr != null ? esc(nameAttr) : ''
        const metaHtml = metaAttr != null ? esc(metaAttr) : ''
        const headerHtml =
            `<div class="tc-bundle-bar__header">` +
            `<span class="tc-bundle-bar__name">${nameHtml}</span>` +
            `<span class="tc-bundle-bar__meta">${metaHtml}</span>` +
            `</div>`

        // Segmented track with progressbar ARIA
        const ariaLabel = nameAttr ? ` aria-label="${esc(nameAttr)}"` : ''
        const segCells = Array.from({ length: total }, (_, i) => {
            const cls = i < filled ? ' is-filled' : ''
            return `<span class="tc-bundle-bar__segment${cls}"></span>`
        }).join('')
        const trackHtml =
            `<div class="tc-bundle-bar__track" role="progressbar"` +
            ` aria-valuenow="${filled}" aria-valuemin="0" aria-valuemax="${total}"${ariaLabel}>` +
            `${segCells}</div>`

        // Chips row — only rendered when the chips property is populated
        let chipsHtml = ''
        if (this._chips.length > 0) {
            const chipItems = this._chips.map(chip => {
                const colorStyle = chip.color
                    ? ` style="--bs-bundle-bar-chip-accent: ${esc(chip.color)}"`
                    : ''
                const valueHtml = chip.value != null
                    ? `<span class="tc-bundle-bar__chip-value">${esc(String(chip.value))}</span>`
                    : ''
                return (
                    `<span class="tc-bundle-bar__chip"${colorStyle}>` +
                    `<span class="tc-bundle-bar__chip-label">${esc(chip.label)}</span>` +
                    `${valueHtml}</span>`
                )
            }).join('')
            chipsHtml = `<div class="tc-bundle-bar__chips">${chipItems}</div>`
        }

        this.innerHTML = `<div class="tc-bundle-bar">${headerHtml}${trackHtml}${chipsHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BundleBar
    }
}

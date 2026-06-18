const TAG_NAME = 'tc-radial-wheel'

export interface RadialOption {
    id: string
    icon?: string
    label?: string
    color?: string
    disabled?: boolean
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class RadialWheel extends HTMLElement {
    private _initialised = false
    private _options: RadialOption[] = []
    private _hoverId: string | null = null

    /** Optional callback fired alongside `tc-select`. */
    onSelect: ((id: string) => void) | null = null

    /** Optional callback fired alongside `tc-close`. */
    onClose: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['open', 'radius', 'option-size', 'center-label']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'menu')
            this.render()
            this._initialised = true
        }
        // Document-level handlers live for the connected lifetime so Escape
        // and backdrop-click work whenever [open] is set from outside.
        document.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onClick)
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get radius(): number {
        const raw = this.getAttribute('radius')
        if (raw == null) return 120
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 120
    }
    set radius(v: number) {
        this.setAttribute('radius', String(v))
    }

    get optionSize(): number {
        const raw = this.getAttribute('option-size')
        if (raw == null) return 56
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 56
    }
    set optionSize(v: number) {
        this.setAttribute('option-size', String(v))
    }

    get centerLabel(): string {
        return this.getAttribute('center-label') ?? ''
    }
    set centerLabel(v: string) {
        if (v) this.setAttribute('center-label', v)
        else this.removeAttribute('center-label')
    }

    get options(): RadialOption[] {
        return this._options.slice()
    }
    set options(value: RadialOption[]) {
        this._options = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private _close(): void {
        this.open = false
        this.dispatchEvent(new CustomEvent('tc-close', { bubbles: true, composed: true, detail: {} }))
        if (typeof this.onClose === 'function') this.onClose()
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return
        if (e.key === 'Escape') {
            e.preventDefault()
            this._close()
        }
    }

    // Backdrop click closes; option buttons stop propagation so they don't trigger this.
    private _onClick = (e: Event): void => {
        const target = e.target as Element | null
        if (target?.closest('.tc-radial-wheel-option')) return
        if (target?.classList.contains('tc-radial-wheel-backdrop')) {
            this._close()
        }
    }

    private render(): void {
        const radius = this.radius
        const size = this.optionSize
        const centerLabel = this.centerLabel
        const hoverOption = this._options.find(o => o.id === this._hoverId) ?? null

        // Expose layout geometry as inline custom properties so the SCSS can
        // drive the disc diameter without knowing the attribute values.
        this.style.setProperty('--tc-rw-radius', `${radius}px`)
        this.style.setProperty('--tc-rw-size', `${size}px`)

        const n = this._options.length
        const optionsHtml = this._options.map((opt, i) => {
            const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
            const x = Math.cos(angle) * radius
            const y = Math.sin(angle) * radius
            const isHover = opt.id === this._hoverId
            const cls = [
                'tc-radial-wheel-option',
                opt.disabled ? 'tc-radial-wheel-option--disabled' : '',
                isHover ? 'tc-radial-wheel-option--hover' : '',
            ].filter(Boolean).join(' ')
            // Per-option color fed through a custom property so the SCSS can
            // expose it as --bs-radial-wheel-option-color on each button.
            const colorStyle = opt.color ? `--bs-radial-wheel-option-color:${esc(opt.color)};` : ''
            const icon = opt.icon ?? '●'
            return (
                `<button type="button"` +
                ` role="menuitem"` +
                ` class="${cls}"` +
                ` data-id="${esc(opt.id)}"` +
                (opt.disabled ? ` disabled aria-disabled="true"` : '') +
                ` aria-label="${esc(opt.label ?? opt.id)}"` +
                ` style="left:calc(50% + ${x.toFixed(2)}px);top:calc(50% + ${y.toFixed(2)}px);${colorStyle}"` +
                `><span class="tc-radial-wheel-option-icon" aria-hidden="true">${esc(icon)}</span>` +
                `</button>`
            )
        }).join('')

        const centerText = hoverOption?.label || centerLabel
        const centerHtml = `<div class="tc-radial-wheel-center${centerText ? '' : ' tc-radial-wheel-center--empty'}" aria-live="polite">${centerText ? esc(centerText) : ''}</div>`

        this.innerHTML = (
            `<div class="tc-radial-wheel-backdrop" aria-hidden="true"></div>` +
            `<div class="tc-radial-wheel-disc">` +
            centerHtml +
            optionsHtml +
            `</div>`
        )

        // Attach hover listeners on each option button after innerHTML write.
        // Option click listeners also live here since buttons are replaced every render.
        this.querySelectorAll<HTMLButtonElement>('.tc-radial-wheel-option').forEach(btn => {
            const id = btn.dataset.id ?? ''
            const opt = this._options.find(o => o.id === id)
            if (!opt) return

            btn.addEventListener('mouseenter', () => {
                if (this._hoverId === id) return
                this._hoverId = id
                this.render()
            })
            btn.addEventListener('mouseleave', () => {
                if (this._hoverId !== id) return
                this._hoverId = null
                this.render()
            })

            if (!opt.disabled) {
                btn.addEventListener('click', e => {
                    e.stopPropagation()
                    this.dispatchEvent(new CustomEvent('tc-select', {
                        bubbles: true,
                        composed: true,
                        detail: { id },
                    }))
                    if (typeof this.onSelect === 'function') this.onSelect(id)
                })
            }
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RadialWheel
    }
}

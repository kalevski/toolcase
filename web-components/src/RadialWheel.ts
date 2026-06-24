import { esc } from './internal/esc'
const TAG_NAME = 'tc-radial-wheel'

export interface RadialOption {
    id: string
    icon?: string
    label?: string
    color?: string
    disabled?: boolean
}

export class RadialWheel extends HTMLElement {
    private _initialised = false
    private _options: RadialOption[] = []
    private _hoverId: string | null = null
    private _page = 0

    /** Optional callback fired alongside `tc-select`. */
    onSelect: ((id: string) => void) | null = null

    /** Optional callback fired alongside `tc-close`. */
    onClose: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['open', 'radius', 'option-size', 'center-label', 'per-page']
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

    /** Max options shown on a single wheel; extras spill onto further pages. */
    get perPage(): number {
        const raw = this.getAttribute('per-page')
        if (raw == null) return 10
        const parsed = parseInt(raw, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
    }
    set perPage(v: number) {
        this.setAttribute('per-page', String(v))
    }

    private get _pageCount(): number {
        return Math.max(1, Math.ceil(this._options.length / this.perPage))
    }

    get options(): RadialOption[] {
        return this._options.slice()
    }
    set options(value: RadialOption[]) {
        this._options = Array.isArray(value) ? value.slice() : []
        // Clamp the active page into range when the option set shrinks.
        this._page = Math.min(this._page, this._pageCount - 1)
        if (this._initialised) this.render()
    }

    private _close(): void {
        this.open = false
        this.dispatchEvent(
            new CustomEvent('tc-close', { bubbles: true, composed: true, detail: {} }),
        )
        if (typeof this.onClose === 'function') this.onClose()
    }

    private _setPage(page: number): void {
        const clamped = Math.min(Math.max(0, page), this._pageCount - 1)
        if (clamped === this._page) return
        this._page = clamped
        this._hoverId = null
        this.render()
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return
        if (e.key === 'Escape') {
            e.preventDefault()
            this._close()
            return
        }
        // Arrow keys page through option groups when more than one page exists.
        if (this._pageCount > 1) {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault()
                this._setPage(this._page + 1)
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault()
                this._setPage(this._page - 1)
            }
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

        // Expose layout geometry as inline custom properties so the SCSS can
        // drive the disc diameter without knowing the attribute values.
        this.style.setProperty('--tc-rw-radius', `${radius}px`)
        this.style.setProperty('--tc-rw-size', `${size}px`)

        // Paginate: only the active page's slice is laid out around the wheel.
        const perPage = this.perPage
        const pageCount = this._pageCount
        this._page = Math.min(Math.max(0, this._page), pageCount - 1)
        const pageStart = this._page * perPage
        const pageOptions = this._options.slice(pageStart, pageStart + perPage)
        const hoverOption = pageOptions.find((o) => o.id === this._hoverId) ?? null

        // Distribute the page's items evenly around the full circle. The angle
        // step is 2π / count, starting at the top (−π/2) and going clockwise, so
        // a single item lands dead-centre at the top and the gaps stay uniform.
        const n = pageOptions.length
        const optionsHtml = pageOptions
            .map((opt, i) => {
                const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
                const x = Math.cos(angle) * radius
                const y = Math.sin(angle) * radius
                const isHover = opt.id === this._hoverId
                const cls = [
                    'tc-radial-wheel-option',
                    opt.disabled ? 'tc-radial-wheel-option--disabled' : '',
                    isHover ? 'tc-radial-wheel-option--hover' : '',
                ]
                    .filter(Boolean)
                    .join(' ')
                // Per-option color fed through a custom property so the SCSS can
                // expose it as --bs-radial-wheel-option-color on each button.
                const colorStyle = opt.color
                    ? `--bs-radial-wheel-option-color:${esc(opt.color)};`
                    : ''
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
            })
            .join('')

        // Show the page position in the centre when paging and nothing is hovered,
        // so the hub doubles as the current-page readout (e.g. "1 / 3").
        const pageLabel = pageCount > 1 ? `${this._page + 1} / ${pageCount}` : ''
        const centerText = hoverOption?.label || centerLabel || pageLabel
        const centerHtml = `<div class="tc-radial-wheel-center${centerText ? '' : ' tc-radial-wheel-center--empty'}" aria-live="polite">${centerText ? esc(centerText) : ''}</div>`

        // Pagination uses the canonical tc-page-indicator dot row, centred below
        // the disc inside the stack so it sits clear of the option ring.
        const pagerHtml =
            pageCount > 1
                ? `<tc-page-indicator class="tc-radial-wheel-pager" count="${pageCount}" index="${this._page}" aria-label="Wheel pages"></tc-page-indicator>`
                : ''

        this.innerHTML =
            `<div class="tc-radial-wheel-backdrop" aria-hidden="true"></div>` +
            `<div class="tc-radial-wheel-stack">` +
            `<div class="tc-radial-wheel-disc">` +
            centerHtml +
            optionsHtml +
            `</div>` +
            pagerHtml +
            `</div>`

        // Wire the page indicator's tc-select to page changes. The indicator is
        // recreated each render, so the listener is re-attached every time.
        const pager = this.querySelector<HTMLElement>('.tc-radial-wheel-pager')
        if (pager) {
            pager.addEventListener('tc-select', (e: Event) => {
                const idx = (e as CustomEvent<{ index: number }>).detail?.index
                if (typeof idx === 'number') this._setPage(idx)
            })
        }

        // Attach hover listeners on each option button after innerHTML write.
        // Option click listeners also live here since buttons are replaced every render.
        this.querySelectorAll<HTMLButtonElement>('.tc-radial-wheel-option').forEach((btn) => {
            const id = btn.dataset.id ?? ''
            const opt = this._options.find((o) => o.id === id)
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
                btn.addEventListener('click', (e) => {
                    e.stopPropagation()
                    this.dispatchEvent(
                        new CustomEvent('tc-select', {
                            bubbles: true,
                            composed: true,
                            detail: { id },
                        }),
                    )
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

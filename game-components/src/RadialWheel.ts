const TAG_NAME = 'gc-radial-wheel'

export interface RadialOption {
    id: string
    icon?: string
    label?: string
    color?: string
    disabled?: boolean
}

export interface RadialWheelEventMap {
    select: CustomEvent<{ id: string }>
    close: CustomEvent<void>
}

export class RadialWheel extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['open', 'radius', 'option-size', 'center-label']
    }

    private _options: RadialOption[] = []
    private _hoverId: string | null = null
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)
    private clickAwayHandler = (event: Event) => this.handleClickAway(event)

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'menu')
        document.addEventListener('keydown', this.keyHandler)
        this.addEventListener('click', this.clickAwayHandler)
        this.render()
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this.keyHandler)
        this.removeEventListener('click', this.clickAwayHandler)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
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
        if (this.isConnected) this.render()
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private handleKey(event: KeyboardEvent): void {
        if (!this.open) return
        if (event.key === 'Escape') {
            event.preventDefault()
            this.open = false
            this.emit('close')
        }
    }

    private handleClickAway(event: Event): void {
        const target = event.target as HTMLElement
        if (target.closest('.gc-radial-wheel-option')) return
        if (target.classList.contains('gc-radial-wheel-backdrop')) {
            this.open = false
            this.emit('close')
        }
    }

    private render(): void {
        const radius = this.radius
        const size = this.optionSize
        const centerLabel = this.centerLabel
        const hoverOption = this._options.find((o) => o.id === this._hoverId) ?? null

        this.style.setProperty('--gc-radial-wheel-radius', `${radius}px`)
        this.style.setProperty('--gc-radial-wheel-option-size', `${size}px`)
        this.style.setProperty('--gc-radial-wheel-diameter', `${radius * 2 + size}px`)

        const n = this._options.length
        const optionsMarkup = this._options.map((opt, i) => {
            const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2
            const x = Math.cos(angle) * radius
            const y = Math.sin(angle) * radius
            const cls = `gc-radial-wheel-option${opt.disabled ? ' is-disabled' : ''}${opt.id === this._hoverId ? ' is-hover' : ''}`
            const colorVar = opt.color ? `--gc-radial-wheel-option-color:${this.escape(opt.color)};` : ''
            const icon = opt.icon || '◆'
            return `<button type="button" class="${cls}" data-id="${this.escape(opt.id)}" ${opt.disabled ? 'aria-disabled="true"' : ''} style="left:calc(50% + ${x}px);top:calc(50% + ${y}px);${colorVar}">
                <span class="gc-radial-wheel-option-icon">${this.escape(icon)}</span>
            </button>`
        }).join('')

        const centerLabelText = hoverOption?.label || centerLabel || ''
        const centerMarkup = centerLabelText
            ? `<div class="gc-radial-wheel-center">${this.escape(centerLabelText)}</div>`
            : ''

        this.innerHTML = `
            <div class="gc-radial-wheel-backdrop"></div>
            <div class="gc-radial-wheel-disc">
                ${centerMarkup}
                ${optionsMarkup}
            </div>
        `

        this.querySelectorAll<HTMLButtonElement>('.gc-radial-wheel-option').forEach((el) => {
            const id = el.dataset.id || ''
            const opt = this._options.find((o) => o.id === id)
            if (!opt) return
            el.addEventListener('mouseenter', () => {
                this._hoverId = id
                this.render()
            })
            el.addEventListener('mouseleave', () => {
                if (this._hoverId === id) {
                    this._hoverId = null
                    this.render()
                }
            })
            if (!opt.disabled) {
                el.addEventListener('click', (event) => {
                    event.stopPropagation()
                    this.emit('select', { id })
                })
            }
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, RadialWheel)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RadialWheel
    }
}

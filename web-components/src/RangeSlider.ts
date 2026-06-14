const TAG_NAME = 'tc-range-slider'

function esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function snapToStep(v: number, min: number, max: number, step: number): number {
    if (step <= 0 || max <= min) return Math.min(Math.max(v, min), max)
    const steps = Math.round((v - min) / step)
    const raw = min + steps * step
    const precision = Math.max(
        (step.toString().split('.')[1] ?? '').length,
        (min.toString().split('.')[1] ?? '').length,
    )
    const factor = Math.pow(10, precision)
    return Math.min(Math.max(Math.round(raw * factor) / factor, min), max)
}

export class RangeSlider extends HTMLElement {

    private _initialised = false
    private _value: [number, number] = [0, 100]
    private _dragging: 'lo' | 'hi' | null = null
    private _dragMoveHandler: ((e: PointerEvent) => void) | null = null
    private _dragUpHandler: (() => void) | null = null

    onChange: ((value: [number, number]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['min', 'max', 'step', 'ticks', 'show-tooltip', 'label', 'disabled']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._cleanupDrag()
    }

    attributeChangedCallback(_name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get min(): number {
        return parseFloat(this.getAttribute('min') ?? '0') || 0
    }
    set min(v: number) {
        this.setAttribute('min', String(v))
    }

    get max(): number {
        const raw = parseFloat(this.getAttribute('max') ?? '100')
        return isNaN(raw) ? 100 : raw
    }
    set max(v: number) {
        this.setAttribute('max', String(v))
    }

    get step(): number {
        const raw = parseFloat(this.getAttribute('step') ?? '1')
        return isNaN(raw) || raw <= 0 ? 1 : raw
    }
    set step(v: number) {
        this.setAttribute('step', String(v))
    }

    get ticks(): boolean {
        return this.hasAttribute('ticks')
    }
    set ticks(v: boolean) {
        if (v) this.setAttribute('ticks', '')
        else this.removeAttribute('ticks')
    }

    get showTooltip(): boolean {
        return this.hasAttribute('show-tooltip')
    }
    set showTooltip(v: boolean) {
        if (v) this.setAttribute('show-tooltip', '')
        else this.removeAttribute('show-tooltip')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get value(): [number, number] {
        return [...this._value] as [number, number]
    }
    set value(v: [number, number]) {
        if (!Array.isArray(v) || v.length < 2) return
        this._value = this._coerce(v[0], v[1])
        if (this._initialised) this._patchPositions()
    }

    private _coerce(lo: number, hi: number): [number, number] {
        const min = this.min
        const max = this.max
        const step = this.step
        let a = snapToStep(Math.min(Math.max(lo, min), max), min, max, step)
        let b = snapToStep(Math.min(Math.max(hi, min), max), min, max, step)
        if (a > b) [a, b] = [b, a]
        return [a, b]
    }

    private _pct(v: number): number {
        const min = this.min
        const max = this.max
        if (max === min) return 0
        return ((v - min) / (max - min)) * 100
    }

    private _patchPositions(): void {
        const [lo, hi] = this._value
        const loPct = this._pct(lo)
        const hiPct = this._pct(hi)

        const loHandle = this.querySelector<HTMLElement>('.tc-range-slider-handle--lo')
        const hiHandle = this.querySelector<HTMLElement>('.tc-range-slider-handle--hi')
        const fill = this.querySelector<HTMLElement>('.tc-range-slider-fill')

        if (loHandle) {
            loHandle.style.left = `${loPct}%`
            loHandle.setAttribute('aria-valuenow', String(lo))
            loHandle.setAttribute('aria-valuemax', String(hi))
            const tooltip = loHandle.querySelector<HTMLElement>('.tc-range-slider-tooltip')
            if (tooltip) tooltip.textContent = String(lo)
        }
        if (hiHandle) {
            hiHandle.style.left = `${hiPct}%`
            hiHandle.setAttribute('aria-valuenow', String(hi))
            hiHandle.setAttribute('aria-valuemin', String(lo))
            const tooltip = hiHandle.querySelector<HTMLElement>('.tc-range-slider-tooltip')
            if (tooltip) tooltip.textContent = String(hi)
        }
        if (fill) {
            fill.style.left = `${loPct}%`
            fill.style.width = `${hiPct - loPct}%`
        }
    }

    private _fireChange(): void {
        const value: [number, number] = [...this._value] as [number, number]
        this.dispatchEvent(new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            detail: { value },
        }))
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    private _valueFromClientX(clientX: number): number {
        const rect = this.querySelector('.tc-range-slider-track')?.getBoundingClientRect()
        if (!rect || rect.width === 0) return this.min
        const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
        return snapToStep(this.min + pct * (this.max - this.min), this.min, this.max, this.step)
    }

    private _onPointerDown = (e: PointerEvent): void => {
        if (this.disabled) return
        const target = e.target as Element
        const handle = target.closest<HTMLElement>('.tc-range-slider-handle')

        if (handle) {
            this._dragging = handle.classList.contains('tc-range-slider-handle--lo') ? 'lo' : 'hi'
            handle.classList.add('tc-range-slider-handle--dragging')
            this._startDrag()
            return
        }

        // Click on track between handles — move nearest handle
        const track = target.closest<HTMLElement>('.tc-range-slider-track')
        if (!track) return

        const newVal = this._valueFromClientX(e.clientX)
        const [lo, hi] = this._value
        const distLo = Math.abs(newVal - lo)
        const distHi = Math.abs(newVal - hi)
        if (distLo <= distHi) {
            this._value = this._coerce(newVal, hi)
        } else {
            this._value = this._coerce(lo, newVal)
        }
        this._patchPositions()
        this._fireChange()
    }

    private _startDrag(): void {
        this._dragMoveHandler = (e: PointerEvent) => {
            const newVal = this._valueFromClientX(e.clientX)
            const [lo, hi] = this._value
            if (this._dragging === 'lo') {
                this._value = [Math.min(newVal, hi), hi]
            } else {
                this._value = [lo, Math.max(newVal, lo)]
            }
            this._patchPositions()
        }
        this._dragUpHandler = () => {
            this._fireChange()
            // Remove dragging class
            const handle = this.querySelector<HTMLElement>(
                this._dragging === 'lo' ? '.tc-range-slider-handle--lo' : '.tc-range-slider-handle--hi',
            )
            handle?.classList.remove('tc-range-slider-handle--dragging')
            this._cleanupDrag()
        }
        document.addEventListener('pointermove', this._dragMoveHandler)
        document.addEventListener('pointerup', this._dragUpHandler)
        document.addEventListener('pointercancel', this._dragUpHandler)
    }

    private _cleanupDrag(): void {
        if (this._dragMoveHandler) {
            document.removeEventListener('pointermove', this._dragMoveHandler)
            this._dragMoveHandler = null
        }
        if (this._dragUpHandler) {
            document.removeEventListener('pointerup', this._dragUpHandler)
            document.removeEventListener('pointercancel', this._dragUpHandler)
            this._dragUpHandler = null
        }
        this._dragging = null
    }

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (this.disabled) return
        const target = e.target as Element
        const handle = target.closest<HTMLElement>('.tc-range-slider-handle')
        if (!handle) return

        const which = handle.classList.contains('tc-range-slider-handle--lo') ? 'lo' : 'hi'
        const step = this.step
        const min = this.min
        const max = this.max
        const bigStep = Math.max(step * 10, (max - min) / 10)
        let [lo, hi] = this._value
        let changed = false

        switch (e.key) {
            case 'ArrowLeft':
            case 'ArrowDown':
                e.preventDefault()
                if (which === 'lo') lo = Math.min(Math.max(snapToStep(lo - step, min, max, step), min), hi)
                else hi = Math.min(Math.max(snapToStep(hi - step, min, max, step), lo), max)
                changed = true
                break
            case 'ArrowRight':
            case 'ArrowUp':
                e.preventDefault()
                if (which === 'lo') lo = Math.min(Math.max(snapToStep(lo + step, min, max, step), min), hi)
                else hi = Math.min(Math.max(snapToStep(hi + step, min, max, step), lo), max)
                changed = true
                break
            case 'PageDown':
                e.preventDefault()
                if (which === 'lo') lo = Math.min(Math.max(snapToStep(lo - bigStep, min, max, step), min), hi)
                else hi = Math.min(Math.max(snapToStep(hi - bigStep, min, max, step), lo), max)
                changed = true
                break
            case 'PageUp':
                e.preventDefault()
                if (which === 'lo') lo = Math.min(Math.max(snapToStep(lo + bigStep, min, max, step), min), hi)
                else hi = Math.min(Math.max(snapToStep(hi + bigStep, min, max, step), lo), max)
                changed = true
                break
            case 'Home':
                e.preventDefault()
                if (which === 'lo') lo = min
                else hi = lo
                changed = true
                break
            case 'End':
                e.preventDefault()
                if (which === 'lo') lo = hi
                else hi = max
                changed = true
                break
        }

        if (changed) {
            this._value = [lo, hi]
            this._patchPositions()
            this._fireChange()
        }
    }

    private _attachHandlers(): void {
        this._detachHandlers()
        this.addEventListener('pointerdown', this._onPointerDown)
        this.addEventListener('keydown', this._onKeyDown)
    }

    private _detachHandlers(): void {
        this.removeEventListener('pointerdown', this._onPointerDown)
        this.removeEventListener('keydown', this._onKeyDown)
    }

    private render(): void {
        const min = this.min
        const max = this.max
        const step = this.step

        // Re-clamp stored value to current constraints
        this._value = this._coerce(this._value[0], this._value[1])
        const [lo, hi] = this._value

        const label = this.label
        const disabled = this.disabled
        const ticks = this.ticks
        const showTooltip = this.showTooltip

        const pct = (v: number) => max === min ? 0 : ((v - min) / (max - min)) * 100
        const loPct = pct(lo)
        const hiPct = pct(hi)

        const tooltipHtml = (v: number) =>
            showTooltip ? `<div class="tc-range-slider-tooltip">${esc(String(v))}</div>` : ''

        const ticksHtml = (() => {
            if (!ticks) return ''
            const numSteps = max > min ? Math.round((max - min) / step) : 0
            const marks: string[] = []
            for (let i = 0; i <= numSteps; i++) {
                const v = snapToStep(min + i * step, min, max, step)
                marks.push(`<div class="tc-range-slider-tick" style="left:${pct(v)}%" aria-hidden="true"></div>`)
            }
            return `<div class="tc-range-slider-ticks" aria-hidden="true">${marks.join('')}</div>`
        })()

        const labelHtml = label != null
            ? `<label class="tc-range-slider-label">${esc(label)}</label>`
            : ''

        const html = [
            labelHtml,
            `<div class="tc-range-slider-track">`,
            `<div class="tc-range-slider-fill" style="left:${loPct}%;width:${hiPct - loPct}%"></div>`,
            `<div class="tc-range-slider-handle tc-range-slider-handle--lo"`,
            ` role="slider"`,
            ` tabindex="${disabled ? -1 : 0}"`,
            ` aria-valuemin="${esc(String(min))}"`,
            ` aria-valuemax="${esc(String(hi))}"`,
            ` aria-valuenow="${esc(String(lo))}"`,
            ` aria-label="Lower value"`,
            ` style="left:${loPct}%"`,
            `>`,
            tooltipHtml(lo),
            `</div>`,
            `<div class="tc-range-slider-handle tc-range-slider-handle--hi"`,
            ` role="slider"`,
            ` tabindex="${disabled ? -1 : 0}"`,
            ` aria-valuemin="${esc(String(lo))}"`,
            ` aria-valuemax="${esc(String(max))}"`,
            ` aria-valuenow="${esc(String(hi))}"`,
            ` aria-label="Upper value"`,
            ` style="left:${hiPct}%"`,
            `>`,
            tooltipHtml(hi),
            `</div>`,
            ticksHtml,
            `</div>`,
        ].join('')

        this.innerHTML = html

        if (disabled) {
            this.setAttribute('aria-disabled', 'true')
        } else {
            this.removeAttribute('aria-disabled')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RangeSlider
    }
}

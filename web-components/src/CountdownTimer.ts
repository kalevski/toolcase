import { esc } from './internal/esc'
const TAG_NAME = 'tc-countdown-timer'

export type CountdownUnit = 'days' | 'hours' | 'minutes' | 'seconds'

const ALL_UNITS: CountdownUnit[] = ['days', 'hours', 'minutes', 'seconds']
const DEFAULT_UNITS: CountdownUnit[] = ['days', 'hours', 'minutes', 'seconds']

const UNIT_LABELS: Record<CountdownUnit, string> = {
    days: 'DAYS',
    hours: 'HRS',
    minutes: 'MIN',
    seconds: 'SEC',
}

const UNIT_SECONDS: Record<CountdownUnit, number> = {
    days: 86400,
    hours: 3600,
    minutes: 60,
    seconds: 1,
}

function parseTargetRaw(raw: string): number {
    const n = Number(raw)
    if (!isNaN(n) && n > 0) return n
    const d = new Date(raw)
    return isNaN(d.getTime()) ? 0 : d.getTime()
}

function parseUnitsRaw(raw: string): CountdownUnit[] {
    const parts = raw
        .split(',')
        .map((u) => u.trim() as CountdownUnit)
        .filter((u) => ALL_UNITS.includes(u))
    return parts.length > 0 ? parts : [...DEFAULT_UNITS]
}

export class CountdownTimer extends HTMLElement {
    private _initialised = false
    private _targetMs = 0
    private _units: CountdownUnit[] = [...DEFAULT_UNITS]
    private _expired = false
    private _intervalId: ReturnType<typeof setInterval> | null = null
    private _visibilityHandler: (() => void) | null = null

    onexpire: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['target', 'units', 'label', 'sub-label', 'compact']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const targetAttr = this.getAttribute('target')
            if (targetAttr) this._targetMs = parseTargetRaw(targetAttr)
            const unitsAttr = this.getAttribute('units')
            if (unitsAttr) this._units = parseUnitsRaw(unitsAttr)
            this.render()
            this._initialised = true
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'target') {
            const raw = this.getAttribute('target') ?? ''
            this._targetMs = raw ? parseTargetRaw(raw) : 0
            this._expired = false
        } else if (name === 'units') {
            const raw = this.getAttribute('units') ?? ''
            this._units = raw ? parseUnitsRaw(raw) : [...DEFAULT_UNITS]
        }
        this.render()
        if (name === 'target') {
            this._detachHandlers()
            this._attachHandlers()
        }
    }

    get target(): Date | number {
        return this._targetMs
    }
    set target(v: Date | number) {
        this._targetMs = v instanceof Date ? v.getTime() : Number(v) || 0
        this._expired = false
        if (this._initialised) {
            this.render()
            this._detachHandlers()
            this._attachHandlers()
        }
    }

    get units(): CountdownUnit[] {
        return this._units
    }
    set units(v: CountdownUnit[]) {
        const filtered = Array.isArray(v) ? v.filter((u) => ALL_UNITS.includes(u)) : []
        this._units = filtered.length > 0 ? filtered : [...DEFAULT_UNITS]
        if (this._initialised) this.render()
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get subLabel(): string | null {
        return this.getAttribute('sub-label')
    }
    set subLabel(v: string | null) {
        if (v != null) this.setAttribute('sub-label', v)
        else this.removeAttribute('sub-label')
    }

    get compact(): boolean {
        return this.hasAttribute('compact')
    }
    set compact(v: boolean) {
        if (v) this.setAttribute('compact', '')
        else this.removeAttribute('compact')
    }

    private _decompose(ms: number): Record<CountdownUnit, number> {
        const totalSec = Math.floor(ms / 1000)
        const result: Record<CountdownUnit, number> = { days: 0, hours: 0, minutes: 0, seconds: 0 }
        let remaining = totalSec
        for (const unit of ALL_UNITS) {
            if (!this._units.includes(unit)) continue
            result[unit] = Math.floor(remaining / UNIT_SECONDS[unit])
            remaining %= UNIT_SECONDS[unit]
        }
        return result
    }

    private _attachHandlers(): void {
        this._detachHandlers()
        this._visibilityHandler = () => {
            if (document.hidden) {
                this._clearInterval()
            } else {
                this._tick()
                if (!this._expired) this._startInterval()
            }
        }
        document.addEventListener('visibilitychange', this._visibilityHandler)
        if (!document.hidden && !this._expired) {
            this._startInterval()
        }
    }

    private _detachHandlers(): void {
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler)
            this._visibilityHandler = null
        }
        this._clearInterval()
    }

    private _startInterval(): void {
        this._clearInterval()
        this._intervalId = setInterval(() => this._tick(), 1000)
    }

    private _clearInterval(): void {
        if (this._intervalId !== null) {
            clearInterval(this._intervalId)
            this._intervalId = null
        }
    }

    private _tick(): void {
        const remaining = Math.max(0, this._targetMs - Date.now())
        const parts = this._decompose(remaining)
        const units = this._units

        const valueEls = this.querySelectorAll<HTMLElement>('.tc-countdown-value')
        units.forEach((unit, i) => {
            const el = valueEls[i]
            if (el) {
                const num = parts[unit]
                el.textContent = String(num).padStart(2, '0')
                el.setAttribute('aria-label', `${num} ${unit}`)
            }
        })

        if (remaining === 0 && !this._expired) {
            this._expired = true
            this._clearInterval()
            this.dispatchEvent(
                new CustomEvent('tc-expire', {
                    bubbles: true,
                    composed: true,
                    detail: {},
                }),
            )
            if (typeof this.onexpire === 'function') this.onexpire()
        }
    }

    private render(): void {
        const units = this._units
        const label = this.getAttribute('label')
        const subLabel = this.getAttribute('sub-label')
        const compact = this.hasAttribute('compact')

        const remaining = Math.max(0, this._targetMs - Date.now())
        const parts = this._decompose(remaining)

        const labelHtml = label ? `<div class="tc-countdown-label">${esc(label)}</div>` : ''
        const subHtml = subLabel ? `<div class="tc-countdown-sub">${esc(subLabel)}</div>` : ''

        let unitsHtml: string
        if (compact) {
            const items = units.map((unit, i) => {
                const num = parts[unit]
                const val = String(num).padStart(2, '0')
                const sep =
                    i < units.length - 1
                        ? '<span class="tc-countdown-sep" aria-hidden="true">:</span>'
                        : ''
                return `<span class="tc-countdown-value" aria-label="${esc(String(num))} ${esc(unit)}">${esc(val)}</span>${sep}`
            })
            unitsHtml = `<div class="tc-countdown-units">${items.join('')}</div>`
        } else {
            const cells = units.map((unit) => {
                const num = parts[unit]
                const val = String(num).padStart(2, '0')
                return (
                    `<div class="tc-countdown-unit">` +
                    `<span class="tc-countdown-value" aria-label="${esc(String(num))} ${esc(unit)}">${esc(val)}</span>` +
                    `<span class="tc-countdown-unit-label" aria-hidden="true">${UNIT_LABELS[unit]}</span>` +
                    `</div>`
                )
            })
            unitsHtml = `<div class="tc-countdown-units">${cells.join('')}</div>`
        }

        const compactClass = compact ? ' tc-countdown--compact' : ''
        this.innerHTML =
            `<div class="tc-countdown${compactClass}" aria-live="polite" role="timer">` +
            labelHtml +
            unitsHtml +
            subHtml +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CountdownTimer
    }
}

import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-cycle-wheel'

// Minimal HTML-escape for user-supplied strings injected into innerHTML.

const DEFAULT_SPIN = 20

/**
 * tc-cycle-wheel — animated circular wheel with a continuously rotating ring of
 * phase labels around a fixed centre stack. Presentational/animated: no events.
 * Port of `@toolcase/react-components` `CycleWheel`.
 */
export class CycleWheel extends HTMLElement {
    private _initialised = false
    private _phases: string[] = []

    static get observedAttributes(): string[] {
        return [
            'current-index',
            'center-label',
            'center-value',
            'center-pill',
            'center-sub',
            'spin-seconds',
            'paused',
        ]
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

    // phases — JS PROPERTY only (array of strings). Setting re-renders the ring.
    get phases(): string[] {
        return this._phases
    }
    set phases(v: string[]) {
        this._phases = Array.isArray(v) ? v.map(String) : []
        if (this._initialised) this.render()
    }

    get currentIndex(): number {
        return parseInt(this.getAttribute('current-index') ?? '0', 10) || 0
    }
    set currentIndex(v: number) {
        this.setAttribute('current-index', String(v))
    }

    get centerLabel(): string | null {
        return this.getAttribute('center-label')
    }
    set centerLabel(v: string | null) {
        if (v != null) this.setAttribute('center-label', v)
        else this.removeAttribute('center-label')
    }

    get centerValue(): string | null {
        return this.getAttribute('center-value')
    }
    set centerValue(v: string | null) {
        if (v != null) this.setAttribute('center-value', v)
        else this.removeAttribute('center-value')
    }

    get centerPill(): string | null {
        return this.getAttribute('center-pill')
    }
    set centerPill(v: string | null) {
        if (v != null) this.setAttribute('center-pill', v)
        else this.removeAttribute('center-pill')
    }

    get centerSub(): string | null {
        return this.getAttribute('center-sub')
    }
    set centerSub(v: string | null) {
        if (v != null) this.setAttribute('center-sub', v)
        else this.removeAttribute('center-sub')
    }

    get spinSeconds(): number {
        const v = parseFloat(this.getAttribute('spin-seconds') ?? '')
        return Number.isFinite(v) && v > 0 ? v : DEFAULT_SPIN
    }
    set spinSeconds(v: number) {
        this.setAttribute('spin-seconds', String(v))
    }

    get paused(): boolean {
        return this.hasAttribute('paused')
    }
    set paused(v: boolean) {
        if (v) this.setAttribute('paused', '')
        else this.removeAttribute('paused')
    }

    private render(): void {
        const phases = this._phases
        const count = Math.max(phases.length, 1)
        const slotAngle = 360 / count
        const active = phases.length
            ? ((this.currentIndex % phases.length) + phases.length) % phases.length
            : -1
        const arrowRot = active >= 0 ? active * slotAngle : 0
        const spin = this.spinSeconds

        // Host-owned state classes — managed surgically so author classes survive.
        this.classList.add('tc-cycle-wheel')
        this.classList.toggle('tc-cycle-wheel--paused', this.paused)

        // Accessible summary (the SVGs are decorative / aria-hidden).
        const activePhase = active >= 0 ? phases[active] : ''
        const value = this.centerValue ?? ''
        const label = this.centerLabel ?? ''
        const sub = this.centerSub ?? ''
        const ariaParts = [
            label,
            activePhase ? `${activePhase} phase` : '',
            value ? `value ${value}` : '',
            sub,
        ].filter(Boolean)
        this.setAttribute('role', 'img')
        this.setAttribute('aria-label', ariaParts.join(', '))

        // Ring labels — each phase placed at its slot via a per-label rotation.
        // The whole ring spins; the active label is the only accented element.
        const labelsHtml = phases
            .map((p, i) => {
                const rot = (i * slotAngle).toFixed(3)
                const cls =
                    i === active
                        ? 'tc-cycle-wheel__label tc-cycle-wheel__label--active'
                        : 'tc-cycle-wheel__label'
                return `<g transform="rotate(${rot} 200 200)"><text x="200" y="22" text-anchor="middle" dominant-baseline="middle" class="${cls}">${esc(p.toUpperCase())}</text></g>`
            })
            .join('')

        // Static pointer (does not spin): per-slot ticks + an arrow oriented to
        // the active phase, so the wheel reads as "oriented" even at rest.
        const ticksHtml = phases
            .map(
                (_, i) =>
                    `<line x1="0" y1="-196" x2="0" y2="-184" transform="rotate(${(i * slotAngle).toFixed(3)})" />`,
            )
            .join('')

        const labelEl = label ? `<div class="tc-cycle-wheel__core-label">${esc(label)}</div>` : ''
        const valueEl = `<div class="tc-cycle-wheel__core-value">${esc(value)}</div>`
        const pillEl = this.centerPill
            ? `<div class="tc-cycle-wheel__core-pill">${esc(this.centerPill)}</div>`
            : ''
        const subEl = sub ? `<div class="tc-cycle-wheel__core-sub">${esc(sub)}</div>` : ''

        patchHtml(
            this,
            `<div class="tc-cycle-wheel__inner">
    <svg class="tc-cycle-wheel__ring" viewBox="0 0 400 400" aria-hidden="true" style="animation-duration:${spin}s">
        <circle class="tc-cycle-wheel__track tc-cycle-wheel__track--outer" cx="200" cy="200" r="196" fill="none" stroke-dasharray="3 4" />
        <circle class="tc-cycle-wheel__track tc-cycle-wheel__track--inner" cx="200" cy="200" r="174" fill="none" stroke-dasharray="2 5" />
        ${labelsHtml}
    </svg>
    <svg class="tc-cycle-wheel__pointer" viewBox="0 0 400 400" aria-hidden="true">
        <g class="tc-cycle-wheel__ticks" transform="translate(200,200)">${ticksHtml}</g>
        <g class="tc-cycle-wheel__arrow" transform="translate(200,200) rotate(${arrowRot.toFixed(3)})">
            <line x1="0" y1="-184" x2="0" y2="-120" />
            <circle r="6" cx="0" cy="-184" />
        </g>
    </svg>
    <div class="tc-cycle-wheel__core">${labelEl}${valueEl}${pillEl}${subEl}</div>
</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CycleWheel
    }
}

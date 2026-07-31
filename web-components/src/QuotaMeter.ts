// tc-quota-meter — „how much of your allowance is gone", as a hairline track with a
// figure beside it.
//
//   1c  variant="inline"  a 78x5 amber track + „12/30", right of the „12 рецепти" count
//   1h  variant="bar"     a full-width 6px track, no figure, above the tick-off list
//   1g  variant="bar"     the same 6px rail again, under the range control's thumb
//
// THREE PROGRESS-ISH ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-progress / tc-progress-bar  Bootstrap's gauge: 8 named variants, striped and
//                                  animated modes, a numeral INSIDE the bar, stacked
//                                  segments. It measures a TASK.
//   tc-circular-progress           the same task, as a ring.
//   tc-quota-meter                 this one. It measures an ALLOWANCE: two numbers
//                                  (used, total), a figure OUTSIDE the track, and one
//                                  rule about colour that the other two do not have.
//
// THE COLOUR-ON-APPROACH RULE LIVES HERE
//   At `warn-at` (90% by default) the fill turns ochre; at 100% it turns coral. That
//   is not decoration — a quota-limited plan is the thing the app sells against, and
//   „you are nearly out" has to be visible before the creation button starts
//   refusing. It is a rule about the DATA, so it belongs to the component that holds
//   the data rather than being re-derived by every caller (the app had it in
//   LimitMeter.tsx as `used >= limit - 1`, which is a different rule from 90% and is
//   what `warn-at` exists to express: `warn-at={(limit - 1) / limit * 100}`).
//
//   Colour is never the ONLY carrier: the figure („29/30") is the same information as
//   text, and `state` is reflected onto the host for a caller that wants to say more.
//
// WHY THE STATE IS COMPUTED IN JS AND NOT IN CSS
//   „Is this percentage past a threshold?" is a comparison, and CSS cannot make one
//   against a custom property. The element writes `data-state="ok|near|full"` and the
//   partial colours the fill off it. That attribute is also what makes the state
//   testable and greppable, instead of living inside a colour.

const TAG_NAME = 'tc-quota-meter'

/** `inline` = 1c's 78px track beside a figure · `bar` = 1h's full-width rail. */
export type QuotaMeterVariant = 'inline' | 'bar'
const VARIANTS: QuotaMeterVariant[] = ['inline', 'bar']

export type QuotaMeterLabelFormat = 'fraction' | 'percent' | 'remaining' | 'none'
const LABEL_FORMATS: QuotaMeterLabelFormat[] = ['fraction', 'percent', 'remaining', 'none']

/** The base fill, BEFORE the approach states override it. */
export type QuotaMeterTone = 'lead' | 'accent' | 'success'
const TONES: QuotaMeterTone[] = ['lead', 'accent', 'success']

export type QuotaMeterState = 'ok' | 'near' | 'full'

export class QuotaMeter extends HTMLElement {
    private _track: HTMLElement | null = null
    private _built = false

    static get observedAttributes(): string[] {
        // `tone` and `variant` are pure CSS state and are observed only so that
        // scripts/gen-react-types.mjs types them as JSX props — it reads this list.
        return [
            'label-format',
            'spoken',
            'suffix',
            'tone',
            'total',
            'used',
            'variant',
            'warn-at',
            'width',
        ]
    }

    connectedCallback(): void {
        this._render()
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (!this.isConnected || prev === next) return
        // `tone` is pure CSS state. `variant` is too, EXCEPT that it decides the
        // label's default format — see the labelFormat getter — so it re-renders.
        if (name === 'tone') return
        this._render()
    }

    get used(): number {
        const raw = Number(this.getAttribute('used'))
        return Number.isFinite(raw) ? raw : 0
    }
    set used(v: number) {
        this.setAttribute('used', String(v))
    }

    /** The allowance. `0` or absent ⇒ no cap: the track renders empty and reports nothing. */
    get total(): number {
        const raw = Number(this.getAttribute('total'))
        return Number.isFinite(raw) ? raw : 0
    }
    set total(v: number) {
        this.setAttribute('total', String(v))
    }

    /** `used/total` as a percentage, un-clamped — 32/30 reports 106.7. */
    get percent(): number {
        const total = this.total
        if (total <= 0) return 0
        return (this.used / total) * 100
    }

    /** Where the fill turns ochre, as a percentage. */
    get warnAt(): number {
        const raw = Number(this.getAttribute('warn-at'))
        return Number.isFinite(raw) && raw > 0 ? raw : 90
    }
    set warnAt(v: number | null) {
        if (v != null) this.setAttribute('warn-at', String(v))
        else this.removeAttribute('warn-at')
    }

    /** Derived, read-only, and reflected onto the host as `data-state`. */
    get state(): QuotaMeterState {
        const pct = this.percent
        if (this.total > 0 && pct >= 100) return 'full'
        if (this.total > 0 && pct >= this.warnAt) return 'near'
        return 'ok'
    }

    /**
     * Defaults to `fraction` on the inline meter and `none` on the bar — `1h` draws a
     * bare rail because its app bar already carries „N од 7 купено", and a second
     * figure 12px below the first is a duplicate rather than a reading.
     */
    get labelFormat(): QuotaMeterLabelFormat {
        const raw = this.getAttribute('label-format') as QuotaMeterLabelFormat
        if (LABEL_FORMATS.includes(raw)) return raw
        return this.variant === 'bar' ? 'none' : 'fraction'
    }
    set labelFormat(v: QuotaMeterLabelFormat | null) {
        if (v != null) this.setAttribute('label-format', v)
        else this.removeAttribute('label-format')
    }

    /** A word after the figure — „планови", „клиенти". The library ships no copy. */
    get suffix(): string | null {
        return this.getAttribute('suffix')
    }
    set suffix(v: string | null) {
        if (v != null) this.setAttribute('suffix', v)
        else this.removeAttribute('suffix')
    }

    get variant(): QuotaMeterVariant {
        const raw = this.getAttribute('variant') as QuotaMeterVariant
        return VARIANTS.includes(raw) ? raw : 'inline'
    }
    set variant(v: QuotaMeterVariant) {
        this.setAttribute('variant', VARIANTS.includes(v) ? v : 'inline')
    }

    get tone(): QuotaMeterTone {
        const raw = this.getAttribute('tone') as QuotaMeterTone
        return TONES.includes(raw) ? raw : 'lead'
    }
    set tone(v: QuotaMeterTone) {
        this.setAttribute('tone', TONES.includes(v) ? v : 'lead')
    }

    /**
     * Track length for the inline variant — any CSS length, or a bare number read as
     * px. Absent ⇒ `--bs-quota-meter-track-width` (78px, `1c`). Ignored by the bar
     * variant, which is always `flex: 1 1 0`.
     */
    get width(): string | null {
        return this.getAttribute('width')
    }
    set width(v: string | number | null) {
        if (v != null) this.setAttribute('width', String(v))
        else this.removeAttribute('width')
    }

    /**
     * The track's accessible name, SPOKEN — „искористени планови". Absent ⇒ the
     * progressbar is un-named and a screen reader reports only its value, which is
     * adequate beside a visible figure and wrong beside a bare rail.
     */
    get spoken(): string | null {
        return this.getAttribute('spoken')
    }
    set spoken(v: string | null) {
        if (v != null) this.setAttribute('spoken', v)
        else this.removeAttribute('spoken')
    }

    /** What the label reads, or `''` when `label-format="none"`. */
    get labelText(): string {
        const format = this.labelFormat
        if (format === 'none') return ''
        const suffix = this.suffix
        let figure: string
        // With no cap every format degenerates: „5/0", „Infinity%", „−5 remaining". The
        // bare count is the only true reading — „5 планови", no limit — and it matches
        // the track, which reports nothing in that state either.
        if (this.total <= 0) figure = String(this.used)
        else if (format === 'percent') figure = `${Math.round(this.percent)}%`
        else if (format === 'remaining') figure = String(Math.max(0, this.total - this.used))
        else figure = `${this.used}/${this.total}`
        return suffix ? `${figure} ${suffix}` : figure
    }

    // ── Render ───────────────────────────────────────────────────────────────

    // TEXT AND WIDTH ARE PATCHED, STRUCTURE IS BUILT ONCE. `1h` writes `used` on every
    // tick-off; rebuilding the track would restart the width transition from 0 rather
    // than continuing it from where it was.
    private _render(): void {
        const track = this._ensureTrack()
        if (!this._built || !track.firstChild) {
            track.innerHTML = `<div class="tc-quota-meter-fill"></div>`
            this._built = true
        }

        const total = this.total
        const pct = this.percent
        // The FILL is clamped even though `percent` is not: 32/30 is a real state the
        // app has to report, and a 106% wide fill would overflow the track's radius.
        const width = Math.max(0, Math.min(100, pct))
        const fill = track.querySelector<HTMLElement>('.tc-quota-meter-fill')
        if (fill) fill.style.width = `${width.toFixed(1)}%`

        this.dataset.state = this.state

        const authored = this.width
        // Only written when authored, so the CSS default stays addressable through
        // `--bs-quota-meter-track-width` for a caller that would rather theme it.
        if (authored && this.variant === 'inline') {
            track.style.width = /^-?\d+(\.\d+)?$/.test(authored) ? `${authored}px` : authored
        } else {
            track.style.removeProperty('width')
        }

        const label = this.labelText
        const labelEl = this._ensureLabel()
        if (labelEl.textContent !== label) labelEl.textContent = label
        labelEl.hidden = label === ''

        if (total > 0) {
            track.setAttribute('role', 'progressbar')
            track.setAttribute('aria-valuemin', '0')
            track.setAttribute('aria-valuemax', String(total))
            track.setAttribute('aria-valuenow', String(this.used))
            track.removeAttribute('aria-hidden')
            // Only when a figure is on screen, so what is announced is what is read.
            if (label) track.setAttribute('aria-valuetext', label)
            else track.removeAttribute('aria-valuetext')
            const spoken = this.spoken
            if (spoken) track.setAttribute('aria-label', spoken)
            else track.removeAttribute('aria-label')
        } else {
            // No cap ⇒ nothing to report. A progressbar with `aria-valuemax="0"` is
            // invalid and some screen readers announce it as „0 percent", which is the
            // opposite of what an uncapped allowance means.
            for (const attr of [
                'role',
                'aria-valuemin',
                'aria-valuemax',
                'aria-valuenow',
                'aria-valuetext',
                'aria-label',
            ]) {
                track.removeAttribute(attr)
            }
            track.setAttribute('aria-hidden', 'true')
        }
    }

    // Both regions are created once and reused. Inserted in reading order — track,
    // then figure — which is also the order the design draws them.
    private _ensureTrack(): HTMLElement {
        let track = this._track
        if (track?.parentNode === this) return track
        track = this.querySelector<HTMLElement>(':scope > .tc-quota-meter-track')
        if (!track) {
            track = document.createElement('div')
            track.className = 'tc-quota-meter-track'
            this.insertBefore(track, this.firstChild)
            this._built = false
        }
        this._track = track
        return track
    }

    private _ensureLabel(): HTMLElement {
        let label = this.querySelector<HTMLElement>(':scope > .tc-quota-meter-label')
        if (!label) {
            label = document.createElement('span')
            label.className = 'tc-quota-meter-label'
            this.appendChild(label)
        }
        return label
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: QuotaMeter
    }
}

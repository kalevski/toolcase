import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { num, setAttr } from './internal/tc-element'

// tc-value-in-range — where one figure sits inside a distribution.
//
// polovni.mk wrote this three times — `SpecScale` (169), `PriceSpanRail` (102)
// and `PriceRangeBars` (92) — and they are one element with three skins. The
// library's chart set has no equivalent, because this is not a chart: there are
// no axes, no legend and no series. There is one value and the things it is
// being compared against.
//
// THE ANCHORS ARE THE POINT, and `SpecScale`'s own note says why. Its first
// version used a four-band ladder — relaxed · easy-going · strong · highly strung
// — which is only readable by someone who already knows what 112 PS per litre
// means. The same track labelled "family diesel · modern turbo · hot hatch ·
// supercar" answers "is that a lot?" without the reader learning anything first.
//
// THE ANCHORS ARE SPREAD EVENLY and the track is a piecewise-linear map from real
// values onto those positions. Placed at their raw ratios, three of four
// archetypes bunched into the left third of every track and the fourth pressed
// against the end, so the labels collided and the useful middle of the scale was
// a few pixels wide. Moving the LABELS alone would have been a lie — the whole
// claim is that the marker sits between two named things — so the marker is
// mapped through the same function.
//
// ONLY THE OUTER TWO ANCHORS KEEP A WORD. Four labels under one track stagger
// onto two rows to avoid colliding, and a staggered row of 10px text under a 6px
// bar is read as decoration rather than as a scale. Every anchor keeps its TICK,
// which says "there are four familiar things along here"; the ends say which way
// is more. The full set stays in the track's `aria-label`, which is where a
// screen reader needs it.
//
// THE RAW FIGURE IS NOT PRINTED on the track. Where the marker sits between the
// archetypes IS the answer; the figure beside it is the same fact in the units
// the archetypes exist to translate away from. Pass it as `value` — it is the
// element's accessible description and the `span` skin's centre plate.

const TAG_NAME = 'tc-value-in-range'

export interface ValueInRangeAnchor {
    /** Where this anchor really sits, in the caller's own units. */
    at: number
    /** The word under the tick. Only the first and last are drawn. */
    label?: string
}

/** `scale` is the anchored track; `span` is a floor/ceiling pair with an optional
 *  median riding the rail. */
export type ValueInRangeVariant = 'scale' | 'span'
const VARIANTS: ValueInRangeVariant[] = ['scale', 'span']

export type ValueInRangeTone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
const TONES: ValueInRangeTone[] = ['accent', 'success', 'warning', 'danger', 'info', 'neutral']

/** How much track is left outside the first and last anchor, so a marker sitting
 *  on an end still has a tick to sit against. */
const EDGE = 0.1

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export class ValueInRange extends HTMLElement {
    private _built = false
    private _anchors: ValueInRangeAnchor[] = []
    private _track: HTMLElement | null = null

    static get observedAttributes(): string[] {
        return [
            'label',
            'value',
            'at',
            'min',
            'max',
            'median',
            'caption',
            'low-label',
            'high-label',
            'variant',
            'tone',
            'compact',
            'class',
        ]
    }

    connectedCallback(): void {
        if (!this._built) {
            this.insertAdjacentHTML(
                'afterbegin',
                `<span class="tc-value-in-range__head">` +
                    `<span class="tc-value-in-range__label"></span>` +
                    `<span class="tc-value-in-range__value"></span>` +
                    `</span>` +
                    `<span class="tc-value-in-range__track">` +
                    `<span class="tc-value-in-range__fill"></span>` +
                    `<span class="tc-value-in-range__ticks"></span>` +
                    `<span class="tc-value-in-range__marker"></span>` +
                    `</span>` +
                    `<span class="tc-value-in-range__ends">` +
                    `<span class="tc-value-in-range__end tc-value-in-range__end--low"></span>` +
                    `<span class="tc-value-in-range__end tc-value-in-range__end--high"></span>` +
                    `</span>` +
                    `<span class="tc-value-in-range__caption"></span>`,
            )
            this._track = this.querySelector(':scope > .tc-value-in-range__track')
            this._built = true
        }
        this.patch()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** The named things this value is placed between. A JS property. */
    get anchors(): ValueInRangeAnchor[] {
        return this._anchors
    }
    set anchors(v: ValueInRangeAnchor[]) {
        this._anchors = Array.isArray(v) ? v : []
        if (this._built) this.patch()
    }

    /** What this scale is measuring — "Power per litre", "Asking price". */
    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    /** The figure, already formatted. Shown beside the label, never on the track. */
    get value(): string | null {
        return this.getAttribute('value')
    }
    set value(v: string | null) {
        if (v != null) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    /** Where the marker goes, in the caller's own units. */
    get at(): number | null {
        const raw = this.getAttribute('at')
        return raw == null || raw === '' ? null : num(raw, 0)
    }
    set at(v: number | null) {
        if (v != null) this.setAttribute('at', String(v))
        else this.removeAttribute('at')
    }

    /** The `span` skin's floor. */
    get min(): number | null {
        const raw = this.getAttribute('min')
        return raw == null || raw === '' ? null : num(raw, 0)
    }
    set min(v: number | null) {
        if (v != null) this.setAttribute('min', String(v))
        else this.removeAttribute('min')
    }

    /** The `span` skin's ceiling. */
    get max(): number | null {
        const raw = this.getAttribute('max')
        return raw == null || raw === '' ? null : num(raw, 0)
    }
    set max(v: number | null) {
        if (v != null) this.setAttribute('max', String(v))
        else this.removeAttribute('max')
    }

    /** The `span` skin's middle. Absent draws floor and ceiling alone — which is
     *  what a family median that averages things that are not the same buy
     *  deserves, and the reason the originating app made it optional. */
    get median(): number | null {
        const raw = this.getAttribute('median')
        return raw == null || raw === '' ? null : num(raw, 0)
    }
    set median(v: number | null) {
        if (v != null) this.setAttribute('median', String(v))
        else this.removeAttribute('median')
    }

    /** The sentence under the track — what the position costs the reader. */
    get caption(): string | null {
        return this.getAttribute('caption')
    }
    set caption(v: string | null) {
        if (v != null) this.setAttribute('caption', v)
        else this.removeAttribute('caption')
    }

    /** The word under the low end. Falls back to the first anchor's label. */
    get lowLabel(): string | null {
        return this.getAttribute('low-label') ?? this._anchors[0]?.label ?? null
    }
    set lowLabel(v: string | null) {
        if (v != null) this.setAttribute('low-label', v)
        else this.removeAttribute('low-label')
    }

    /** The word under the high end. Falls back to the last anchor's label. */
    get highLabel(): string | null {
        return (
            this.getAttribute('high-label') ??
            this._anchors[this._anchors.length - 1]?.label ??
            null
        )
    }
    set highLabel(v: string | null) {
        if (v != null) this.setAttribute('high-label', v)
        else this.removeAttribute('high-label')
    }

    get variant(): ValueInRangeVariant {
        const v = this.getAttribute('variant') as ValueInRangeVariant
        return VARIANTS.includes(v) ? v : 'scale'
    }
    set variant(v: ValueInRangeVariant) {
        setAttr(this, 'variant', v)
    }

    get tone(): ValueInRangeTone {
        const v = this.getAttribute('tone') as ValueInRangeTone
        return TONES.includes(v) ? v : 'accent'
    }
    set tone(v: ValueInRangeTone) {
        setAttr(this, 'tone', v)
    }

    /** Two rows instead of three: the caption moves out to whatever expander the
     *  surface already has. */
    get compact(): boolean {
        return this.hasAttribute('compact')
    }
    set compact(v: boolean) {
        if (v) this.setAttribute('compact', '')
        else this.removeAttribute('compact')
    }

    /**
     * The piecewise-linear map from a real value onto the track.
     *
     * Anchors are placed at EDGE, …, 1 − EDGE in equal steps. A value between two
     * anchors is interpolated between their two positions, so the marker keeps its
     * meaning ("between a hot hatch and a supercar") while the labels keep their
     * spacing. Outside the outer anchors it is clamped into the edge margin, which
     * is what stops a supercar's marker leaving the track.
     */
    private _position(value: number): number {
        const anchors = this._anchors
        if (anchors.length === 0) {
            // No anchors: the span skin's own floor and ceiling are the scale.
            const min = this.min
            const max = this.max
            if (min == null || max == null || max === min) return 0.5
            return clamp01((value - min) / (max - min))
        }
        if (anchors.length === 1) return 0.5

        const placed = anchors.map((anchor, index) => ({
            at: anchor.at,
            display: EDGE + ((1 - 2 * EDGE) * index) / (anchors.length - 1),
        }))
        if (value <= placed[0].at) {
            const first = placed[0]
            const second = placed[1]
            const span = second.at - first.at
            if (span <= 0) return first.display
            // Below the first archetype: extrapolate into the edge margin rather
            // than pinning to it, so two cars below the floor are still ordered.
            const ratio = (value - first.at) / span
            return clamp01(first.display + ratio * (second.display - first.display))
        }
        for (let i = 1; i < placed.length; i += 1) {
            const previous = placed[i - 1]
            const current = placed[i]
            if (value > current.at) continue
            const span = current.at - previous.at
            const ratio = span <= 0 ? 1 : (value - previous.at) / span
            return clamp01(previous.display + ratio * (current.display - previous.display))
        }
        const last = placed[placed.length - 1]
        const previous = placed[placed.length - 2]
        const span = last.at - previous.at
        if (span <= 0) return last.display
        const ratio = (value - last.at) / span
        return clamp01(last.display + ratio * (last.display - previous.display))
    }

    private patch(): void {
        const variant = this.variant
        setHostClass(
            this,
            `tc-value-in-range tc-value-in-range--${variant} tc-value-in-range--${this.tone}` +
                (this.compact ? ' tc-value-in-range--compact' : ''),
        )

        const label = this.label ?? ''
        const value = this.value ?? ''
        const caption = this.caption ?? ''
        this._text('.tc-value-in-range__label', label)
        this._text('.tc-value-in-range__value', value)
        this._text('.tc-value-in-range__caption', caption)
        this._text('.tc-value-in-range__end--low', this.lowLabel ?? '')
        this._text('.tc-value-in-range__end--high', this.highLabel ?? '')

        const head = this.querySelector<HTMLElement>(':scope > .tc-value-in-range__head')
        if (head) head.hidden = label === '' && value === ''

        this._renderTicks()
        this._placeMarker()

        // The full anchor list, and the figure, live here — the one place a screen
        // reader can get what the drawing says without the drawing.
        const track = this._track
        if (track) {
            const spoken = [
                label,
                value,
                ...this._anchors.filter((a) => a.label).map((a) => a.label as string),
            ].filter(Boolean)
            track.setAttribute('role', 'img')
            track.setAttribute('aria-label', spoken.join(' · '))
        }
    }

    private _text(selector: string, text: string): void {
        const node = this.querySelector<HTMLElement>(selector)
        if (!node) return
        if (node.textContent !== text) node.textContent = text
        node.hidden = text === ''
    }

    // Element-owned container.
    private _renderTicks(): void {
        const ticks = this.querySelector<HTMLElement>('.tc-value-in-range__ticks')
        if (!ticks) return
        const count = this._anchors.length
        const html =
            count < 2
                ? ''
                : this._anchors
                      .map((anchor, index) => {
                          const at = EDGE + ((1 - 2 * EDGE) * index) / (count - 1)
                          const title = anchor.label ? ` title="${esc(anchor.label)}"` : ''
                          return (
                              `<span class="tc-value-in-range__tick"` +
                              ` style="left:${(at * 100).toFixed(3)}%"${title}></span>`
                          )
                      })
                      .join('')
        if (ticks.innerHTML !== html) ticks.innerHTML = html
    }

    private _placeMarker(): void {
        const marker = this.querySelector<HTMLElement>('.tc-value-in-range__marker')
        const fill = this.querySelector<HTMLElement>('.tc-value-in-range__fill')
        if (!marker || !fill) return

        if (this.variant === 'span') {
            // The span skin fills between the floor and the ceiling and puts the
            // marker on the median when there is one.
            const min = this.min
            const max = this.max
            const median = this.median
            const known = min != null && max != null
            fill.hidden = !known
            if (known) {
                fill.style.left = '0%'
                fill.style.width = '100%'
            }
            // Clamped off the ends so the median figure never collides with a plate.
            const at =
                median != null && known
                    ? Math.min(0.9, Math.max(0.1, this._position(median)))
                    : null
            marker.hidden = at == null
            if (at != null) marker.style.left = `${(at * 100).toFixed(3)}%`
            return
        }

        const at = this.at
        fill.hidden = true
        marker.hidden = at == null
        if (at == null) return
        marker.style.left = `${(this._position(at) * 100).toFixed(3)}%`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ValueInRange
    }
}

import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { num, setAttr } from './internal/tc-element'

// tc-range-field — a from–to numeric pair, with optional one-tap spans above it.
//
// From polovni.mk, where four sheets carried a numeric range and only one was
// complete: the digit strip, the presets, the unit converter, and the
// remount-on-preset. The other three were strict subsets, and one hardcoded a
// currency in its heading while the reader was reading another.
//
// DISTINCT FROM `tc-range-slider`, which is a DRAG control: two thumbs on a
// track, for a bounded span you feel your way along. This is a TYPED pair, for a
// span whose bounds are open at one end and whose values are figures a reader
// knows ("under 5000", "from 2015"). A slider cannot express "no upper bound",
// and a phone thumb cannot land on a single year in a 40-year track.
//
// THE INPUTS ARE UNCONTROLLED, and that is the whole reason the presets are a
// separate mechanism. Typing is never rewritten mid-keystroke; a preset changes
// the value from OUTSIDE the inputs, which `defaultValue` cannot show, so the
// element writes the pair directly on a preset and on nothing else.
//
// `bounds-min` / `bounds-max` are the real span of the filtered set and are used
// as PLACEHOLDER text, so the reader types inside what exists instead of guessing.

const TAG_NAME = 'tc-range-field'

export interface RangeFieldPreset {
    id: string
    label: string
    /** Inclusive lower bound. `null` means "no floor". */
    min: number | null
    /** Inclusive upper bound. `null` means "no ceiling". */
    max: number | null
}

export interface RangeFieldChangeDetail {
    from: number | null
    to: number | null
}

/** Strip everything that is not a digit, then reject what is left if it is not a
 *  usable figure. A range field is read by people who type "12 000" and "12.000". */
const digits = (raw: string): number | null => {
    const cleaned = raw.replace(/\D+/g, '')
    if (cleaned === '') return null
    const value = Number(cleaned)
    return Number.isFinite(value) && value > 0 ? value : null
}

export class RangeField extends HTMLElement {
    private _built = false
    private _presets: RangeFieldPreset[] = []
    private _chips: HTMLElement | null = null

    /** Invoked on every change. The `tc-change` event is the primary API. */
    onChange: ((from: number | null, to: number | null) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'heading',
            'from',
            'to',
            'bounds-min',
            'bounds-max',
            'from-label',
            'to-label',
            'note',
            'disabled',
            'class',
        ]
    }

    connectedCallback(): void {
        if (!this._built) {
            this.insertAdjacentHTML(
                'afterbegin',
                `<span class="tc-range-field__heading"></span>` +
                    `<span class="tc-range-field__presets" role="group"></span>` +
                    `<span class="tc-range-field__pair">` +
                    `<input class="tc-range-field__input tc-range-field__input--from" type="text" inputmode="numeric">` +
                    `<span class="tc-range-field__dash" aria-hidden="true">–</span>` +
                    `<input class="tc-range-field__input tc-range-field__input--to" type="text" inputmode="numeric">` +
                    `</span>` +
                    `<span class="tc-range-field__note"></span>`,
            )
            this._chips = this.querySelector(':scope > .tc-range-field__presets')
            this._built = true
        }
        this.addEventListener('click', this._onClick)
        this.addEventListener('input', this._onInput)
        this.patch()
        this._writeInputs()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('input', this._onInput)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._built) return
        if (name === 'from' || name === 'to') {
            // Written from outside — a preset, a cleared filter, a URL change. The
            // inputs are written directly and only when they differ, so a value that
            // arrives while someone is typing cannot move their caret.
            this._writeInputs()
            this._applyPresetState()
            return
        }
        this.patch()
    }

    /** One-tap spans above the pair. Only the dimensions everybody narrows by
     *  first (price, mileage) tend to carry them. */
    get presets(): RangeFieldPreset[] {
        return this._presets
    }
    set presets(v: RangeFieldPreset[]) {
        this._presets = Array.isArray(v) ? v : []
        if (this._built) this._renderPresets()
    }

    get heading(): string | null {
        return this.getAttribute('heading')
    }
    set heading(v: string | null) {
        if (v != null) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    get from(): number | null {
        const raw = this.getAttribute('from')
        return raw == null || raw === '' ? null : num(raw, 0)
    }
    set from(v: number | null) {
        if (v != null) this.setAttribute('from', String(v))
        else this.removeAttribute('from')
    }

    get to(): number | null {
        const raw = this.getAttribute('to')
        return raw == null || raw === '' ? null : num(raw, 0)
    }
    set to(v: number | null) {
        if (v != null) this.setAttribute('to', String(v))
        else this.removeAttribute('to')
    }

    /** The real floor of the filtered set — placeholder text, not a constraint. */
    get boundsMin(): number | null {
        const raw = this.getAttribute('bounds-min')
        return raw == null || raw === '' ? null : num(raw, 0)
    }
    set boundsMin(v: number | null) {
        if (v != null) this.setAttribute('bounds-min', String(v))
        else this.removeAttribute('bounds-min')
    }

    /** The real ceiling of the filtered set — placeholder text, not a constraint. */
    get boundsMax(): number | null {
        const raw = this.getAttribute('bounds-max')
        return raw == null || raw === '' ? null : num(raw, 0)
    }
    set boundsMax(v: number | null) {
        if (v != null) this.setAttribute('bounds-max', String(v))
        else this.removeAttribute('bounds-max')
    }

    get fromLabel(): string {
        return this.getAttribute('from-label') ?? 'From'
    }
    set fromLabel(v: string) {
        setAttr(this, 'from-label', v)
    }

    get toLabel(): string {
        return this.getAttribute('to-label') ?? 'To'
    }
    set toLabel(v: string) {
        setAttr(this, 'to-label', v)
    }

    get note(): string | null {
        return this.getAttribute('note')
    }
    set note(v: string | null) {
        if (v != null) this.setAttribute('note', v)
        else this.removeAttribute('note')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private _input(which: 'from' | 'to'): HTMLInputElement | null {
        return this.querySelector<HTMLInputElement>(`.tc-range-field__input--${which}`)
    }

    private patch(): void {
        setHostClass(this, 'tc-range-field')
        const heading = this.heading ?? ''
        const note = this.note ?? ''
        const disabled = this.disabled

        const headingNode = this.querySelector<HTMLElement>(':scope > .tc-range-field__heading')
        if (headingNode) {
            if (headingNode.textContent !== heading) headingNode.textContent = heading
            headingNode.hidden = heading === ''
        }
        const noteNode = this.querySelector<HTMLElement>(':scope > .tc-range-field__note')
        if (noteNode) {
            if (noteNode.textContent !== note) noteNode.textContent = note
            noteNode.hidden = note === ''
        }

        for (const which of ['from', 'to'] as const) {
            const input = this._input(which)
            if (!input) continue
            const bound = which === 'from' ? this.boundsMin : this.boundsMax
            const label = which === 'from' ? this.fromLabel : this.toLabel
            // The real bound as placeholder, so the reader types inside what exists.
            input.placeholder = bound != null ? String(bound) : label
            input.disabled = disabled
            input.setAttribute('aria-label', heading ? `${heading} — ${label}` : label)
        }

        this._renderPresets()
    }

    // Element-owned container: there is no consumer node inside it.
    private _renderPresets(): void {
        const chips = this._chips
        if (!chips) return
        const html = this._presets
            .map(
                (preset) =>
                    `<button type="button" class="tc-range-field__preset"` +
                    ` data-id="${esc(preset.id)}" aria-pressed="false">` +
                    `${esc(preset.label)}</button>`,
            )
            .join('')
        if (chips.innerHTML !== html) chips.innerHTML = html
        chips.hidden = this._presets.length === 0
        this._applyPresetState()
    }

    private _applyPresetState(): void {
        const from = this.from
        const to = this.to
        const disabled = this.disabled
        for (const button of Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-range-field__preset'),
        )) {
            const preset = this._presets.find((p) => p.id === button.dataset.id)
            // `(from ?? 0)` on both sides: a preset whose floor is zero and a field
            // with no floor set are the same span, and the two spellings must match.
            const picked = preset != null && (from ?? 0) === (preset.min ?? 0) && to === preset.max
            button.setAttribute('aria-pressed', String(picked))
            button.classList.toggle('tc-range-field__preset--active', picked)
            // The digit inputs go `disabled` from `patch()` — the preset chips are a
            // second, independent way to write the same value, so they must too.
            button.disabled = disabled
        }
    }

    /** Push the attribute values into the inputs, only where they differ. */
    private _writeInputs(): void {
        for (const which of ['from', 'to'] as const) {
            const input = this._input(which)
            if (!input) continue
            const value = which === 'from' ? this.from : this.to
            const next = value == null ? '' : String(value)
            if (input.value !== next) input.value = next
        }
    }

    private _emit(from: number | null, to: number | null): void {
        this.from = from
        this.to = to
        const detail: RangeFieldChangeDetail = { from, to }
        this.dispatchEvent(new CustomEvent('tc-change', { bubbles: true, composed: true, detail }))
        if (typeof this.onChange === 'function') this.onChange(from, to)
    }

    private _onInput = (event: Event): void => {
        const input = event.target
        if (!(input instanceof HTMLInputElement)) return
        if (!input.classList.contains('tc-range-field__input')) return
        const value = digits(input.value)
        const isFrom = input.classList.contains('tc-range-field__input--from')
        // The attribute is written, but `_writeInputs` compares before it writes, so
        // the field the reader is typing in is never touched.
        this._emit(isFrom ? value : this.from, isFrom ? this.to : value)
    }

    private _onClick = (event: MouseEvent): void => {
        if (this.disabled) return
        const origin = event.target as Element | null
        const button = origin?.closest<HTMLButtonElement>('.tc-range-field__preset')
        if (!button) return
        const preset = this._presets.find((p) => p.id === button.dataset.id)
        if (!preset) return
        const picked = button.getAttribute('aria-pressed') === 'true'
        // Re-tapping the active span clears the dimension, the same rule the facet
        // chips follow — one gesture, one meaning, across the whole filter sheet.
        if (picked) this._emit(null, null)
        else this._emit(preset.min, preset.max)
        this._writeInputs()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RangeField
    }
}

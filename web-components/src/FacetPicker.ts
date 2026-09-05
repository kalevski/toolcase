import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

// tc-facet-picker — one dimension of a narrowing pick, as a row of chips.
//
// From polovni.mk, whose own note explains the two decisions worth keeping:
//
// WHY THE CHIPS ARE A PROPERTY AND NOT CHILDREN. `tc-chip` moves its light-DOM
// children into its own content wrapper, so a React-rendered label is a node
// React thinks it owns inside a subtree the element rewrites — and it goes blank
// the first time `selected` flips. This element takes its options as a JS
// property and renders their labels itself, inside a container it owns, so React
// owns no node anywhere in the picker.
//
// WHY `rail` IS THE DEFAULT LAYOUT. A 320px screen fits three or four year chips
// per line, so a wrapping row of eight became three lines of chrome for ONE
// dimension. The rail keeps it to a single scrolling line. `wrap` is for the
// dimensions whose options are whole sentences, where a horizontal rail would
// scroll past the viewport per option.
//
// SINGLE SELECT, AND RE-TAPPING CLEARS. That is the behaviour a filter needs and
// a multi-select chip group cannot express: tapping the active chip removes the
// dimension rather than leaving it stuck, which is why there is no separate
// clear button — it would be a second control for something the chip already does.

const TAG_NAME = 'tc-facet-picker'

export interface FacetPickerOption {
    value: string
    label: string
    /** Rendered as a parenthesised suffix — the count of matches behind it. */
    count?: number
    disabled?: boolean
}

export type FacetPickerLayout = 'rail' | 'wrap'
const LAYOUTS: FacetPickerLayout[] = ['rail', 'wrap']

export type FacetPickerSize = 'sm' | 'md'
const SIZES: FacetPickerSize[] = ['sm', 'md']

export class FacetPicker extends HTMLElement {
    private _built = false
    private _options: FacetPickerOption[] = []
    private _list: HTMLElement | null = null

    /** Invoked on a pick, with `null` when the dimension was cleared. */
    onPick: ((value: string | null) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'hint', 'value', 'layout', 'size', 'label-hidden', 'class']
    }

    connectedCallback(): void {
        if (!this._built) {
            this.insertAdjacentHTML(
                'afterbegin',
                `<span class="tc-facet-picker__label"></span>` +
                    `<span class="tc-facet-picker__hint"></span>` +
                    `<span class="tc-facet-picker__options" role="group"></span>`,
            )
            this._list = this.querySelector(':scope > .tc-facet-picker__options')
            this._built = true
        }
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._built) return
        if (name === 'value') {
            // A pick is two class flips and an ARIA attribute — patched in place, so
            // the chip under the finger is never replaced mid-tap.
            this._applySelection()
            return
        }
        this.patch()
    }

    /** The dimension's options. A JS property: React cannot pass an array. */
    get options(): FacetPickerOption[] {
        return this._options
    }
    set options(v: FacetPickerOption[]) {
        this._options = Array.isArray(v) ? v : []
        if (this._built) this._renderOptions()
    }

    /** The picked value, or `''` for "this dimension is not set". */
    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    /** The dimension's name — "Year", "Body". */
    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    /** One line under the label, where the dimension needs explaining. */
    get hint(): string | null {
        return this.getAttribute('hint')
    }
    set hint(v: string | null) {
        if (v != null) this.setAttribute('hint', v)
        else this.removeAttribute('hint')
    }

    get layout(): FacetPickerLayout {
        const v = this.getAttribute('layout') as FacetPickerLayout
        return LAYOUTS.includes(v) ? v : 'rail'
    }
    set layout(v: FacetPickerLayout) {
        setAttr(this, 'layout', v)
    }

    get size(): FacetPickerSize {
        const v = this.getAttribute('size') as FacetPickerSize
        return SIZES.includes(v) ? v : 'sm'
    }
    set size(v: FacetPickerSize) {
        setAttr(this, 'size', v)
    }

    /** Drops the visible label and keeps it for screen readers only — for a facet
     *  whose own section heading already names it. */
    get labelHidden(): boolean {
        return this.hasAttribute('label-hidden')
    }
    set labelHidden(v: boolean) {
        if (v) this.setAttribute('label-hidden', '')
        else this.removeAttribute('label-hidden')
    }

    private patch(): void {
        setHostClass(
            this,
            `tc-facet-picker tc-facet-picker--${this.layout} tc-facet-picker--${this.size}`,
        )
        const label = this.label ?? ''
        const hint = this.hint ?? ''

        const labelNode = this.querySelector<HTMLElement>(':scope > .tc-facet-picker__label')
        if (labelNode) {
            if (labelNode.textContent !== label) labelNode.textContent = label
            labelNode.hidden = label === ''
            labelNode.classList.toggle('visually-hidden', this.labelHidden)
        }
        const hintNode = this.querySelector<HTMLElement>(':scope > .tc-facet-picker__hint')
        if (hintNode) {
            if (hintNode.textContent !== hint) hintNode.textContent = hint
            hintNode.hidden = hint === ''
        }
        if (this._list && label) this._list.setAttribute('aria-label', label)

        this._renderOptions()
    }

    // The option list is entirely element-owned — there is no consumer node
    // anywhere inside it, which is what makes rewriting it safe.
    private _renderOptions(): void {
        const list = this._list
        if (!list) return
        const html = this._options
            .map((option) => {
                const suffix = option.count != null ? ` (${esc(String(option.count))})` : ''
                return (
                    `<button type="button" class="tc-facet-picker__chip"` +
                    ` data-value="${esc(option.value)}" aria-pressed="false"` +
                    `${option.disabled ? ' disabled' : ''}>` +
                    `${esc(option.label)}${suffix}</button>`
                )
            })
            .join('')
        if (list.innerHTML !== html) list.innerHTML = html
        // An empty dimension is not a dimension: all three consuming apps returned
        // null rather than rendering an empty rail with a label over it.
        this.hidden = this._options.length === 0
        this._applySelection()
    }

    private _chips(): HTMLButtonElement[] {
        return Array.from(this.querySelectorAll<HTMLButtonElement>('.tc-facet-picker__chip'))
    }

    private _applySelection(): void {
        const value = this.value
        for (const chip of this._chips()) {
            const selected = chip.dataset.value === value
            chip.setAttribute('aria-pressed', String(selected))
            chip.classList.toggle('tc-facet-picker__chip--active', selected)
        }
    }

    private _pick(value: string): void {
        // Re-tapping the picked chip CLEARS the dimension. See the header note.
        const next = value === this.value ? null : value
        this.value = next ?? ''
        this.dispatchEvent(
            new CustomEvent('tc-pick', {
                bubbles: true,
                composed: true,
                detail: { value: next },
            }),
        )
        if (typeof this.onPick === 'function') this.onPick(next)
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        const chip = origin?.closest<HTMLButtonElement>('.tc-facet-picker__chip')
        if (!chip || chip.disabled) return
        this._pick(chip.dataset.value ?? '')
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        const origin = event.target as Element | null
        const chip = origin?.closest<HTMLButtonElement>('.tc-facet-picker__chip')
        if (!chip) return
        const enabled = this._chips().filter((c) => !c.disabled)
        if (enabled.length === 0) return
        let index = enabled.indexOf(chip)
        if (index === -1) index = 0

        let next = -1
        if (event.key === 'ArrowRight') next = Math.min(enabled.length - 1, index + 1)
        else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1)
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = enabled.length - 1
        if (next === -1) return
        event.preventDefault()
        // Focus only. These are toggle buttons, not radios: moving focus must not
        // change the filter, or arrowing across a rail would refetch per step.
        enabled[next].focus()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FacetPicker
    }
}

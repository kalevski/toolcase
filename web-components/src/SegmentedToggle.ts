import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

// tc-segmented-toggle — a binary (or short) global preference, as segments.
//
// polovni.mk wrote this twice — `CurrencyToggle` and `LocaleToggle`, 47 and 41
// lines, differing only in the option list. Its own note says why it is not a
// select: there are exactly two options, and a control whose whole option list
// fits on screen should not hide it behind a tap.
//
// THREE SEGMENTED-LOOKING ELEMENTS IN THIS LIBRARY, and they are not
// interchangeable:
//   tc-button-group  a row of ACTIONS that happen to be adjacent. No selection.
//   tc-tab-bar       a panel SWITCHER. Its selection shows a different panel, and
//                    it carries the tabs ARIA pattern (tablist / tab / tabpanel).
//   tc-segmented-toggle  this one. A radio GROUP whose options are all visible:
//                    the selection is a value, not a view. `role="radiogroup"`
//                    with `role="radio"` segments, which is what a screen reader
//                    needs to announce "2 of 2" — a tablist would announce a tab.
//
// The labels are short by construction (ISO codes, "€ / $", "km / mi"), so the
// spoken name of each segment rides on `title` and on the option's own
// `description`, which is what the originating app did for the currency codes.

const TAG_NAME = 'tc-segmented-toggle'

export interface SegmentedToggleOption {
    value: string
    /** The visible text. Short — this control shows every option at once. */
    label: string
    /** The spoken name, when the label is a code rather than a word. */
    description?: string
    disabled?: boolean
}

export type SegmentedToggleSize = 'sm' | 'md'
const SIZES: SegmentedToggleSize[] = ['sm', 'md']

export class SegmentedToggle extends HTMLElement {
    private _built = false
    private _options: SegmentedToggleOption[] = []
    private _list: HTMLElement | null = null

    /** Invoked on a pick. The `tc-change` event is the primary API. */
    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'label', 'size', 'disabled', 'class']
    }

    connectedCallback(): void {
        if (!this._built) {
            // insertAdjacentHTML, never innerHTML: the segments live in a container
            // this element owns, and anything the consumer put in the tag stays
            // exactly where they put it.
            this.insertAdjacentHTML('afterbegin', `<span class="tc-segmented-toggle__list"></span>`)
            this._list = this.querySelector(':scope > .tc-segmented-toggle__list')
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
            // The selection is a class and two ARIA attributes — patched in place so
            // a pick never rebuilds the segment the finger is still on.
            this._applySelection()
            return
        }
        this.patch()
    }

    /** The options. A JS property: React cannot pass an array as an attribute. */
    get options(): SegmentedToggleOption[] {
        return this._options
    }
    set options(v: SegmentedToggleOption[]) {
        this._options = Array.isArray(v) ? v : []
        if (this._built) this._renderSegments()
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    /** The group's accessible name — "Currency", "Units". */
    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get size(): SegmentedToggleSize {
        const v = this.getAttribute('size') as SegmentedToggleSize
        return SIZES.includes(v) ? v : 'md'
    }
    set size(v: SegmentedToggleSize) {
        setAttr(this, 'size', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private patch(): void {
        setHostClass(this, `tc-segmented-toggle tc-segmented-toggle--${this.size}`)
        if (!this.hasAttribute('role')) this.setAttribute('role', 'radiogroup')
        const label = this.label
        if (label) this.setAttribute('aria-label', label)
        this._renderSegments()
    }

    // The segment list is entirely element-owned, so rewriting it is safe: there
    // is no consumer node anywhere inside `.tc-segmented-toggle__list`.
    private _renderSegments(): void {
        const list = this._list
        if (!list) return
        const groupDisabled = this.disabled
        const html = this._options
            .map((option) => {
                const disabled = groupDisabled || option.disabled === true
                const title = option.description ? ` title="${esc(option.description)}"` : ''
                const aria = option.description ? ` aria-label="${esc(option.description)}"` : ''
                return (
                    `<button type="button" role="radio" class="tc-segmented-toggle__option"` +
                    ` data-value="${esc(option.value)}" aria-checked="false" tabindex="-1"` +
                    `${disabled ? ' disabled' : ''}${title}${aria}>` +
                    `${esc(option.label)}</button>`
                )
            })
            .join('')
        if (list.innerHTML !== html) list.innerHTML = html
        this._applySelection()
    }

    private _segments(): HTMLButtonElement[] {
        return Array.from(this.querySelectorAll<HTMLButtonElement>('.tc-segmented-toggle__option'))
    }

    private _applySelection(): void {
        const value = this.value
        const segments = this._segments()
        const enabled = segments.filter((s) => !s.disabled)
        // Roving tabindex: the group is ONE tab stop, and the arrows move inside it.
        const focusable =
            enabled.find((s) => s.dataset.value === value) ?? enabled[0] ?? segments[0] ?? null
        for (const segment of segments) {
            const selected = segment.dataset.value === value
            segment.setAttribute('aria-checked', String(selected))
            segment.classList.toggle('tc-segmented-toggle__option--active', selected)
            segment.tabIndex = segment === focusable ? 0 : -1
        }
    }

    private _select(value: string, focus: boolean): void {
        if (value === this.value) return
        this.value = value
        this.dispatchEvent(
            new CustomEvent('tc-change', { bubbles: true, composed: true, detail: { value } }),
        )
        if (typeof this.onChange === 'function') this.onChange(value)
        if (!focus) return
        const segment = this._segments().find((s) => s.dataset.value === value)
        segment?.focus()
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        const segment = origin?.closest<HTMLButtonElement>('.tc-segmented-toggle__option')
        if (!segment || segment.disabled) return
        this._select(segment.dataset.value ?? '', false)
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        const origin = event.target as Element | null
        const segment = origin?.closest<HTMLButtonElement>('.tc-segmented-toggle__option')
        if (!segment) return
        const enabled = this._segments().filter((s) => !s.disabled)
        if (enabled.length === 0) return
        let index = enabled.indexOf(segment)
        if (index === -1) index = 0

        let next = -1
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            next = (index + 1) % enabled.length
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            next = (index - 1 + enabled.length) % enabled.length
        } else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = enabled.length - 1
        if (next === -1) return

        event.preventDefault()
        // A radio group ACTIVATES as it moves — that is the ARIA pattern, and it is
        // free here because showing the selection costs nothing.
        this._select(enabled[next].dataset.value ?? '', true)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SegmentedToggle
    }
}

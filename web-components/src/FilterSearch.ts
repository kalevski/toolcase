import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'
import { setAttr } from './internal/tc-element'
import { msg, msgFormat } from './messages'

// tc-filter-search — a search field with a filter button on its leading edge,
// and the picked filters as removable chips underneath.
//
// From notegraph's search page, where one query plus a set of tag and label picks
// narrows one result list. It is not `tc-search-bar`, which has no filters, and
// not `tc-filter-bar`, which keeps every dimension on screen.
//
// THE BUTTON OPENS NOTHING ITSELF. It fires `tc-open`, and the app decides what a
// filter surface is: a `tc-bottom-sheet` on a phone-first app, a side panel on a
// dashboard, a modal somewhere else. A dropdown drawn by the element would be the
// one shape every app then has to fight. The app sets `open` while its surface is
// up, which is what drives `aria-expanded` and the button's active state.
//
// WHAT STAYS IN THE ELEMENT is what is the same everywhere: the count on the
// button, and the picked filters as chips. A filter the reader cannot see is a
// filter they forget they set, and then the results look wrong — so the chips stay
// under the field whatever the surface is, and each one removes its own pick.
//
// THE GROUPS ARE A PROPERTY, and every node inside the element is its own, so
// React owns nothing in here. An option is data, not a kind: a `prefix` of "#"
// reads as a tag, and a `color` draws a swatch and keeps that tone.
//
// THE FIELD IS UNCONTROLLED, with the same contract as `tc-search-bar`: `value`
// seeds it and is pushed in only when it differs, so the caret survives a
// re-render and a router can reseed it without a `key` remount.

const TAG_NAME = 'tc-filter-search'

export interface FilterSearchOption {
    value: string
    label: string
    /** Drawn before the label in a quieter ink — `#` for a tag. */
    prefix?: string
    /** Any CSS colour. Draws a swatch, and tints the chip in that tone. */
    color?: string
}

export interface FilterSearchGroup {
    key: string
    options: FilterSearchOption[]
    /** The picked option values. */
    selected?: string[]
}

export interface FilterSearchChangeDetail {
    key: string
    selected: string[]
    filters: Record<string, string[]>
}

const DEFAULT_FILTERS_ICON = 'sliders-horizontal'

const COLOR_SAFE = /^[#(),.%\w\s-]+$/

export class FilterSearch extends HTMLElement {
    private _built = false
    private _groups: FilterSearchGroup[] = []

    /** Invoked when the filter button is activated. The `tc-open` event is the primary API. */
    onOpen: (() => void) | null = null
    /** Invoked on submit with the field's value. The `tc-search` event is the primary API. */
    onSearch: ((value: string) => void) | null = null
    /** Invoked when a chip removes a pick. The `tc-change` event is the primary API. */
    onChange: ((detail: FilterSearchChangeDetail) => void) | null = null
    /** Invoked by `clearFilters()`. The `tc-clear` event is the primary API. */
    onClear: (() => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'value',
            'placeholder',
            'label',
            'filters-label',
            'filters-icon',
            'icon',
            'disabled',
            'open',
            'class',
        ]
    }

    connectedCallback(): void {
        if (!this._built) {
            this.insertAdjacentHTML(
                'afterbegin',
                `<div class="tc-filter-search__field">` +
                    `<button type="button" class="tc-filter-search__filters">` +
                    `<span class="tc-filter-search__glyph" aria-hidden="true"></span>` +
                    `<span class="tc-filter-search__count" hidden></span>` +
                    `</button>` +
                    `<input class="tc-filter-search__input" type="search" autocomplete="off" enterkeyhint="search">` +
                    `<button type="button" class="tc-filter-search__submit"></button>` +
                    `</div>` +
                    `<div class="tc-filter-search__active" hidden></div>`,
            )
            this._built = true
        }
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        this.addEventListener('input', this._onInput)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('input', this._onInput)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._built) return
        if (name === 'value') {
            const input = this._input()
            const next = this.getAttribute('value') ?? ''
            if (input && input.value !== next) input.value = next
            return
        }
        this.patch()
    }

    /** The filter dimensions and their picks. A JS property: React cannot pass an array. */
    get groups(): FilterSearchGroup[] {
        return this._groups
    }
    set groups(v: FilterSearchGroup[]) {
        this._groups = Array.isArray(v)
            ? v.map((group) => ({ ...group, selected: [...(group.selected ?? [])] }))
            : []
        if (this._built) this._render()
    }

    /** Every group's picks, keyed by group. */
    get filters(): Record<string, string[]> {
        return Object.fromEntries(
            this._groups.map((group) => [group.key, [...(group.selected ?? [])]]),
        )
    }

    /** How many options are picked across every group. */
    get activeCount(): number {
        return this._groups.reduce((sum, group) => sum + (group.selected?.length ?? 0), 0)
    }

    /** Seeds the field. Reading it returns what is in the field NOW. */
    get value(): string {
        return this._input()?.value ?? this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        setAttr(this, 'value', v)
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? msg('searchPlaceholder')
    }
    set placeholder(v: string) {
        setAttr(this, 'placeholder', v)
    }

    /** The field's accessible name. */
    get label(): string {
        return this.getAttribute('label') ?? msg('searchPlaceholder')
    }
    set label(v: string) {
        setAttr(this, 'label', v)
    }

    /** The filter button's accessible name and tooltip. */
    get filtersLabel(): string {
        return this.getAttribute('filters-label') ?? msg('filtersLabel')
    }
    set filtersLabel(v: string) {
        setAttr(this, 'filters-label', v)
    }

    /** The filter button's lucide icon — any name; `sliders-horizontal` by default. */
    get filtersIcon(): string {
        return this.getAttribute('filters-icon') ?? DEFAULT_FILTERS_ICON
    }
    set filtersIcon(v: string) {
        setAttr(this, 'filters-icon', v)
    }

    get icon(): string {
        return this.getAttribute('icon') ?? 'Search'
    }
    set icon(v: string) {
        setAttr(this, 'icon', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    /** Set by the app while its filter surface is showing. Drives `aria-expanded`. */
    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    /** Move focus into the field. */
    focusInput(): void {
        this._input()?.focus()
    }

    /** Move focus to the filter button — where focus belongs when the app's surface closes. */
    focusFilters(): void {
        this._part<HTMLButtonElement>('filters')?.focus()
    }

    /** Submit whatever the field currently holds. */
    submit(): void {
        const value = this.value
        this.dispatchEvent(
            new CustomEvent('tc-search', { bubbles: true, composed: true, detail: { value } }),
        )
        if (typeof this.onSearch === 'function') this.onSearch(value)
    }

    /** Drop every pick in every group. */
    clearFilters(): void {
        if (this.activeCount === 0) return
        for (const group of this._groups) group.selected = []
        this._render()
        this.dispatchEvent(new CustomEvent('tc-clear', { bubbles: true, composed: true }))
        if (typeof this.onClear === 'function') this.onClear()
    }

    private _input(): HTMLInputElement | null {
        return this.querySelector<HTMLInputElement>('.tc-filter-search__input')
    }

    private _part<T extends HTMLElement>(name: string): T | null {
        return this.querySelector<T>(`.tc-filter-search__${name}`)
    }

    private patch(): void {
        setHostClass(this, `tc-filter-search${this.open ? ' tc-filter-search--open' : ''}`)
        const disabled = this.disabled

        const input = this._input()
        if (input) {
            input.placeholder = this.placeholder
            input.disabled = disabled
            input.setAttribute('aria-label', this.label)
            if (!input.dataset.seeded) {
                input.value = this.getAttribute('value') ?? ''
                input.dataset.seeded = 'true'
            }
        }

        const submit = this._part<HTMLButtonElement>('submit')
        if (submit) {
            if (submit.dataset.icon !== this.icon) {
                submit.innerHTML = lucideByName(this.icon)
                submit.dataset.icon = this.icon
            }
            submit.disabled = disabled
            submit.setAttribute('aria-label', this.label)
        }

        const glyph = this._part<HTMLElement>('glyph')
        if (glyph && glyph.dataset.icon !== this.filtersIcon) {
            // An unknown name falls back to the default rather than leaving the
            // button blank — an empty button still takes the tap and says nothing.
            glyph.innerHTML = lucideByName(this.filtersIcon) || lucideByName(DEFAULT_FILTERS_ICON)
            glyph.dataset.icon = this.filtersIcon
        }

        const trigger = this._part<HTMLButtonElement>('filters')
        if (trigger) {
            trigger.disabled = disabled
            trigger.setAttribute('aria-label', this.filtersLabel)
            trigger.setAttribute('aria-haspopup', 'dialog')
            trigger.setAttribute('aria-expanded', String(this.open))
            trigger.title = this.filtersLabel
        }

        this._render()
    }

    private _chip(group: FilterSearchGroup, option: FilterSearchOption): string {
        const color = option.color && COLOR_SAFE.test(option.color) ? option.color : ''
        const classes = color
            ? 'tc-filter-search__chip tc-filter-search__chip--colored'
            : 'tc-filter-search__chip'
        const style = color ? ` style="--bs-filter-search-chip-tone: ${esc(color)}"` : ''
        return (
            `<button type="button" class="${classes}" data-group="${esc(group.key)}"` +
            ` data-value="${esc(option.value)}"` +
            ` aria-label="${esc(msgFormat('filterRemove', { label: `${option.prefix ?? ''}${option.label}` }))}"${style}>` +
            (color ? `<span class="tc-filter-search__swatch" aria-hidden="true"></span>` : '') +
            (option.prefix
                ? `<span class="tc-filter-search__prefix" aria-hidden="true">${esc(option.prefix)}</span>`
                : '') +
            `<span class="tc-filter-search__chip-label">${esc(option.label)}</span>` +
            lucideByName('x', 'tc-filter-search__remove') +
            `</button>`
        )
    }

    private _render(): void {
        const active = this._part<HTMLElement>('active')
        if (active) {
            const html = this._groups
                .flatMap((group) =>
                    (group.selected ?? [])
                        .map((value) => group.options.find((option) => option.value === value))
                        .filter((option): option is FilterSearchOption => option !== undefined)
                        .map((option) => this._chip(group, option)),
                )
                .join('')
            if (active.innerHTML !== html) active.innerHTML = html
            active.hidden = html === ''
        }

        const count = this.activeCount
        const badge = this._part<HTMLElement>('count')
        if (badge) {
            badge.textContent = count > 0 ? String(count) : ''
            badge.hidden = count === 0
        }
        this._part<HTMLElement>('filters')?.classList.toggle(
            'tc-filter-search__filters--picked',
            count > 0,
        )
    }

    private _remove(key: string, value: string): void {
        const group = this._groups.find((entry) => entry.key === key)
        if (!group) return
        group.selected = (group.selected ?? []).filter((entry) => entry !== value)
        this._render()
        const detail: FilterSearchChangeDetail = {
            key,
            selected: [...group.selected],
            filters: this.filters,
        }
        this.dispatchEvent(new CustomEvent('tc-change', { bubbles: true, composed: true, detail }))
        if (typeof this.onChange === 'function') this.onChange(detail)
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        if (!origin || this.disabled) return

        const chip = origin.closest<HTMLButtonElement>('.tc-filter-search__chip')
        if (chip) {
            this._remove(chip.dataset.group ?? '', chip.dataset.value ?? '')
            this.focusInput()
            return
        }
        if (origin.closest('.tc-filter-search__filters')) {
            this.dispatchEvent(new CustomEvent('tc-open', { bubbles: true, composed: true }))
            if (typeof this.onOpen === 'function') this.onOpen()
            return
        }
        if (origin.closest('.tc-filter-search__submit')) this.submit()
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Enter') return
        const origin = event.target as Element | null
        if (!origin?.classList.contains('tc-filter-search__input')) return
        event.preventDefault()
        this.submit()
    }

    private _onInput = (event: Event): void => {
        const origin = event.target as Element | null
        if (!origin?.classList.contains('tc-filter-search__input')) return
        this.dispatchEvent(
            new CustomEvent('tc-input', {
                bubbles: true,
                composed: true,
                detail: { value: this.value },
            }),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FilterSearch
    }
}

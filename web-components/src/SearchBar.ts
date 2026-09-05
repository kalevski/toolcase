import { setHostClass } from './internal/host-class'
import { setAttr, syncOwnedNodes } from './internal/tc-element'
import { lucideByName } from './internal/lucide'
import { msg } from './messages'

// tc-search-bar — a leading slot, one field, and the button that submits it.
//
// From polovni.mk, where four browse pages had this markup character for
// character and differed only in the id and the strings. Two more added combobox
// semantics on top and kept their own, which is the right line: this element is
// the plain submit-on-Enter field, not a suggest box (that is `tc-combo-box`).
//
// `enterkeyhint="search"` and `type="search"` live here rather than at six call
// sites, which is the point of extracting it: the phone keyboard's submit key is
// a decision about the app, not about parts.
//
// THE FIELD IS UNCONTROLLED, and deliberately. `value` seeds it; typing is never
// rewritten mid-keystroke, and a `value` written from outside (a URL change, a
// cleared filter) is pushed into the input only when it actually differs — which
// is the same controlled-input contract `tc-form-input` follows, and the reason
// this element does not need a `key` remount to stay in step with a router.
//
// `[slot="leading"]` is a REGION you fill: the place picker's map mark in the
// originating app. It stays your node, ordered first by CSS.

const TAG_NAME = 'tc-search-bar'

export class SearchBar extends HTMLElement {
    private _built = false

    /** Invoked on submit with the field's current value. The `tc-search` event is
     *  the primary API. */
    onSearch: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'placeholder', 'label', 'name', 'disabled', 'icon', 'class']
    }

    connectedCallback(): void {
        this._built = true
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
            // The controlled-input contract: writing `value` never rebuilds the
            // field, and only touches the control when the value actually differs,
            // so the caret survives.
            //
            // Compared against the ATTRIBUTE, not `this.value` — that getter reads
            // the input, so comparing with it made the condition unsatisfiable and
            // the push a no-op: `<tc-search-bar value={query}>` seeded once at
            // mount and then ignored every value React declared after it.
            const input = this._input()
            const next = this.getAttribute('value') ?? ''
            if (input && input.value !== next) input.value = next
            return
        }
        this.patch()
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

    /** The field's accessible name. Visible only to a screen reader — the
     *  placeholder is the visible prompt, which is what the six call sites did. */
    get label(): string {
        return this.getAttribute('label') ?? msg('searchPlaceholder')
    }
    set label(v: string) {
        setAttr(this, 'label', v)
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get icon(): string {
        return this.getAttribute('icon') ?? 'Search'
    }
    set icon(v: string) {
        setAttr(this, 'icon', v)
    }

    /** Move focus into the field. */
    focusInput(): void {
        this._input()?.focus()
    }

    /** Submit whatever the field currently holds. */
    submit(): void {
        const value = this.value
        this.dispatchEvent(
            new CustomEvent('tc-search', { bubbles: true, composed: true, detail: { value } }),
        )
        if (typeof this.onSearch === 'function') this.onSearch(value)
    }

    private _input(): HTMLInputElement | null {
        return this.querySelector<HTMLInputElement>(':scope > .tc-search-bar__input')
    }

    private patch(): void {
        setHostClass(this, 'tc-search-bar')
        const disabled = this.disabled

        syncOwnedNodes(this, [
            {
                cls: 'tc-search-bar__input',
                tag: 'input',
                // An `<input>` is a void element: its content is never markup, so
                // there is nothing for syncOwnedNodes to write and the empty string
                // is what says "this node exists".
                html: '',
            },
            {
                cls: 'tc-search-bar__submit',
                tag: 'button',
                html: lucideByName(this.icon),
            },
        ])

        const input = this._input()
        if (input) {
            input.type = 'search'
            input.autocomplete = 'off'
            input.enterKeyHint = 'search'
            input.placeholder = this.placeholder
            input.disabled = disabled
            input.setAttribute('aria-label', this.label)
            const name = this.name
            if (name != null) input.name = name
            else input.removeAttribute('name')
            const seed = this.getAttribute('value') ?? ''
            // Seeded once, and thereafter only when the attribute genuinely differs
            // from what is on screen — see the note about the contract above.
            if (!input.dataset.seeded) {
                input.value = seed
                input.dataset.seeded = 'true'
            }
        }

        const submit = this.querySelector<HTMLButtonElement>(':scope > .tc-search-bar__submit')
        if (submit) {
            submit.type = 'button'
            submit.disabled = disabled
            submit.setAttribute('aria-label', this.label)
        }
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        if (!origin?.closest('.tc-search-bar__submit')) return
        this.submit()
    }

    private _onKeydown = (event: KeyboardEvent): void => {
        if (event.key !== 'Enter') return
        if (!(event.target instanceof HTMLInputElement)) return
        if (!event.target.classList.contains('tc-search-bar__input')) return
        // A bare `<input type=search>` outside a form does nothing on Enter, which
        // is the one key a search field has to answer.
        event.preventDefault()
        this.submit()
    }

    private _onInput = (event: Event): void => {
        // Scoped to the field: `[slot="leading"]` is a region the consumer fills,
        // and a control they put there must not report as a search keystroke.
        const origin = event.target as Element | null
        if (!origin?.classList.contains('tc-search-bar__input')) return
        const value = this.value
        this.dispatchEvent(
            new CustomEvent('tc-input', { bubbles: true, composed: true, detail: { value } }),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SearchBar
    }
}

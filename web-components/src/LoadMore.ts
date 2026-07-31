import { esc } from './internal/esc'
import { msg } from './messages'

// tc-load-more — the phone's answer to a numbered pager: one full-width control at
// the end of a list that APPENDS the next page in place.
//
// WHY THIS AND NOT tc-pagination
//   A pager replaces the list, which on a phone means losing your scroll position
//   every time you advance — you are returned to the top of a screen you have not
//   read. It also asks a question ("which page?") that has no answer when the whole
//   list is one column of cards. Appending keeps the reader exactly where they were
//   and makes the only decision "more, or done".
//
// WHY A BUTTON AND NOT AN INTERSECTION OBSERVER
//   Infinite scroll on its own takes the end of the list away: the footer becomes
//   unreachable, "how much is left" becomes unanswerable, and a screen reader gets
//   content appended under it with no warning. This element is the explicit control;
//   an app that wants automatic loading can still observe it and call `load()` — the
//   difference is that the affordance, the busy state and the terminal state all
//   exist and are announced either way.
//
// THREE STATES, AND THE THIRD IS THE POINT
//   `idle`      — a tappable ghost button.
//   `loading`   — a spinner and a disabled control; taps cannot stack requests.
//   `exhausted` — NOT a hidden element. A list that simply stops has not told anyone
//                 it finished, so the reader keeps flicking at the bottom to check.
//                 This renders as quiet static text: an ending, stated once.

const TAG_NAME = 'tc-load-more'

export type LoadMoreState = 'idle' | 'loading' | 'exhausted'

const STATES: LoadMoreState[] = ['idle', 'loading', 'exhausted']

export class LoadMore extends HTMLElement {
    private _initialised = false

    /** Called on activation, alongside the `tc-load-more` event. */
    onLoad: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['state', 'label', 'loading-label', 'exhausted-label', 'count', 'disabled']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.addEventListener('click', this._onClick)
            this._initialised = true
        }
        this.render()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get state(): LoadMoreState {
        const v = this.getAttribute('state') as LoadMoreState
        return STATES.includes(v) ? v : 'idle'
    }
    set state(v: LoadMoreState) {
        this.setAttribute('state', v)
    }

    /** Idle label. Defaults to the registry's `loadMore`. */
    get label(): string {
        return this.getAttribute('label') ?? msg('loadMore')
    }
    set label(v: string) {
        if (v) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    /** Busy label. Defaults to the registry's `loading`. */
    get loadingLabel(): string {
        return this.getAttribute('loading-label') ?? msg('loading')
    }
    set loadingLabel(v: string) {
        if (v) this.setAttribute('loading-label', v)
        else this.removeAttribute('loading-label')
    }

    /** Terminal label. Defaults to the registry's `allLoaded`. */
    get exhaustedLabel(): string {
        return this.getAttribute('exhausted-label') ?? msg('allLoaded')
    }
    set exhaustedLabel(v: string) {
        if (v) this.setAttribute('exhausted-label', v)
        else this.removeAttribute('exhausted-label')
    }

    /**
     * How many more items the next tap brings, shown as a hint beside the label. Not
     * a total and not a page number: "+20" answers "is this worth a tap" without
     * reintroducing the pager's arithmetic.
     */
    get count(): string {
        return this.getAttribute('count') ?? ''
    }
    set count(v: string) {
        if (v) this.setAttribute('count', v)
        else this.removeAttribute('count')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    /** Fire the load request. A no-op while loading, exhausted or disabled. */
    load(): void {
        if (this.state !== 'idle' || this.disabled) return
        this.dispatchEvent(new CustomEvent('tc-load-more', { bubbles: true, composed: true }))
        if (typeof this.onLoad === 'function') this.onLoad()
    }

    // Delegated on the host rather than bound to the rendered <button>, so a
    // re-render never leaves a listener on a detached node.
    private _onClick = (e: Event): void => {
        const target = e.target as HTMLElement | null
        if (!target?.closest('.tc-load-more__btn')) return
        this.load()
    }

    private render(): void {
        const state = this.state

        if (state === 'exhausted') {
            // `role="status"` and not a live region: by the time this renders the
            // reader has already been handed the appended items, and announcing the
            // ending as an interruption on top of that is noise. It is read when
            // reached.
            this.innerHTML = `<p class="tc-load-more__done" role="status">${esc(this.exhaustedLabel)}</p>`
            return
        }

        const loading = state === 'loading'
        const disabled = loading || this.disabled
        const label = loading ? this.loadingLabel : this.label
        const count = !loading && this.count ? this.count : ''

        const spinner = loading
            ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`
            : ''
        const countHtml = count ? `<span class="tc-load-more__count">${esc(count)}</span>` : ''

        // `aria-busy` on the button rather than a swapped-in live region: the label
        // itself changes to „Loading…", so AT already has the words; aria-busy is what
        // tells it the control is mid-operation and its own state is not final.
        this.innerHTML =
            `<button type="button" class="btn tc-load-more__btn"` +
            `${disabled ? ' disabled' : ''}${loading ? ' aria-busy="true"' : ''}>` +
            `${spinner}<span class="tc-load-more__label">${esc(label)}</span>${countHtml}` +
            `</button>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LoadMore
    }
}

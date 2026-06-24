// Shared scaffold for light-DOM elements that wrap their slotted children in a
// rendered shell: capture child nodes on first connect, render the shell, then
// re-append the captured nodes into an inner content element — repeating that
// capture→render→re-append dance on attribute changes. Used by tc-text and
// tc-heading (and anything else that is "a styled tag around its children").
// `afterRender()` is an optional hook for post-render work (e.g. truncate title).

export abstract class SlotWrapBase extends HTMLElement {
    protected _initialised = false

    /** Render the shell markup (with an empty inner content element). */
    protected abstract render(): void
    /** The inner element slotted content is appended into. */
    protected abstract getContentEl(): Element | null
    /** Optional post-render hook (runs after content is re-appended). */
    protected afterRender(): void {}

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.getContentEl()
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this.afterRender()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.getContentEl()
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.getContentEl()
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
        this.afterRender()
    }
}

// Shared scaffold for light-DOM elements that are a styled box around their own
// children.
//
// Until 5.1 it captured the host's child nodes, rendered a shell and re-appended
// them inside it — repeating that dance on every attribute change. That is
// precisely the move rule 1 forbids: react-dom recorded the HOST as the parent of
// those children, so its next `removeChild` threw NotFoundError and the route went
// blank. The shell now goes ON the host, and subclasses only describe it.

export abstract class SlotWrapBase extends HTMLElement {
    protected _initialised = false

    /** Apply the element's own classes/attributes to the host. Must not wrap,
     *  move or overwrite consumer children. */
    protected abstract render(): void
    /** Optional post-render hook. */
    protected afterRender(): void {}

    connectedCallback(): void {
        this._initialised = true
        this.render()
        this.afterRender()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
        this.afterRender()
    }
}

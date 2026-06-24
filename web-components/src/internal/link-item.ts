// Shared scaffold for light-DOM, slot-wrapping link rows (tc-breadcrumb-item,
// tc-dropdown-item). Both capture their child nodes on first connect, render an
// `<a>` / `<span>` / `<button>` shell, then re-append the captured nodes into an
// inner content element — and repeat that capture→render→re-append dance on
// attribute changes. They also share the `href` / `active` accessors. The shell
// markup (Bootstrap class prefix, `<li>` wrapper, divider/disabled branches) is
// the only real difference and stays in each subclass's render().

export abstract class LinkItemBase extends HTMLElement {
    protected _initialised = false

    /** Render the shell markup (without the slotted content, which is re-appended). */
    protected abstract render(): void
    /** The inner element slotted content lives in. Return null when there is none (e.g. a divider). */
    protected abstract getContentEl(): HTMLElement | null

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.getContentEl()
            if (inner) slotContent.forEach(n => inner.appendChild(n))
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
    }

    get href(): string | null {
        return this.getAttribute('href')
    }
    set href(v: string | null) {
        if (v != null) this.setAttribute('href', v)
        else this.removeAttribute('href')
    }

    get active(): boolean {
        return this.hasAttribute('active')
    }
    set active(v: boolean) {
        if (v) this.setAttribute('active', '')
        else this.removeAttribute('active')
    }
}

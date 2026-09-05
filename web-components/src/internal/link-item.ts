// Shared scaffold for light-DOM link rows (tc-breadcrumb-item, tc-dropdown-item).
//
// Until 5.1 both captured their child nodes on first connect, rendered an `<a>` /
// `<span>` / `<button>` shell and re-appended the captured nodes inside it — which
// re-parents children react-dom believes belong to the host and makes its next
// `removeChild` throw NotFoundError. The shell is now rendered BESIDE the
// consumer's children as a stretched hit area (see each subclass's render), so
// this base only owns the lifecycle and the shared `href` / `active` accessors.
import { observeContent } from './content-observer'

export abstract class LinkItemBase extends HTMLElement {
    protected _initialised = false

    /** Render the element's own markup. Must not wrap or move consumer children. */
    protected abstract render(): void

    connectedCallback(): void {
        this._initialised = true
        this.render()
        // Every subclass renders a hit area whose accessible name is copied from
        // the consumer's own text, so the copy has to follow it when React
        // rewrites the children — see content-observer.ts.
        observeContent(this, () => this.render())
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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

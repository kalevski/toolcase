import { esc } from './esc'
// Shared scaffold for tc-modal and tc-offcanvas. Both wrap a Bootstrap overlay
// plugin around the host element: capture their light-DOM children once, render
// the BS markup, init the plugin, and bridge the plugin's show/shown/hide/hidden
// events to tc-* CustomEvents while keeping the `open` attribute in sync (guarded
// by `_syncing` so the attribute write doesn't recurse). They diverge only in the
// plugin class + options, the event namespace, how slotted nodes are captured,
// and the rendered markup — all supplied by the subclass.

export interface OverlayPlugin {
    show(): void
    hide(): void
    toggle(): void
    dispose(): void
}

export function escapeHtml(s: string): string {
    return esc(s)
}

export abstract class BsOverlay extends HTMLElement {
    protected _plugin: OverlayPlugin | null = null
    protected _initialised = false
    protected _syncing = false

    /** Bootstrap event namespace (`modal` / `offcanvas`). */
    protected abstract get eventNs(): string
    /** Render the overlay's OWN markup. It must not wrap or move consumer
     *  children — the body of an overlay is whatever the consumer wrote, left
     *  where they wrote it and placed by CSS (rule 1). */
    protected abstract render(): void
    /** Instantiate the underlying Bootstrap plugin bound to this element. */
    protected abstract createPlugin(): OverlayPlugin

    static get observedAttributes(): string[] {
        return ['open']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
        this._initPlugin()
        if (this.open) this._plugin?.show()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised || this._syncing) return
        if (name === 'open') {
            if (this.open) this._plugin?.show()
            else this._plugin?.hide()
        } else {
            // Structural attribute changed — rebuild the plugin against fresh markup.
            this._teardown()
            this.render()
            this._initPlugin()
        }
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    show(): void {
        this._plugin?.show()
    }

    hide(): void {
        this._plugin?.hide()
    }

    toggle(): void {
        this._plugin?.toggle()
    }

    private _onShow = (): void => {
        this._syncing = true
        this.setAttribute('open', '')
        this._syncing = false
        this.dispatchEvent(new CustomEvent('tc-show', { bubbles: true, composed: true }))
    }

    private _onShown = (): void => {
        this.dispatchEvent(new CustomEvent('tc-shown', { bubbles: true, composed: true }))
    }

    private _onHide = (): void => {
        this._syncing = true
        this.removeAttribute('open')
        this._syncing = false
        this.dispatchEvent(new CustomEvent('tc-hide', { bubbles: true, composed: true }))
    }

    private _onHidden = (): void => {
        this.dispatchEvent(new CustomEvent('tc-hidden', { bubbles: true, composed: true }))
    }

    private _initPlugin(): void {
        this._plugin = this.createPlugin()
        const ns = this.eventNs
        this.addEventListener(`show.bs.${ns}`, this._onShow)
        this.addEventListener(`shown.bs.${ns}`, this._onShown)
        this.addEventListener(`hide.bs.${ns}`, this._onHide)
        this.addEventListener(`hidden.bs.${ns}`, this._onHidden)
    }

    private _teardown(): void {
        const ns = this.eventNs
        this.removeEventListener(`show.bs.${ns}`, this._onShow)
        this.removeEventListener(`shown.bs.${ns}`, this._onShown)
        this.removeEventListener(`hide.bs.${ns}`, this._onHide)
        this.removeEventListener(`hidden.bs.${ns}`, this._onHidden)
        if (this._plugin) {
            this._plugin.dispose()
            this._plugin = null
        }
    }
}

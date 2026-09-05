import { setAttr } from './tc-element'
// Shared scaffold for tc-tooltip and tc-popover. Both are thin wrappers over a
// Bootstrap overlay plugin (internal/Tooltip, internal/Popover) bound to the
// element's first child: same observed attributes, accessors, show/hide/toggle,
// the four tc-show/shown/hide/hidden re-dispatchers, and init/teardown. The only
// real differences are the plugin class, the default `trigger`, the Bootstrap
// event namespace, and how title/content map onto the plugin options — all
// supplied by the subclass.

export interface OverlayPlugin {
    show(): void
    hide(): void
    toggle(): void
    dispose(): void
}

export interface OverlayOptions {
    title: string
    content: string
    placement: string
    trigger: string
    html: boolean
}

const VALID_PLACEMENTS = ['top', 'right', 'bottom', 'left', 'auto']

export abstract class OverlayTrigger extends HTMLElement {
    private _plugin: OverlayPlugin | null = null
    private _triggerEl: HTMLElement | null = null
    private _initialised = false

    /** Default `trigger` when the attribute is absent (`hover focus` / `click`). */
    protected abstract get defaultTrigger(): string
    /** Bootstrap event namespace (`tooltip` / `popover`). */
    protected abstract get eventNs(): string
    /** Instantiate the underlying Bootstrap plugin from the resolved options. */
    protected abstract createPlugin(triggerEl: HTMLElement, options: OverlayOptions): OverlayPlugin

    static get observedAttributes(): string[] {
        return ['title', 'content', 'placement', 'trigger', 'html']
    }

    connectedCallback(): void {
        if (!this._initialised) this._initialised = true
        this._initPlugin()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._teardown()
        this._initPlugin()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        setAttr(this, 'title', v)
    }

    get content(): string {
        return this.getAttribute('content') ?? ''
    }
    set content(v: string) {
        setAttr(this, 'content', v)
    }

    get placement(): string {
        return this.getAttribute('placement') ?? 'auto'
    }
    set placement(v: string) {
        setAttr(this, 'placement', v)
    }

    get trigger(): string {
        return this.getAttribute('trigger') ?? this.defaultTrigger
    }
    set trigger(v: string) {
        setAttr(this, 'trigger', v)
    }

    get html(): boolean {
        return this.hasAttribute('html')
    }
    set html(v: boolean) {
        if (v) this.setAttribute('html', '')
        else this.removeAttribute('html')
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
        this.dispatchEvent(new CustomEvent('tc-show', { bubbles: true, composed: true }))
    }
    private _onShown = (): void => {
        this.dispatchEvent(new CustomEvent('tc-shown', { bubbles: true, composed: true }))
    }
    private _onHide = (): void => {
        this.dispatchEvent(new CustomEvent('tc-hide', { bubbles: true, composed: true }))
    }
    private _onHidden = (): void => {
        this.dispatchEvent(new CustomEvent('tc-hidden', { bubbles: true, composed: true }))
    }

    private _initPlugin(): void {
        const triggerEl = this.firstElementChild as HTMLElement | null
        if (!triggerEl) return
        this._triggerEl = triggerEl

        const rawPlacement = this.getAttribute('placement') ?? 'auto'
        const placement = VALID_PLACEMENTS.includes(rawPlacement) ? rawPlacement : 'auto'

        this._plugin = this.createPlugin(triggerEl, {
            title: this.getAttribute('title') ?? '',
            content: this.getAttribute('content') ?? '',
            placement,
            trigger: this.getAttribute('trigger') ?? this.defaultTrigger,
            html: this.hasAttribute('html'),
        })

        const ns = this.eventNs
        triggerEl.addEventListener(`show.bs.${ns}`, this._onShow)
        triggerEl.addEventListener(`shown.bs.${ns}`, this._onShown)
        triggerEl.addEventListener(`hide.bs.${ns}`, this._onHide)
        triggerEl.addEventListener(`hidden.bs.${ns}`, this._onHidden)
    }

    private _teardown(): void {
        const triggerEl = this._triggerEl
        if (triggerEl) {
            const ns = this.eventNs
            triggerEl.removeEventListener(`show.bs.${ns}`, this._onShow)
            triggerEl.removeEventListener(`shown.bs.${ns}`, this._onShown)
            triggerEl.removeEventListener(`hide.bs.${ns}`, this._onHide)
            triggerEl.removeEventListener(`hidden.bs.${ns}`, this._onHidden)
        }
        if (this._plugin) {
            this._plugin.dispose()
            this._plugin = null
        }
        this._triggerEl = null
    }
}

import { bindOnce, patchHtml } from './internal/patch-html'
import { adoptChildren } from './internal/adopt-children'
import { Collapse } from './internal/Collapse'
import { setAttr } from './internal/tc-element'
import { esc } from './internal/esc'
import { chevronDownIcon } from './icons'

const TAG_NAME = 'tc-accordion-item'

let itemCounter = 0

export class AccordionItem extends HTMLElement {
    private _collapseId: string
    private _collapseEl: Element | null = null
    private _collapse: Collapse | null = null
    private _initialised = false
    private _syncing = false

    static get observedAttributes(): string[] {
        return ['header', 'open']
    }

    constructor() {
        super()
        this._collapseId = `tc-collapse-${++itemCounter}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            this._adopt(slotContent)
            this._initialised = true
        }
        this._collapseEl = this.querySelector('.accordion-collapse')
        this._attachListeners()
    }

    disconnectedCallback(): void {
        this._detachListeners()
        this._collapseEl = null
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised || this._syncing) return
        if (name === 'header') {
            const text = this.querySelector<HTMLElement>('.accordion-button-text')
            if (text) text.textContent = this.getAttribute('header') ?? ''
        } else if (name === 'open') {
            this._updateOpenState()
        }
    }

    get header(): string {
        return this.getAttribute('header') ?? ''
    }
    set header(v: string) {
        setAttr(this, 'header', v)
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    private _parentAccordionId(): string | null {
        const parent = this.closest('tc-accordion')
        if (!parent) return null
        const alwaysOpen = parent.hasAttribute('always-open')
        if (alwaysOpen) return null
        return parent.id || null
    }

    /** The consumer's children are the panel body — see adopt-children.ts. */
    private _adopt(nodes?: Node[]): void {
        const body = this.querySelector('.accordion-body')
        if (body) adoptChildren(this, () => body, nodes)
    }

    private render(): void {
        const collapseId = this._collapseId
        const headerText = this.getAttribute('header') ?? ''
        const isOpen = this.hasAttribute('open')
        const parentId = this._parentAccordionId()
        const parentAttr = parentId ? ` data-bs-parent="#${parentId}"` : ''

        this.classList.add('accordion-item')
        patchHtml(
            this,
            `
<h2 class="accordion-header">
    <button class="accordion-button${isOpen ? '' : ' collapsed'}" type="button"
            data-bs-toggle="collapse"
            data-bs-target="#${collapseId}"
            aria-expanded="${isOpen ? 'true' : 'false'}"
            aria-controls="${collapseId}">
        <span class="accordion-button-text">${esc(headerText)}</span>
        <span class="accordion-button-icon">${chevronDownIcon}</span>
    </button>
</h2>
<div id="${collapseId}" class="accordion-collapse collapse${isOpen ? ' show' : ''}"${parentAttr}>
    <div class="accordion-body"></div>
</div>`.trim(),
        )
    }

    private _updateOpenState(): void {
        const isOpen = this.hasAttribute('open')
        const btn = this.querySelector<HTMLElement>('.accordion-button')
        const collapseDiv = this.querySelector<HTMLElement>('.accordion-collapse')
        if (btn) {
            btn.classList.toggle('collapsed', !isOpen)
            btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
        }
        if (collapseDiv) {
            // Let the plugin own the `show` class: it drives the height
            // transition and bails out early when the class already matches
            // the target state (see Collapse.show/hide), so pre-toggling it
            // here would skip the animation and swallow the *.bs.collapse events.
            const instance = Collapse.getInstance(collapseDiv)
            if (instance) {
                if (isOpen) instance.show()
                else instance.hide()
            }
        }
    }

    private _onShow = (): void => {
        // Mirror the plugin's own state back onto the attribute (guarded so this
        // doesn't re-enter attributeChangedCallback) — needed both for a click
        // (which never touches the attribute) and for the accordion's own
        // exclusivity, which hides sibling items without going through their
        // `open` attribute either.
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

    private _attachListeners(): void {
        const el = this._collapseEl
        if (!el) return
        // Bootstrap's global data API used to create the Collapse lazily on
        // toggler click; the internal plugin is wired up explicitly instead.
        this._collapse = new Collapse(el as HTMLElement, { toggle: false })
        bindOnce(el, 'show.bs.collapse', this._onShow)
        bindOnce(el, 'shown.bs.collapse', this._onShown)
        bindOnce(el, 'hide.bs.collapse', this._onHide)
        bindOnce(el, 'hidden.bs.collapse', this._onHidden)
    }

    private _detachListeners(): void {
        this._collapse?.dispose()
        this._collapse = null
        const el = this._collapseEl
        if (!el) return
        el.removeEventListener('show.bs.collapse', this._onShow)
        el.removeEventListener('shown.bs.collapse', this._onShown)
        el.removeEventListener('hide.bs.collapse', this._onHide)
        el.removeEventListener('hidden.bs.collapse', this._onHidden)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AccordionItem
    }
}

import { Collapse } from 'bootstrap'

const TAG_NAME = 'tc-accordion-item'

let itemCounter = 0

export class AccordionItem extends HTMLElement {

    private _collapseId: string
    private _collapseEl: Element | null = null
    private _initialised = false

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
            const body = this.querySelector('.accordion-body')
            if (body) slotContent.forEach(n => body.appendChild(n))
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
        if (!this.isConnected || !this._initialised) return
        if (name === 'header') {
            const btn = this.querySelector<HTMLElement>('.accordion-button')
            if (btn) btn.textContent = this.getAttribute('header') ?? ''
        } else if (name === 'open') {
            this._updateOpenState()
        }
    }

    get header(): string {
        return this.getAttribute('header') ?? ''
    }
    set header(v: string) {
        this.setAttribute('header', v)
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

    private render(): void {
        const collapseId = this._collapseId
        const headerText = this.getAttribute('header') ?? ''
        const isOpen = this.hasAttribute('open')
        const parentId = this._parentAccordionId()
        const parentAttr = parentId ? ` data-bs-parent="#${parentId}"` : ''

        this.classList.add('accordion-item')
        this.innerHTML = `
<h2 class="accordion-header">
    <button class="accordion-button${isOpen ? '' : ' collapsed'}" type="button"
            data-bs-toggle="collapse"
            data-bs-target="#${collapseId}"
            aria-expanded="${isOpen ? 'true' : 'false'}"
            aria-controls="${collapseId}">
        ${headerText}
    </button>
</h2>
<div id="${collapseId}" class="accordion-collapse collapse${isOpen ? ' show' : ''}"${parentAttr}>
    <div class="accordion-body"></div>
</div>`.trim()
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
            collapseDiv.classList.toggle('show', isOpen)
            const instance = Collapse.getInstance(collapseDiv)
            if (instance) {
                if (isOpen) instance.show()
                else instance.hide()
            }
        }
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

    private _attachListeners(): void {
        const el = this._collapseEl
        if (!el) return
        el.addEventListener('show.bs.collapse', this._onShow)
        el.addEventListener('shown.bs.collapse', this._onShown)
        el.addEventListener('hide.bs.collapse', this._onHide)
        el.addEventListener('hidden.bs.collapse', this._onHidden)
    }

    private _detachListeners(): void {
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

// Shared scaffold for settings-screen rows (tc-setting-slider, tc-toggle-row and
// the other setting-row ports). Every row is a label/description text block on the left
// and a control region on the right; subclasses only supply the control markup
// (renderControl) and wire it up (bindControl). The host carries the
// `tc-setting-row` class so the shared `_setting-row.scss` partial paints the
// layout — control cosmetics live in each subclass's own partial.

export abstract class SettingRowBase extends HTMLElement {
    protected _initialised = false

    static get observedAttributes(): string[] {
        return ['row-label', 'description']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.renderRow()
            this._initialised = true
        }
    }

    attributeChangedCallback(_name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        this.renderRow()
    }

    get rowLabel(): string {
        return this.getAttribute('row-label') ?? ''
    }
    set rowLabel(v: string) {
        this.setAttribute('row-label', v)
    }

    get description(): string {
        return this.getAttribute('description') ?? ''
    }
    set description(v: string) {
        this.setAttribute('description', v)
    }

    // The control region differs per setting row — subclasses must implement it.
    protected abstract renderControl(): string

    // Optional post-render wiring (event listeners on the rendered control).
    protected bindControl(): void {}

    protected escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    protected emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    protected renderRow(): void {
        // classList.add (not className =) so author-supplied host classes survive.
        this.classList.add('tc-setting-row')
        const label = this.rowLabel
        const description = this.description
        const descMarkup = description
            ? `<div class="tc-setting-row__description">${this.escape(description)}</div>`
            : ''
        this.innerHTML = `
            <div class="tc-setting-row__text">
                <div class="tc-setting-row__label">${this.escape(label)}</div>
                ${descMarkup}
            </div>
            <div class="tc-setting-row__control">${this.renderControl()}</div>
        `
        this.bindControl()
    }
}

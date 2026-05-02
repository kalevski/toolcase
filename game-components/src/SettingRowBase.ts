export abstract class SettingRowBase extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['row-label', 'description']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.classList.add('gc-setting-row')
        this.renderRow()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.renderRow()
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

    protected abstract renderControl(): string

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
        const label = this.rowLabel
        const description = this.description
        const descMarkup = description ? `<div class="gc-setting-row-description">${this.escape(description)}</div>` : ''
        this.innerHTML = `
            <div class="gc-setting-row-text">
                <div class="gc-setting-row-label">${this.escape(label)}</div>
                ${descMarkup}
            </div>
            <div class="gc-setting-row-control">${this.renderControl()}</div>
        `
        this.bindControl()
    }

    protected abstract bindControl(): void
}

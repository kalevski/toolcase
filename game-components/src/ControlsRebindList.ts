const TAG_NAME = 'gc-controls-rebind-list'

export interface ControlBinding {
    id: string
    action: string
    key?: string
}

export interface ControlsRebindListEventMap {
    rebind: CustomEvent<{ id: string }>
}

export class ControlsRebindList extends HTMLElement {

    static get observedAttributes(): string[] {
        return []
    }

    private _bindings: ControlBinding[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'list')
        this.render()
    }

    get bindings(): ControlBinding[] {
        return this._bindings.slice()
    }
    set bindings(value: ControlBinding[]) {
        this._bindings = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const rowsHTML = this._bindings.map(binding => {
            const key = binding.key ?? ''
            const keyMarkup = key
                ? `<gc-key class="gc-controls-rebind-list-key">${this.escape(key)}</gc-key>`
                : `<span class="gc-controls-rebind-list-empty">Unbound</span>`
            return `<div class="gc-controls-rebind-list-row" role="listitem" data-id="${this.escape(binding.id)}" tabindex="0">
                <span class="gc-controls-rebind-list-action">${this.escape(binding.action)}</span>
                <div class="gc-controls-rebind-list-control">
                    ${keyMarkup}
                    <span class="gc-controls-rebind-list-rebind">Rebind</span>
                </div>
            </div>`
        }).join('')
        this.innerHTML = rowsHTML

        this.querySelectorAll<HTMLElement>('.gc-controls-rebind-list-row').forEach((el) => {
            const id = el.dataset.id ?? ''
            const fire = () => this.emit('rebind', { id })
            el.addEventListener('click', fire)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                fire()
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ControlsRebindList
    }
}

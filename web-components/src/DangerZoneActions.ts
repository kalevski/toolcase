import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-danger-zone-actions'

export interface DangerZoneAction {
    key: string
    title: string
    description?: string
    buttonLabel: string
    icon?: string
    disabled?: boolean
}

export class DangerZoneActions extends HTMLElement {
    private _initialised = false
    private _actions: DangerZoneAction[] = []

    onactionclick: ((key: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['class-name']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get actions(): DangerZoneAction[] {
        return this._actions
    }
    set actions(v: DangerZoneAction[]) {
        this._actions = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const extraClass = this.getAttribute('class-name')
        const wrapperClass = `tc-danger-zone${extraClass ? ` ${esc(extraClass)}` : ''}`

        const items = this._actions
            .map((action, idx) => {
                const disabled = action.disabled === true
                const disabledAttr = disabled ? ' disabled' : ''
                const iconHtml = action.icon ? lucideByName(action.icon) : ''
                const descHtml =
                    action.description != null
                        ? `<span class="tc-danger-zone-desc">${esc(action.description)}</span>`
                        : ''

                return (
                    `<div class="tc-danger-zone-item">` +
                    `<div class="tc-danger-zone-text">` +
                    `<span class="tc-danger-zone-title">${esc(action.title)}</span>` +
                    descHtml +
                    `</div>` +
                    `<button` +
                    ` class="btn btn-outline-danger tc-danger-zone-btn"` +
                    ` type="button"` +
                    ` data-idx="${idx}"` +
                    `${disabledAttr}` +
                    ` aria-label="${esc(action.buttonLabel)}"` +
                    `>` +
                    iconHtml +
                    `<span>${esc(action.buttonLabel)}</span>` +
                    `</button>` +
                    `</div>`
                )
            })
            .join('')

        this.innerHTML = `<div class="${wrapperClass}">${items}</div>`

        const wrapper = this.querySelector<HTMLElement>('.tc-danger-zone')
        if (wrapper) {
            wrapper.addEventListener('click', (e: Event) => {
                const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
                    '.tc-danger-zone-btn',
                )
                if (!btn || btn.disabled) return
                const idx = parseInt(btn.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._actions.length) {
                    const key = this._actions[idx].key
                    this.dispatchEvent(
                        new CustomEvent('tc-action-click', {
                            bubbles: true,
                            composed: true,
                            detail: { key },
                        }),
                    )
                    if (typeof this.onactionclick === 'function') this.onactionclick(key)
                }
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DangerZoneActions
    }
}

import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-state-machine'

export type StateMachineStatus = 'done' | 'active' | 'pending' | 'error'
const STATUSES: StateMachineStatus[] = ['done', 'active', 'pending', 'error']

export interface StateMachineItem {
    id: string
    label: string
    description?: string
    status?: StateMachineStatus
}

const checkIconHtml = lucideByName('check')
const alertCircleIconHtml = lucideByName('alert-circle')

export class StateMachine extends HTMLElement {
    private _initialised = false
    private _states: StateMachineItem[] = []

    static get observedAttributes(): string[] {
        return ['compact']
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

    get states(): StateMachineItem[] {
        return this._states
    }
    set states(v: StateMachineItem[]) {
        this._states = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get compact(): boolean {
        return this.hasAttribute('compact')
    }
    set compact(v: boolean) {
        if (v) this.setAttribute('compact', '')
        else this.removeAttribute('compact')
    }

    private _markerHtml(status: StateMachineStatus): string {
        const ariaLabel = status.charAt(0).toUpperCase() + status.slice(1)
        switch (status) {
            case 'done':
                return `<span class="tc-state-machine-marker tc-state-machine-marker-done" aria-label="${ariaLabel}">${checkIconHtml}</span>`
            case 'active':
                return `<span class="tc-state-machine-marker tc-state-machine-marker-active" aria-label="${ariaLabel}"></span>`
            case 'pending':
                return `<span class="tc-state-machine-marker tc-state-machine-marker-pending" aria-label="${ariaLabel}"></span>`
            case 'error':
                return `<span class="tc-state-machine-marker tc-state-machine-marker-error" aria-label="${ariaLabel}">${alertCircleIconHtml}</span>`
        }
    }

    private render(): void {
        const compact = this.compact
        const states = this._states

        this.classList.add('tc-state-machine')
        if (compact) this.classList.add('tc-state-machine--compact')
        else this.classList.remove('tc-state-machine--compact')
        this.setAttribute('role', 'list')

        this.innerHTML = states
            .map((state, i) => {
                const status: StateMachineStatus = STATUSES.includes(
                    state.status as StateMachineStatus,
                )
                    ? (state.status as StateMachineStatus)
                    : 'pending'
                const isLast = i === states.length - 1
                const marker = this._markerHtml(status)
                const connectorHtml = !isLast
                    ? `<div class="tc-state-machine-connector" aria-hidden="true"></div>`
                    : ''
                const labelHtml = `<span class="tc-state-machine-label">${esc(state.label)}</span>`
                const descHtml =
                    state.description && !compact
                        ? `<span class="tc-state-machine-description">${esc(state.description)}</span>`
                        : ''
                return `<div class="tc-state-machine-state tc-state-machine-state-${status}" role="listitem"><div class="tc-state-machine-track">${marker}${connectorHtml}</div><div class="tc-state-machine-body">${labelHtml}${descHtml}</div></div>`
            })
            .join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StateMachine
    }
}

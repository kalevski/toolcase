const TAG_NAME = 'tc-matchmaking-screen'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export type MatchmakingScreenState = 'searching' | 'connecting' | 'found' | 'failed' | 'idle'

const STATES: MatchmakingScreenState[] = ['searching', 'connecting', 'found', 'failed', 'idle']

export interface MatchmakingScreenEventMap {
    'tc-accept': CustomEvent<Record<string, never>>
    'tc-cancel': CustomEvent<Record<string, never>>
}

export class MatchmakingScreen extends HTMLElement {

    private _initialised = false

    onAccept: (() => void) | null = null
    onCancel: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['state', 'elapsed', 'estimated', 'region', 'mode', 'found-label']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get state(): MatchmakingScreenState {
        const raw = this.getAttribute('state') as MatchmakingScreenState | null
        return (raw && STATES.includes(raw)) ? raw : 'idle'
    }
    set state(v: MatchmakingScreenState) {
        if (v) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    get elapsed(): number {
        const raw = this.getAttribute('elapsed')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    }
    set elapsed(v: number) {
        this.setAttribute('elapsed', String(v))
    }

    get estimated(): number {
        const raw = this.getAttribute('estimated')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    }
    set estimated(v: number) {
        this.setAttribute('estimated', String(v))
    }

    get region(): string {
        return this.getAttribute('region') ?? ''
    }
    set region(v: string) {
        if (v) this.setAttribute('region', v)
        else this.removeAttribute('region')
    }

    get mode(): string {
        return this.getAttribute('mode') ?? ''
    }
    set mode(v: string) {
        if (v) this.setAttribute('mode', v)
        else this.removeAttribute('mode')
    }

    get foundLabel(): string {
        return this.getAttribute('found-label') ?? 'Match Found'
    }
    set foundLabel(v: string) {
        if (v) this.setAttribute('found-label', v)
        else this.removeAttribute('found-label')
    }

    private _emit(name: 'tc-accept' | 'tc-cancel'): void {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail: {} }))
        if (name === 'tc-accept' && typeof this.onAccept === 'function') this.onAccept()
        else if (name === 'tc-cancel' && typeof this.onCancel === 'function') this.onCancel()
    }

    private _formatDuration(seconds: number): string {
        const total = Math.max(0, Math.floor(seconds))
        const m = Math.floor(total / 60)
        const s = total % 60
        return `${m}:${String(s).padStart(2, '0')}`
    }

    private _titleFor(state: MatchmakingScreenState): string {
        switch (state) {
            case 'searching':  return 'Searching for Match'
            case 'connecting': return 'Connecting'
            case 'found':      return this.foundLabel
            case 'failed':     return 'Match Failed'
            case 'idle':
            default:           return 'Idle'
        }
    }

    private _eyebrowFor(state: MatchmakingScreenState): string {
        switch (state) {
            case 'searching':  return 'Matchmaking'
            case 'connecting': return 'Joining'
            case 'found':      return 'Ready'
            case 'failed':     return 'Error'
            case 'idle':
            default:           return 'Matchmaking'
        }
    }

    // Returns the SVG icon string for the state indicator ring
    private _iconFor(state: MatchmakingScreenState): string {
        switch (state) {
            case 'searching':
            case 'connecting':
                // Lucide Loader-2 (spinning arcs)
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true" class="tc-matchmaking-screen-icon">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>`
            case 'found':
                // Lucide Check
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true" class="tc-matchmaking-screen-icon">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>`
            case 'failed':
                // Lucide X
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true" class="tc-matchmaking-screen-icon">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>`
            default:
                // Lucide Minus (idle)
                return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round"
                    stroke-linejoin="round" aria-hidden="true" class="tc-matchmaking-screen-icon">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>`
        }
    }

    private render(): void {
        const state = this.state
        const elapsed = this.elapsed
        const estimated = this.estimated
        const region = this.region
        const mode = this.mode

        // Meta row — Mode, Region, elapsed, ETA (only for active searching/connecting)
        const metaItems: string[] = []
        if (mode) metaItems.push(
            `<div class="tc-matchmaking-screen-meta-item">
                <span class="tc-matchmaking-screen-meta-key">Mode</span>
                <span class="tc-matchmaking-screen-meta-val">${esc(mode)}</span>
            </div>`
        )
        if (region) metaItems.push(
            `<div class="tc-matchmaking-screen-meta-item">
                <span class="tc-matchmaking-screen-meta-key">Region</span>
                <span class="tc-matchmaking-screen-meta-val">${esc(region)}</span>
            </div>`
        )
        if (state === 'searching' || state === 'connecting') {
            metaItems.push(
                `<div class="tc-matchmaking-screen-meta-item">
                    <span class="tc-matchmaking-screen-meta-key">Elapsed</span>
                    <span class="tc-matchmaking-screen-meta-val">${esc(this._formatDuration(elapsed))}</span>
                </div>`
            )
            if (estimated > 0) metaItems.push(
                `<div class="tc-matchmaking-screen-meta-item">
                    <span class="tc-matchmaking-screen-meta-key">ETA</span>
                    <span class="tc-matchmaking-screen-meta-val">${esc(this._formatDuration(estimated))}</span>
                </div>`
            )
        }
        const metaMarkup = metaItems.length
            ? `<div class="tc-matchmaking-screen-meta">${metaItems.join('')}</div>`
            : ''

        // State indicator ring — spinning for active, check for found, x for failed
        const isActive = state === 'searching' || state === 'connecting'
        const ringMod = isActive ? ' tc-matchmaking-screen-ring--spin'
            : state === 'found' ? ' tc-matchmaking-screen-ring--found'
                : state === 'failed' ? ' tc-matchmaking-screen-ring--failed'
                    : ''

        const ringMarkup = `<div class="tc-matchmaking-screen-ring${ringMod}" aria-hidden="true">
            ${this._iconFor(state)}
        </div>`

        // Action buttons
        let actionsMarkup = ''
        if (state === 'found') {
            actionsMarkup = `
                <button type="button" class="tc-matchmaking-screen-btn tc-matchmaking-screen-btn--accept" data-action="accept">Accept</button>
                <button type="button" class="tc-matchmaking-screen-btn tc-matchmaking-screen-btn--cancel" data-action="cancel">Decline</button>`
        } else if (state === 'searching' || state === 'connecting' || state === 'failed') {
            const cancelLabel = state === 'failed' ? 'Close' : 'Cancel'
            actionsMarkup = `<button type="button" class="tc-matchmaking-screen-btn tc-matchmaking-screen-btn--cancel" data-action="cancel">${cancelLabel}</button>`
        }

        this.innerHTML = `
            <div class="tc-matchmaking-screen" data-state="${esc(state)}">
                ${ringMarkup}
                <div class="tc-matchmaking-screen-header">
                    <div class="tc-matchmaking-screen-eyebrow">${esc(this._eyebrowFor(state))}</div>
                    <div class="tc-matchmaking-screen-title">${esc(this._titleFor(state))}</div>
                </div>
                ${metaMarkup}
                ${actionsMarkup ? `<div class="tc-matchmaking-screen-actions">${actionsMarkup}</div>` : ''}
            </div>
        `

        // Delegate clicks on the fresh actions bar
        const actions = this.querySelector<HTMLElement>('.tc-matchmaking-screen-actions')
        actions?.addEventListener('click', (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')
            if (!btn || btn.disabled) return
            const action = btn.dataset.action
            if (action === 'accept') this._emit('tc-accept')
            else if (action === 'cancel') this._emit('tc-cancel')
        })
    }
}

declare global {
    interface HTMLElementTagNameMap { [TAG_NAME]: MatchmakingScreen }
}

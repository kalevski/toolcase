const TAG_NAME = 'gc-matchmaking-screen'

export type MatchmakingScreenState = 'searching' | 'connecting' | 'found' | 'failed' | 'idle'

export interface MatchmakingScreenEventMap {
    accept: CustomEvent<void>
    cancel: CustomEvent<void>
}

export class MatchmakingScreen extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['state', 'elapsed', 'estimated', 'region', 'mode', 'found-label']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get state(): MatchmakingScreenState {
        const raw = this.getAttribute('state')
        if (raw === 'searching' || raw === 'connecting' || raw === 'found' || raw === 'failed' || raw === 'idle') return raw
        return 'idle'
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

    private formatDuration(seconds: number): string {
        const total = Math.max(0, Math.floor(seconds))
        const m = Math.floor(total / 60)
        const s = total % 60
        return `${m}:${String(s).padStart(2, '0')}`
    }

    private titleFor(state: MatchmakingScreenState): string {
        switch (state) {
            case 'searching': return 'Searching for Match'
            case 'connecting': return 'Connecting'
            case 'found': return this.foundLabel
            case 'failed': return 'Match Failed'
            case 'idle':
            default: return 'Idle'
        }
    }

    private eyebrowFor(state: MatchmakingScreenState): string {
        switch (state) {
            case 'searching': return 'Matchmaking'
            case 'connecting': return 'Joining'
            case 'found': return 'Ready'
            case 'failed': return 'Error'
            case 'idle':
            default: return 'Matchmaking'
        }
    }

    private render(): void {
        const state = this.state
        const elapsed = this.elapsed
        const estimated = this.estimated
        const region = this.region
        const mode = this.mode

        const metaItems: string[] = []
        if (mode) metaItems.push(`<div class="gc-matchmaking-screen-meta-item"><span class="gc-matchmaking-screen-meta-label">Mode</span><span class="gc-matchmaking-screen-meta-value">${this.escape(mode)}</span></div>`)
        if (region) metaItems.push(`<div class="gc-matchmaking-screen-meta-item"><span class="gc-matchmaking-screen-meta-label">Region</span><span class="gc-matchmaking-screen-meta-value">${this.escape(region)}</span></div>`)
        if (state === 'searching' || state === 'connecting') {
            metaItems.push(`<div class="gc-matchmaking-screen-meta-item"><span class="gc-matchmaking-screen-meta-label">Elapsed</span><span class="gc-matchmaking-screen-meta-value">${this.formatDuration(elapsed)}</span></div>`)
            if (estimated > 0) metaItems.push(`<div class="gc-matchmaking-screen-meta-item"><span class="gc-matchmaking-screen-meta-label">ETA</span><span class="gc-matchmaking-screen-meta-value">${this.formatDuration(estimated)}</span></div>`)
        }
        const metaMarkup = metaItems.length
            ? `<div class="gc-matchmaking-screen-meta">${metaItems.join('')}</div>`
            : ''

        const ringMarkup = state === 'searching' || state === 'connecting'
            ? `<div class="gc-matchmaking-screen-ring is-spin"><span class="gc-matchmaking-screen-ring-inner">${state === 'searching' ? '✦' : '⚔'}</span></div>`
            : state === 'found'
                ? `<div class="gc-matchmaking-screen-ring is-found"><span class="gc-matchmaking-screen-ring-inner">◆</span></div>`
                : state === 'failed'
                    ? `<div class="gc-matchmaking-screen-ring is-failed"><span class="gc-matchmaking-screen-ring-inner">✕</span></div>`
                    : `<div class="gc-matchmaking-screen-ring"><span class="gc-matchmaking-screen-ring-inner">·</span></div>`

        const actionsMarkup = state === 'found'
            ? `<gc-metal-button class="gc-matchmaking-screen-accept" variant="primary">Accept</gc-metal-button>
               <gc-metal-button class="gc-matchmaking-screen-cancel" variant="ghost">Decline</gc-metal-button>`
            : state === 'searching' || state === 'connecting' || state === 'failed'
                ? `<gc-metal-button class="gc-matchmaking-screen-cancel" variant="ghost">${state === 'failed' ? 'Close' : 'Cancel'}</gc-metal-button>`
                : ''

        this.innerHTML = `
            <div class="gc-matchmaking-screen-root" data-state="${state}">
                ${ringMarkup}
                <gc-eyebrow class="gc-matchmaking-screen-eyebrow">${this.escape(this.eyebrowFor(state))}</gc-eyebrow>
                <gc-title class="gc-matchmaking-screen-title">${this.escape(this.titleFor(state))}</gc-title>
                ${metaMarkup}
                <div class="gc-matchmaking-screen-actions">${actionsMarkup}</div>
            </div>
        `

        const accept = this.querySelector('.gc-matchmaking-screen-accept') as HTMLElement | null
        accept?.addEventListener('click', () => this.emit('accept'))
        const cancel = this.querySelector('.gc-matchmaking-screen-cancel') as HTMLElement | null
        cancel?.addEventListener('click', () => this.emit('cancel'))
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, MatchmakingScreen)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MatchmakingScreen
    }
}

const TAG_NAME = 'tc-welcome-guide'

export interface WelcomeGuideStep {
    key: string
    label: string
    completed: boolean
}

type StepState = 'completed' | 'active' | 'locked'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function deriveStepState(steps: WelcomeGuideStep[], idx: number): StepState {
    if (steps[idx].completed) return 'completed'
    // first not-completed step is active
    const firstActiveIdx = steps.findIndex(s => !s.completed)
    if (idx === firstActiveIdx) return 'active'
    return 'locked'
}

// Animated SVG tick path for the completed check indicator
const TICK_SVG = `<svg class="tc-welcome-guide-check-tick" aria-hidden="true" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline class="tc-welcome-guide-check-tick-path" points="1.5,6 5,9.5 10.5,2.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`

const DASH_SVG = `<svg class="tc-welcome-guide-check-dash" aria-hidden="true" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="2.5" y1="6" x2="9.5" y2="6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>`

export class WelcomeGuide extends HTMLElement {
    private _initialised = false
    private _messages: string[] = []
    private _steps: WelcomeGuideStep[] = []

    onstepclick: ((e: CustomEvent<{ key: string }>, stepKey: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['title', 'background-pattern-src', 'background-pattern-alt', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.addEventListener('click', this._handleClick)
            this.addEventListener('keydown', this._handleKeydown)
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._handleClick)
        this.removeEventListener('keydown', this._handleKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get messages(): string[] {
        return this._messages
    }
    set messages(v: string[]) {
        this._messages = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get steps(): WelcomeGuideStep[] {
        return this._steps
    }
    set steps(v: WelcomeGuideStep[]) {
        this._steps = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    private _handleClick = (e: MouseEvent): void => {
        const step = (e.target as HTMLElement).closest('[data-wg-key]')
        if (!(step instanceof HTMLElement)) return
        if (step.getAttribute('aria-disabled') === 'true') return
        const key = step.dataset.wgKey
        if (!key) return
        this._dispatchStepClick(key)
    }

    private _handleKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const step = (e.target as HTMLElement).closest('[data-wg-key]')
        if (!(step instanceof HTMLElement)) return
        if (step.getAttribute('aria-disabled') === 'true') return
        const key = step.dataset.wgKey
        if (!key) return
        e.preventDefault()
        this._dispatchStepClick(key)
    }

    private _dispatchStepClick(key: string): void {
        const ev = new CustomEvent<{ key: string }>('tc-step-click', {
            bubbles: true,
            composed: true,
            detail: { key },
        })
        this.dispatchEvent(ev)
        if (typeof this.onstepclick === 'function') {
            this.onstepclick(ev, key)
        }
    }

    private render(): void {
        const loading = this.loading
        const title = this.getAttribute('title') ?? ''
        const patternSrc = this.getAttribute('background-pattern-src')
        const patternAlt = this.getAttribute('background-pattern-alt') ?? ''

        if (loading) {
            this.innerHTML = this._renderLoading()
            return
        }

        const total = this._steps.length
        const completed = this._steps.filter(s => s.completed).length
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0

        const patternHtml = patternSrc
            ? `<img class="tc-welcome-guide-pattern" src="${esc(patternSrc)}" alt="${esc(patternAlt)}" aria-hidden="true" />`
            : ''

        const messagesHtml = this._messages
            .map(m => `<p class="tc-welcome-guide-message">${esc(m)}</p>`)
            .join('')

        const progressHtml =
            `<div class="tc-welcome-guide-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress: ${completed} of ${total} steps completed">` +
            `<div class="tc-welcome-guide-progress-bar" style="width:${pct}%"></div>` +
            `</div>` +
            `<p class="tc-welcome-guide-progress-label" aria-hidden="true">${completed}/${total} completed</p>`

        const stepsHtml = this._steps.map((step, idx) => {
            const state = deriveStepState(this._steps, idx)
            const isActive = state === 'active'
            const isCompleted = state === 'completed'
            const isLocked = state === 'locked'

            let checkHtml: string
            if (isCompleted) {
                checkHtml = `<span class="tc-welcome-guide-check tc-welcome-guide-check--completed" aria-hidden="true">${TICK_SVG}</span>`
            } else if (isActive) {
                checkHtml = `<span class="tc-welcome-guide-check tc-welcome-guide-check--active" aria-hidden="true"></span>`
            } else {
                checkHtml = `<span class="tc-welcome-guide-check tc-welcome-guide-check--locked" aria-hidden="true">${DASH_SVG}</span>`
            }

            const stateLabel = isCompleted ? ' (completed)' : isLocked ? ' (locked)' : ''
            const ariaLabel = `${esc(step.label)}${stateLabel}`
            const ariaDisabled = !isActive ? ' aria-disabled="true"' : ''
            const tabIndex = isActive ? ' tabindex="0"' : ' tabindex="-1"'
            const dataKey = `data-wg-key="${esc(step.key)}"`

            return (
                `<li class="tc-welcome-guide-step tc-welcome-guide-step--${state}" role="listitem">` +
                `<div role="button" class="tc-welcome-guide-step-inner" aria-label="${ariaLabel}"${ariaDisabled}${tabIndex} ${dataKey}>` +
                checkHtml +
                `<span class="tc-welcome-guide-step-label">${esc(step.label)}</span>` +
                `</div>` +
                `</li>`
            )
        }).join('')

        this.innerHTML =
            `<div class="tc-welcome-guide">` +
            patternHtml +
            `<div class="tc-welcome-guide-body">` +
            (title ? `<h2 class="tc-welcome-guide-title">${esc(title)}</h2>` : '') +
            (messagesHtml ? `<div class="tc-welcome-guide-messages">${messagesHtml}</div>` : '') +
            progressHtml +
            `<ul class="tc-welcome-guide-steps" role="list" aria-label="Onboarding steps">` +
            stepsHtml +
            `</ul>` +
            `</div>` +
            `</div>`
    }

    private _renderLoading(): string {
        return (
            `<div class="tc-welcome-guide tc-welcome-guide--loading" role="status" aria-busy="true">` +
            `<span class="visually-hidden">Loading…</span>` +
            `<div class="tc-welcome-guide-body">` +
            `<div class="tc-welcome-guide-skel tc-welcome-guide-skel--title" aria-hidden="true"></div>` +
            `<div class="tc-welcome-guide-skel tc-welcome-guide-skel--msg" aria-hidden="true"></div>` +
            `<div class="tc-welcome-guide-skel tc-welcome-guide-skel--msg tc-welcome-guide-skel--msg-short" aria-hidden="true"></div>` +
            `<div class="tc-welcome-guide-skel tc-welcome-guide-skel--progress" aria-hidden="true"></div>` +
            `<ul class="tc-welcome-guide-steps" role="list" aria-hidden="true">` +
            Array.from({ length: 3 }, () =>
                `<li class="tc-welcome-guide-step">` +
                `<div class="tc-welcome-guide-step-inner">` +
                `<span class="tc-welcome-guide-check tc-welcome-guide-skel tc-welcome-guide-skel--check"></span>` +
                `<span class="tc-welcome-guide-skel tc-welcome-guide-skel--step-label"></span>` +
                `</div>` +
                `</li>`
            ).join('') +
            `</ul>` +
            `</div>` +
            `</div>`
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: WelcomeGuide
    }
}

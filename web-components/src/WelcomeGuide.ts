import { esc } from './internal/esc'
const TAG_NAME = 'tc-welcome-guide'

export interface WelcomeGuideStep {
    key: string
    label: string
    completed: boolean
}

type StepState = 'completed' | 'active' | 'locked'

function deriveStepState(steps: WelcomeGuideStep[], idx: number): StepState {
    if (steps[idx].completed) return 'completed'
    // first not-completed step is active
    const firstActiveIdx = steps.findIndex((s) => !s.completed)
    if (idx === firstActiveIdx) return 'active'
    return 'locked'
}

// Custom step indicator — square box with an animated SVG tick (completed),
// a hover ring (active/clickable) or a muted dash (locked). Mirrors the
// react-components WelcomeGuideCheck so the checklist carries its own visuals.
function checkSvg(state: StepState): string {
    if (state === 'completed') {
        return (
            `<svg class="tc-welcome-guide__check-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">` +
            `<path class="tc-welcome-guide__check-tick" d="M3.5 8.5 L6.5 11.5 L12.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/>` +
            `</svg>`
        )
    }
    return (
        `<svg class="tc-welcome-guide__check-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">` +
        `<line class="tc-welcome-guide__check-dash" x1="4.5" y1="8" x2="11.5" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="square"/>` +
        `</svg>`
    )
}

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
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._handleClick)
        this.addEventListener('keydown', this._handleKeydown)
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

        // Left (dark hero) panel — title + messages over the gradient glow.
        const patternHtml =
            !loading && patternSrc
                ? `<div class="tc-welcome-guide__background" aria-hidden="true"><img class="tc-welcome-guide__background-pattern" src="${esc(patternSrc)}" alt="${esc(patternAlt)}" loading="lazy" aria-hidden="true" /></div>`
                : ''

        const messagesHtml = this._messages
            .map((m) => `<li class="tc-welcome-guide__message">${esc(m)}</li>`)
            .join('')

        const leftHtml =
            `<div class="tc-welcome-guide__left">` +
            patternHtml +
            `<div class="tc-welcome-guide__left-content">` +
            (title ? `<h3 class="tc-welcome-guide__title">${esc(title)}</h3>` : '') +
            (messagesHtml ? `<ul class="tc-welcome-guide__messages">${messagesHtml}</ul>` : '') +
            `</div>` +
            `</div>`

        // Right (light checklist) panel — progress + steps.
        const rightHtml = loading ? this._renderLoadingRight() : this._renderRight()

        this.innerHTML =
            `<div class="component component-welcome-guide tc-welcome-guide"${loading ? ' aria-busy="true"' : ''}>` +
            leftHtml +
            rightHtml +
            `</div>`
    }

    private _renderRight(): string {
        const total = this._steps.length
        const completed = this._steps.filter((s) => s.completed).length
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0

        const progressHtml =
            `<div class="tc-welcome-guide__progress-wrap">` +
            `<div class="tc-welcome-guide__progress-header">` +
            `<span class="tc-welcome-guide__progress-label">${completed} of ${total} complete</span>` +
            `<span class="tc-welcome-guide__progress-value">${pct}%</span>` +
            `</div>` +
            `<div class="tc-welcome-guide__progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${completed} of ${total} complete">` +
            `<div class="tc-welcome-guide__progress-bar" style="width:${pct}%"></div>` +
            `</div>` +
            `</div>`

        const stepsHtml = this._steps
            .map((step, idx) => {
                const state = deriveStepState(this._steps, idx)
                const isActive = state === 'active'
                const isCompleted = state === 'completed'
                const isLocked = state === 'locked'

                const stepClass = [
                    'tc-welcome-guide__step',
                    isCompleted ? 'tc-welcome-guide__step--completed' : '',
                    isActive ? 'tc-welcome-guide__step--active' : '',
                ]
                    .filter(Boolean)
                    .join(' ')

                const checkHtml =
                    `<span class="tc-welcome-guide__check tc-welcome-guide__check--${state}" aria-hidden="true">` +
                    checkSvg(state) +
                    `</span>`

                const stateLabel = isCompleted ? ' (completed)' : isLocked ? ' (locked)' : ''
                const ariaLabel = `${esc(step.label)}${stateLabel}`
                const ariaDisabled = !isActive ? ' aria-disabled="true"' : ''
                const tabIndex = isActive ? ' tabindex="0"' : ' tabindex="-1"'
                const dataKey = `data-wg-key="${esc(step.key)}"`

                return (
                    `<li class="${stepClass}" role="checkbox" aria-checked="${isCompleted}" aria-label="${ariaLabel}"${ariaDisabled}${tabIndex} ${dataKey}>` +
                    checkHtml +
                    `<span class="tc-welcome-guide__step-label">${esc(step.label)}</span>` +
                    `</li>`
                )
            })
            .join('')

        return (
            `<div class="tc-welcome-guide__right">` +
            progressHtml +
            `<ul class="tc-welcome-guide__steps" role="list" aria-label="Onboarding steps">` +
            stepsHtml +
            `</ul>` +
            `</div>`
        )
    }

    private _renderLoadingRight(): string {
        return (
            `<div class="tc-welcome-guide__right" role="status" aria-busy="true">` +
            `<span class="visually-hidden">Loading…</span>` +
            `<div class="tc-welcome-guide__skel tc-welcome-guide__skel--progress" aria-hidden="true"></div>` +
            `<ul class="tc-welcome-guide__steps" role="list" aria-hidden="true">` +
            Array.from(
                { length: 4 },
                () =>
                    `<li class="tc-welcome-guide__step">` +
                    `<span class="tc-welcome-guide__check tc-welcome-guide__skel tc-welcome-guide__skel--check"></span>` +
                    `<span class="tc-welcome-guide__skel tc-welcome-guide__skel--step-label"></span>` +
                    `</li>`,
            ).join('') +
            `</ul>` +
            `</div>`
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: WelcomeGuide
    }
}

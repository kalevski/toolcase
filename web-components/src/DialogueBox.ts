import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { chevronDownIcon, chevronRightIcon } from './icons'

const TAG_NAME = 'tc-dialogue-box'

export interface DialogueChoice {
    id: string
    label: string
    disabled?: boolean
}

export interface DialogueBoxEventMap {
    'tc-choice': CustomEvent<{ id: string }>
    'tc-advance': CustomEvent<Record<string, never>>
}

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
}

export class DialogueBox extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['speaker', 'text', 'typing-speed']
    }

    private _choices: DialogueChoice[] = []
    private _typingTimer: number | null = null
    private _typedLength = 0

    // Public callback surface — paired with the tc-* CustomEvents (see _emit).
    onChoice: ((id: string) => void) | null = null
    onAdvance: (() => void) | null = null

    private _clickHandler = (event: Event): void => this._handleClick(event)
    private _keydownHandler = (event: Event): void => this._handleKeydown(event as KeyboardEvent)
    // Whether we own the `role` attribute (false the moment a consumer sets one
    // explicitly) — mirrors the same guard already used for the default value.
    private _roleIsManaged = true

    connectedCallback(): void {
        this._roleIsManaged = !this.hasAttribute('role')
        if (this._roleIsManaged) this.setAttribute('role', 'group')
        this.addEventListener('click', this._clickHandler)
        this.addEventListener('keydown', this._keydownHandler)
        this.render()
        this._startTyping()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._clickHandler)
        this.removeEventListener('keydown', this._keydownHandler)
        this._stopTyping()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected) return
        if (name === 'text') {
            this.render()
            this._startTyping()
            return
        }
        this.render()
    }

    get speaker(): string {
        return this.getAttribute('speaker') ?? ''
    }
    set speaker(v: string) {
        if (v) this.setAttribute('speaker', v)
        else this.removeAttribute('speaker')
    }

    get text(): string {
        return this.getAttribute('text') ?? ''
    }
    set text(v: string) {
        if (v) this.setAttribute('text', v)
        else this.removeAttribute('text')
    }

    get typingSpeed(): number {
        const raw = this.getAttribute('typing-speed')
        if (raw == null) return 24
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 24
    }
    set typingSpeed(v: number) {
        this.setAttribute('typing-speed', String(v))
    }

    get choices(): DialogueChoice[] {
        return this._choices
    }
    set choices(value: DialogueChoice[]) {
        this._choices = Array.isArray(value) ? value : []
        if (this.isConnected) this.render()
    }

    private _emit(name: string, detail: Record<string, unknown>): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private _stopTyping(): void {
        if (this._typingTimer != null) {
            window.clearInterval(this._typingTimer)
            this._typingTimer = null
        }
    }

    private _startTyping(): void {
        this._stopTyping()
        const full = this.text
        this._typedLength = 0
        // Decorative motion only — under reduced-motion reveal the full line at once.
        if (!full || prefersReducedMotion()) {
            this._typedLength = full.length
            this._updateTyped()
            return
        }
        this._updateTyped()
        const interval = Math.max(8, 1000 / this.typingSpeed)
        this._typingTimer = window.setInterval(() => {
            this._typedLength += 1
            // Stop before the final repaint so _updateTyped() sees typing as finished
            // and reveals the advance caret / choices on the last character.
            if (this._typedLength >= full.length) this._stopTyping()
            this._updateTyped()
        }, interval)
    }

    private _isTyping(): boolean {
        return this._typingTimer != null
    }

    private _updateTyped(): void {
        const textEl = this.querySelector('.tc-dialogue-box-text') as HTMLElement | null
        if (!textEl) return
        const full = this.text
        textEl.textContent = full.slice(0, this._typedLength)
        // Length-based, not _isTyping()-based: _startTyping() calls this once
        // synchronously BEFORE it assigns _typingTimer, so _isTyping() would read
        // false for that one frame and briefly reveal the choices/indicator a tick
        // before typing has actually finished.
        const stillRevealing = this._typedLength < full.length
        const choicesEl = this.querySelector('.tc-dialogue-box-choices') as HTMLElement | null
        if (choicesEl) {
            choicesEl.classList.toggle('is-visible', !stillRevealing && this._choices.length > 0)
        }
        const indicator = this.querySelector('.tc-dialogue-box-indicator') as HTMLElement | null
        if (indicator) {
            indicator.classList.toggle('is-visible', !stillRevealing && this._choices.length === 0)
        }
        // Keyboard parity for the click affordance: focusable while there is
        // something for Enter/Space to do (fast-forward mid-type, or advance once
        // revealed when there are no choices to shift focus to instead).
        this.tabIndex = stillRevealing || this._choices.length === 0 ? 0 : -1
    }

    private _handleClick(event: Event): void {
        const target = event.target as HTMLElement
        // Clicks on a choice are handled by the choice's own listener — don't advance.
        if (target.closest('.tc-dialogue-box-choice')) return
        // First click while typing fast-forwards to the full line.
        if (this._isTyping()) {
            this._typedLength = this.text.length
            this._stopTyping()
            this._updateTyped()
            return
        }
        // Once revealed, an empty-choice box advances the dialogue.
        if (this._choices.length === 0) {
            this._emit('tc-advance', {})
            if (typeof this.onAdvance === 'function') this.onAdvance()
        }
    }

    // Enter/Space parity for the click affordance above — the host itself isn't a
    // native control, so it needs its own key handling (matching e.g. tc-build's
    // clickable-card pattern). Choice buttons are real <button>s and handle their
    // own Enter/Space; this only has to stay out of their way.
    private _handleKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Enter' && event.key !== ' ') return
        const target = event.target as HTMLElement
        if (target.closest('.tc-dialogue-box-choice')) return
        event.preventDefault()
        this._handleClick(event)
    }

    private render(): void {
        // Advance-by-click only ever applies once no choices are configured —
        // reflect that as role="button" (falling back to "group" once choices
        // take over, since those are their own focusable buttons).
        if (this._roleIsManaged) {
            this.setAttribute('role', this._choices.length === 0 ? 'button' : 'group')
        }
        const speaker = this.speaker
        const speakerMarkup = speaker
            ? `<div class="tc-dialogue-box-speaker"><span class="tc-dialogue-box-speaker-name">${esc(speaker)}</span></div>`
            : ''
        const choicesMarkup = this._choices.length
            ? `<div class="tc-dialogue-box-choices" role="group" aria-label="Dialogue choices">${this._choices
                  .map((c) => {
                      const cls = `tc-dialogue-box-choice${c.disabled ? ' is-disabled' : ''}`
                      const disabledAttr = c.disabled ? ' disabled aria-disabled="true"' : ''
                      return `<button type="button" class="${cls}"${disabledAttr} data-id="${esc(c.id)}"><span class="tc-dialogue-box-choice-marker" aria-hidden="true">${chevronRightIcon}</span><span class="tc-dialogue-box-choice-label">${esc(
                          c.label,
                      )}</span></button>`
                  })
                  .join('')}</div>`
            : ''
        patchHtml(
            this,
            `
            ${speakerMarkup}
            <div class="tc-dialogue-box-body">
                <span class="tc-dialogue-box-text"></span>
                <span class="tc-dialogue-box-indicator" aria-hidden="true">${chevronDownIcon}</span>
            </div>
            ${choicesMarkup}
        `,
        )
        this._updateTyped()

        this.querySelectorAll<HTMLButtonElement>('.tc-dialogue-box-choice').forEach((el) => {
            const handle = (event: Event): void => {
                event.stopPropagation()
                const id = el.dataset.id || ''
                const c = this._choices.find((x) => x.id === id)
                if (!c || c.disabled) return
                this._emit('tc-choice', { id })
                if (typeof this.onChoice === 'function') this.onChoice(id)
            }
            // Native <button> already maps Enter/Space to click — one listener is enough.
            bindOnce(el, 'click', handle)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DialogueBox
    }
}

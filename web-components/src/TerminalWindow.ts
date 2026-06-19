import { esc } from './internal/esc'
const TAG_NAME = 'tc-terminal-window'

export type TerminalLineType = 'command' | 'output' | 'comment'

const TYPES: TerminalLineType[] = ['command', 'output', 'comment']

export interface TerminalLine {
    type?: TerminalLineType
    text: string
}

let _uid = 0

const DEFAULT_SPEED = 40 // ms per character

export class TerminalWindow extends HTMLElement {
    private _initialised = false
    private _lines: TerminalLine[] = []
    private _titleId = `tc-terminal-window-title-${++_uid}`

    // Typing animation state
    private _typingTimer: ReturnType<typeof setTimeout> | null = null
    private _cursorEl: HTMLElement | null = null
    private _lineIndex = 0
    private _charIndex = 0

    static get observedAttributes(): string[] {
        return ['title', 'prompt', 'animate-typing', 'speed']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._applyMode()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        // Cancel the typing timer so a detached element does not leak it.
        this._clearTimer()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        // title/prompt change the markup; animate-typing/speed reset the timer —
        // a full re-render + mode re-application covers every observed attribute.
        this.render()
        this._applyMode()
    }

    // ── Properties ────────────────────────────────────────────────────────────

    // Note: `title` is a native HTMLElement reflected attribute — do NOT define a
    // getter/setter for it (it collides with the platform property). It is listed
    // in observedAttributes and read via getAttribute('title') in render().

    get lines(): TerminalLine[] {
        return this._lines
    }
    set lines(v: TerminalLine[]) {
        this._lines = Array.isArray(v) ? v : []
        if (this._initialised) {
            this.render()
            this._applyMode()
        }
    }

    get prompt(): string {
        return this.getAttribute('prompt') ?? '$'
    }
    set prompt(v: string) {
        this.setAttribute('prompt', v)
    }

    get animateTyping(): boolean {
        return this.hasAttribute('animate-typing')
    }
    set animateTyping(v: boolean) {
        if (v) this.setAttribute('animate-typing', '')
        else this.removeAttribute('animate-typing')
    }

    get speed(): number {
        const v = parseInt(this.getAttribute('speed') ?? '', 10)
        return Number.isFinite(v) && v > 0 ? v : DEFAULT_SPEED
    }
    set speed(v: number) {
        this.setAttribute('speed', String(v))
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    private render(): void {
        const title = this.getAttribute('title') ?? ''
        const prompt = this.prompt

        const dots =
            `<span class="tc-terminal-window-dots" aria-hidden="true">` +
            `<span class="tc-terminal-window-dot tc-terminal-window-dot--red"></span>` +
            `<span class="tc-terminal-window-dot tc-terminal-window-dot--amber"></span>` +
            `<span class="tc-terminal-window-dot tc-terminal-window-dot--green"></span>` +
            `</span>`
        const titleHtml = `<span class="tc-terminal-window-title" id="${this._titleId}">${esc(title)}</span>`
        const bar = `<div class="tc-terminal-window-bar">${dots}${titleHtml}</div>`

        const linesHtml = this._lines
            .map((line) => {
                const type: TerminalLineType =
                    line.type && TYPES.includes(line.type) ? line.type : 'output'
                const promptHtml =
                    type === 'command'
                        ? `<span class="tc-terminal-window-prompt" aria-hidden="true">${esc(prompt)}</span>`
                        : ''
                return (
                    `<div class="tc-terminal-window-line tc-terminal-window-line-${type}">` +
                    `${promptHtml}<span class="tc-terminal-window-text">${esc(line.text ?? '')}</span>` +
                    `</div>`
                )
            })
            .join('')
        const body = `<div class="tc-terminal-window-body" role="log" aria-live="polite">${linesHtml}</div>`

        // Expose the window title as the region's accessible label.
        const labelAttr = title ? ` role="group" aria-labelledby="${this._titleId}"` : ''
        this.innerHTML = `<div class="tc-terminal-window"${labelAttr}>${bar}${body}</div>`
    }

    // ── Typing animation ─────────────────────────────────────────────────────────

    private _prefersReducedMotion(): boolean {
        return (
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
    }

    /** Decide between instant render and per-character typing after every render. */
    private _applyMode(): void {
        this._clearTimer()
        this._detachCursor()

        if (!this.animateTyping || this._lines.length === 0) return

        if (this._prefersReducedMotion()) {
            // Reduced motion: full text is already rendered; show a static
            // (non-blinking, via SCSS) cursor on the last line.
            const lineEls = this._lineEls()
            this._placeCursor(lineEls[lineEls.length - 1] ?? null)
            return
        }

        this._startTyping()
    }

    private _lineEls(): HTMLElement[] {
        const body = this.querySelector('.tc-terminal-window-body')
        return body
            ? Array.from(body.querySelectorAll<HTMLElement>('.tc-terminal-window-line'))
            : []
    }

    private _startTyping(): void {
        const lineEls = this._lineEls()
        if (lineEls.length === 0) return

        // Mask: empty every text span, hide all but the first line.
        lineEls.forEach((el, idx) => {
            const textEl = el.querySelector('.tc-terminal-window-text')
            if (textEl) textEl.textContent = ''
            el.classList.toggle('tc-terminal-window-line--hidden', idx !== 0)
        })

        this._lineIndex = 0
        this._charIndex = 0
        this._placeCursor(lineEls[0])
        this._typingTimer = setTimeout(this._tick, this.speed)
    }

    private _tick = (): void => {
        const lineEls = this._lineEls()
        const line = this._lines[this._lineIndex]
        if (!line) {
            this._finishTyping()
            return
        }
        const fullText = line.text ?? ''
        const el = lineEls[this._lineIndex]
        const textEl = el?.querySelector('.tc-terminal-window-text')

        if (this._charIndex < fullText.length) {
            this._charIndex += 1
            if (textEl) textEl.textContent = fullText.slice(0, this._charIndex)
            this._typingTimer = setTimeout(this._tick, this.speed)
            return
        }

        // Current line complete — advance to the next.
        this._lineIndex += 1
        this._charIndex = 0
        if (this._lineIndex >= this._lines.length) {
            this._finishTyping()
            return
        }
        const nextEl = lineEls[this._lineIndex]
        if (nextEl) nextEl.classList.remove('tc-terminal-window-line--hidden')
        this._placeCursor(nextEl ?? null)
        this._typingTimer = setTimeout(this._tick, this.speed)
    }

    private _finishTyping(): void {
        this._clearTimer()
        this._detachCursor()
    }

    private _placeCursor(el: HTMLElement | null): void {
        if (!this._cursorEl) {
            this._cursorEl = document.createElement('span')
            this._cursorEl.className = 'tc-terminal-window-cursor'
            this._cursorEl.setAttribute('aria-hidden', 'true')
        }
        if (el) el.appendChild(this._cursorEl)
    }

    private _detachCursor(): void {
        if (this._cursorEl && this._cursorEl.parentNode) {
            this._cursorEl.parentNode.removeChild(this._cursorEl)
        }
    }

    private _clearTimer(): void {
        if (this._typingTimer !== null) {
            clearTimeout(this._typingTimer)
            this._typingTimer = null
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TerminalWindow
    }
}

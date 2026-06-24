import { esc } from './internal/esc'
const TAG_NAME = 'tc-skill-bar'

export interface SkillSlot {
    id: string
    name?: string
    icon?: string
    hotkey?: string
    cooldown?: number
    remaining?: number
    charges?: number
    disabled?: boolean
    selected?: boolean
}

export class SkillBar extends HTMLElement {
    private _initialised = false
    private _slots: SkillSlot[] = []

    /** Optional callback fired alongside the `tc-activate` CustomEvent. */
    onActivate: ((detail: { id: string }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['slot-size', 'gap']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'toolbar')
            if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Skill Bar')
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // --- Public API ---

    get slots(): SkillSlot[] {
        return this._slots.slice()
    }
    set slots(value: SkillSlot[]) {
        this._slots = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    get slotSize(): number {
        const raw = this.getAttribute('slot-size')
        if (raw == null) return 180
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 180 : parsed
    }
    set slotSize(value: number) {
        if (value > 0) this.setAttribute('slot-size', String(value))
        else this.removeAttribute('slot-size')
    }

    get gap(): string {
        return this.getAttribute('gap') ?? '0.5rem'
    }
    set gap(value: string) {
        if (value) this.setAttribute('gap', value)
        else this.removeAttribute('gap')
    }

    // --- Private helpers ---

    private _anchorFor(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof HTMLElement)) return null
        const anchor = target.closest<HTMLElement>('.tc-skill-bar__slot')
        if (!anchor || !this.contains(anchor)) return null
        return anchor
    }

    private _fire(id: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-activate', {
                bubbles: true,
                composed: true,
                detail: { id },
            }),
        )
        if (typeof this.onActivate === 'function') this.onActivate({ id })
    }

    private _onClick = (e: MouseEvent): void => {
        const anchor = this._anchorFor(e.target)
        if (!anchor || anchor.getAttribute('aria-disabled') === 'true') return
        this._fire(anchor.dataset.id ?? '')
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const anchor = this._anchorFor(e.target)
        if (!anchor || anchor.getAttribute('aria-disabled') === 'true') return
        e.preventDefault()
        this._fire(anchor.dataset.id ?? '')
    }

    private render(): void {
        this.style.setProperty('--bs-skill-bar-slot-size', `${this.slotSize}px`)
        this.style.setProperty('--bs-skill-bar-gap', this.gap)

        const slotsHTML = this._slots
            .map((slot, index) => {
                const label = slot.name || slot.id
                const cdPct =
                    slot.remaining != null && slot.cooldown && slot.cooldown > 0
                        ? Math.max(0, Math.min(1, slot.remaining / slot.cooldown))
                        : null
                const onCooldown = cdPct != null && cdPct > 0

                let cls = 'tc-skill-bar__slot'
                if (slot.selected) cls += ' tc-skill-bar__slot--selected'
                if (slot.disabled) cls += ' tc-skill-bar__slot--disabled'
                if (onCooldown) cls += ' tc-skill-bar__slot--on-cooldown'

                const cooldownStr = slot.cooldown ? `${slot.cooldown}s` : ''
                const costStr = slot.charges != null && slot.charges > 0 ? `${slot.charges}x` : ''

                const cdLabel = onCooldown ? String(Math.ceil(slot.remaining!)) : ''
                const cdOverlay = onCooldown
                    ? `<div class="tc-skill-bar__cd" aria-hidden="true">` +
                      `<div class="tc-skill-bar__cd-bar" style="--cd-pct: ${cdPct}"></div>` +
                      `<span class="tc-skill-bar__cd-label">${esc(cdLabel)}</span>` +
                      `</div>`
                    : ''

                return (
                    `<div` +
                    ` class="${cls}"` +
                    ` data-index="${index}"` +
                    ` data-id="${esc(slot.id)}"` +
                    ` role="button"` +
                    ` tabindex="${slot.disabled ? '-1' : '0'}"` +
                    ` aria-label="${esc(label)}"` +
                    ` aria-pressed="${slot.selected ? 'true' : 'false'}"` +
                    ` aria-disabled="${slot.disabled ? 'true' : 'false'}"` +
                    `>` +
                    `<tc-ability-card` +
                    ` ability-name="${esc(label)}"` +
                    (slot.icon ? ` icon="${esc(slot.icon)}"` : '') +
                    (slot.hotkey ? ` keybind="${esc(slot.hotkey)}"` : '') +
                    (cooldownStr ? ` cooldown="${esc(cooldownStr)}"` : '') +
                    (costStr ? ` cost="${esc(costStr)}"` : '') +
                    `></tc-ability-card>` +
                    cdOverlay +
                    `</div>`
                )
            })
            .join('')

        this.innerHTML = `<div class="tc-skill-bar__row">${slotsHTML}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SkillBar
    }
}

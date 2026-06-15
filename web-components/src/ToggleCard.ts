import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-toggle-card'

let _idCounter = 0

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// kebab-case (or a "bi-"-prefixed name, for React-prop parity) → PascalCase
// lookup in lucide-static, wrapped in icon() so CSS owns sizing.
function lucideByName(name: string): string {
    const pascal = name
        .replace(/^bi-/, '')
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

export class ToggleCard extends HTMLElement {

    private _initialised = false
    private _hintId: string

    /** Optional callback fired alongside the tc-change event. */
    onChange: ((checked: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return ['checked', 'name', 'value', 'label', 'hint', 'icon', 'badge', 'disabled', 'loading']
    }

    constructor() {
        super()
        this._hintId = `tc-toggle-card-hint-${++_idCounter}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.addEventListener('click', this._onClick)
            this.addEventListener('keydown', this._onKeydown)
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get checked(): boolean {
        return this.hasAttribute('checked')
    }
    set checked(v: boolean) {
        if (v) this.setAttribute('checked', '')
        else this.removeAttribute('checked')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get hint(): string | null {
        return this.getAttribute('hint')
    }
    set hint(v: string | null) {
        if (v != null) this.setAttribute('hint', v)
        else this.removeAttribute('hint')
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get badge(): string | null {
        return this.getAttribute('badge')
    }
    set badge(v: string | null) {
        if (v != null) this.setAttribute('badge', v)
        else this.removeAttribute('badge')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get value(): string {
        return this.getAttribute('value') ?? 'on'
    }
    set value(v: string) {
        this.setAttribute('value', v)
    }

    private _onClick = (): void => {
        this._toggle()
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (this.disabled || this.loading) return
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            this._toggle()
        }
    }

    private _toggle(): void {
        if (this.disabled || this.loading) return
        const next = !this.checked
        this.checked = next
        this.dispatchEvent(new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            detail: { checked: next },
        }))
        if (typeof this.onChange === 'function') this.onChange(next)
    }

    private render(): void {
        const checked = this.checked
        const disabled = this.disabled
        const loading = this.loading
        const label = this.label ?? ''
        const hint = this.hint
        const iconName = this.icon
        const badge = this.badge
        const name = this.name
        const value = this.value

        // Host carries the switch role + the click/keyboard affordance.
        this.classList.add('tc-toggle-card')
        this.classList.toggle('tc-toggle-card--on', checked && !loading)
        this.classList.toggle('tc-toggle-card--disabled', disabled)
        this.classList.toggle('tc-toggle-card--loading', loading)

        this.setAttribute('role', 'switch')
        this.setAttribute('aria-checked', checked ? 'true' : 'false')
        if (label) this.setAttribute('aria-label', label)
        else this.removeAttribute('aria-label')

        // Disabled / loading remove the element from the tab order and block hits.
        if (disabled || loading) this.setAttribute('tabindex', '-1')
        else this.setAttribute('tabindex', '0')

        if (disabled) this.setAttribute('aria-disabled', 'true')
        else this.removeAttribute('aria-disabled')

        if (loading) this.setAttribute('aria-busy', 'true')
        else this.removeAttribute('aria-busy')

        const hasHint = hint != null && hint !== ''
        if (hasHint) this.setAttribute('aria-describedby', this._hintId)
        else this.removeAttribute('aria-describedby')

        // Leading icon — decorative.
        const iconHtml = iconName
            ? `<span class="tc-toggle-card-icon" aria-hidden="true">${lucideByName(iconName)}</span>`
            : ''

        // Body — label, optional hint, optional badge.
        const labelHtml = `<span class="tc-toggle-card-label">${esc(label)}</span>`
        const hintHtml = hasHint
            ? `<span class="tc-toggle-card-hint" id="${this._hintId}">${esc(hint as string)}</span>`
            : ''
        const badgeHtml = badge != null && badge !== ''
            ? `<span class="tc-toggle-card-badge">${esc(badge)}</span>`
            : ''
        const bodyHtml = [
            `<span class="tc-toggle-card-body">`,
            labelHtml,
            hintHtml,
            badgeHtml,
            `</span>`,
        ].join('')

        // Trailing control — spinner while loading, otherwise the switch motif.
        const controlHtml = loading
            ? `<span class="spinner-border spinner-border-sm tc-toggle-card-spinner" role="status" aria-hidden="true"></span>`
            : `<span class="tc-toggle-card-switch" aria-hidden="true"><span class="tc-toggle-card-knob"></span></span>`

        // Native checkbox semantics: present in form data only while checked.
        const hiddenInput = name && checked && !loading
            ? `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`
            : ''

        this.innerHTML = [hiddenInput, iconHtml, bodyHtml, controlHtml].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ToggleCard
    }
}

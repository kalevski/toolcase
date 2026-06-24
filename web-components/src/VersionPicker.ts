import { esc } from './internal/esc'
import { Tag } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-version-picker'

export type VersionPickerVariant = 'segmented' | 'dropdown'
const VARIANTS: VersionPickerVariant[] = ['segmented', 'dropdown']

export interface VersionOption {
    label: string
    value: string
    latest?: boolean
    lts?: boolean
    deprecated?: boolean
}

const tagIconHtml = icon(Tag, 'tc-version-picker__label-icon')

export class VersionPicker extends HTMLElement {
    private _initialised = false
    private _versions: VersionOption[] = []

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'name', 'variant']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback
        // removes them, and a move/remount (React reconciliation) disconnects
        // then reconnects without re-running the one-time init above. Adding the
        // same handler reference twice is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
        this.addEventListener('change', this._onNativeChange)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('change', this._onNativeChange)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            // Surgical patch — keeps button focus intact during arrow-key navigation
            this._patchSelection()
            return
        }
        this.render()
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get variant(): VersionPickerVariant {
        const v = this.getAttribute('variant') as VersionPickerVariant
        return VARIANTS.includes(v) ? v : 'segmented'
    }
    set variant(v: VersionPickerVariant) {
        this.setAttribute('variant', v)
    }

    get versions(): VersionOption[] {
        return this._versions
    }
    set versions(v: VersionOption[]) {
        this._versions = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    /** Resolve the effective selected value: the matching option, else the first option. */
    private _currentValue(): string {
        const v = this.value
        if (this._versions.some((o) => o.value === v)) return v
        return this._versions[0]?.value ?? ''
    }

    private _emit(value: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    private _select(value: string, focusButton: boolean): void {
        if (!this._versions.some((o) => o.value === value)) return
        if (value === this._currentValue()) return
        // Triggers attributeChangedCallback('value') → _patchSelection (surgical)
        this.setAttribute('value', value)
        if (focusButton) {
            const btn = this.querySelector<HTMLButtonElement>(
                `.tc-version-picker__option[data-value="${CSS.escape(value)}"]`,
            )
            if (btn) btn.focus()
        }
        this._emit(value)
    }

    private _patchSelection(): void {
        const current = this._currentValue()

        const buttons = Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-version-picker__option'),
        )
        if (buttons.length > 0) {
            for (const btn of buttons) {
                const active = btn.dataset.value === current
                btn.classList.toggle('tc-version-picker__option--active', active)
                btn.setAttribute('aria-pressed', String(active))
                btn.setAttribute('tabindex', active ? '0' : '-1')
            }
            const hidden = this.querySelector<HTMLInputElement>('input[type="hidden"]')
            if (hidden) hidden.value = current
        }

        const select = this.querySelector<HTMLSelectElement>('select')
        if (select && select.value !== current) select.value = current
    }

    private _onClick = (e: MouseEvent): void => {
        if (this.variant !== 'segmented') return
        const target = e.target as HTMLElement
        const btn = target.closest<HTMLButtonElement>('.tc-version-picker__option')
        if (!btn || !this.contains(btn)) return
        const value = btn.dataset.value
        if (value != null) this._select(value, false)
    }

    private _onNativeChange = (e: Event): void => {
        if (this.variant !== 'dropdown') return
        const select = e.target as HTMLSelectElement
        if (select.tagName !== 'SELECT') return
        this._select(select.value, false)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (this.variant !== 'segmented') return
        const target = e.target as HTMLElement
        if (!target.classList.contains('tc-version-picker__option')) return
        if (this._versions.length === 0) return

        const key = e.key
        const isPrev = key === 'ArrowLeft' || key === 'ArrowUp'
        const isNext = key === 'ArrowRight' || key === 'ArrowDown'
        if (!isPrev && !isNext && key !== 'Home' && key !== 'End') return

        e.preventDefault()

        const len = this._versions.length
        const currentIdx = this._versions.findIndex((o) => o.value === this._currentValue())
        let nextIdx: number
        if (key === 'Home') nextIdx = 0
        else if (key === 'End') nextIdx = len - 1
        else if (isNext) nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % len
        else nextIdx = currentIdx <= 0 ? len - 1 : currentIdx - 1

        const next = this._versions[nextIdx]
        if (next) this._select(next.value, true)
    }

    private render(): void {
        const variant = this.variant
        const current = this._currentValue()
        const name = this.name

        if (variant === 'dropdown') {
            const optionsHtml = this._versions
                .map((v) => {
                    const ann = [
                        v.latest ? ' (latest)' : '',
                        v.lts ? ' (LTS)' : '',
                        v.deprecated ? ' (deprecated)' : '',
                    ].join('')
                    const selected = v.value === current ? ' selected' : ''
                    return `<option value="${esc(v.value)}"${selected}>${esc(v.label)}${ann}</option>`
                })
                .join('')

            const nameAttr = name != null ? ` name="${esc(name)}"` : ''

            this.innerHTML = [
                `<div class="tc-version-picker tc-version-picker--dropdown">`,
                `<label class="tc-version-picker__label">`,
                tagIconHtml,
                `<span class="tc-version-picker__label-text">Version</span>`,
                `<select class="form-select tc-version-picker__select"${nameAttr}>`,
                optionsHtml,
                `</select>`,
                `</label>`,
                `</div>`,
            ].join('')
            return
        }

        // segmented
        const hiddenHtml =
            name != null ? `<input type="hidden" name="${esc(name)}" value="${esc(current)}">` : ''

        const buttonsHtml = this._versions
            .map((v) => {
                const active = v.value === current
                const classes = [
                    'tc-version-picker__option',
                    active ? 'tc-version-picker__option--active' : '',
                    v.deprecated ? 'tc-version-picker__option--deprecated' : '',
                ]
                    .filter(Boolean)
                    .join(' ')

                const tags = [
                    v.latest
                        ? `<span class="tc-version-picker__tag tc-version-picker__tag--latest">latest</span>`
                        : '',
                    v.lts
                        ? `<span class="tc-version-picker__tag tc-version-picker__tag--lts">LTS</span>`
                        : '',
                    v.deprecated
                        ? `<span class="tc-version-picker__tag tc-version-picker__tag--deprecated">old</span>`
                        : '',
                ].join('')

                return [
                    `<button type="button" class="${classes}"`,
                    ` data-value="${esc(v.value)}" aria-pressed="${active}"`,
                    ` tabindex="${active ? '0' : '-1'}">`,
                    `<span class="tc-version-picker__option-label">${esc(v.label)}</span>`,
                    tags,
                    `</button>`,
                ].join('')
            })
            .join('')

        this.innerHTML = [
            `<div class="tc-version-picker tc-version-picker--segmented" role="group" aria-label="Version">`,
            hiddenHtml,
            buttonsHtml,
            `</div>`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VersionPicker
    }
}

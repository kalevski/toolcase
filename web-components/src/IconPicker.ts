import * as LucideIcons from 'lucide-static'
import { icon, chevronDownIcon } from './icons'

const TAG_NAME = 'tc-icon-picker'

export interface IconOption {
    value: string
    label?: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

export class IconPicker extends HTMLElement {
    private _initialised = false
    private _icons: IconOption[] = []
    private _isOpen = false
    private _highlightIdx = -1
    private _searchValue = ''
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _keydownHandler: ((e: KeyboardEvent) => void) | null = null

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'value', 'columns', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._removeDocListeners()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        if (this._isOpen) this._forceClose()
        this.render()
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get icons(): IconOption[] {
        return this._icons
    }
    set icons(v: IconOption[]) {
        this._icons = Array.isArray(v) ? v : []
        if (this._initialised) {
            if (this._isOpen) this._forceClose()
            this.render()
        }
    }

    get value(): string | null {
        return this.getAttribute('value')
    }
    set value(v: string | null) {
        if (v != null) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get columns(): number {
        return parseInt(this.getAttribute('columns') ?? '6', 10) || 6
    }
    set columns(v: number) {
        this.setAttribute('columns', String(v))
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    private _getTrigger(): HTMLButtonElement | null {
        return this.querySelector('.tc-icon-picker-trigger')
    }

    private _getPopup(): HTMLElement | null {
        return this.querySelector('.tc-icon-picker-popup')
    }

    private _getSearchInput(): HTMLInputElement | null {
        return this.querySelector<HTMLInputElement>('.tc-icon-picker-search')
    }

    private _getOptions(): HTMLButtonElement[] {
        return Array.from(this.querySelectorAll<HTMLButtonElement>('.tc-icon-picker-option'))
    }

    private _getFilteredIcons(): IconOption[] {
        const q = this._searchValue.trim().toLowerCase()
        if (!q) return this._icons
        return this._icons.filter(o =>
            o.value.toLowerCase().includes(q) ||
            (o.label ?? '').toLowerCase().includes(q)
        )
    }

    private _forceClose(): void {
        this._isOpen = false
        this._searchValue = ''
        this._highlightIdx = -1
        this._removeDocListeners()
    }

    private _openPopup(): void {
        if (this._isOpen) return
        this._isOpen = true
        const trigger = this._getTrigger()
        const popup = this._getPopup()
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (popup) popup.classList.add('show')

        const searchInput = this._getSearchInput()
        if (searchInput) searchInput.focus()

        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closePopup(false)
        }
        this._keydownHandler = (e: KeyboardEvent) => this._onKeydown(e)
        document.addEventListener('mousedown', this._outsideHandler)
        document.addEventListener('keydown', this._keydownHandler)
    }

    private _closePopup(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false
        this._searchValue = ''
        this._highlightIdx = -1
        const trigger = this._getTrigger()
        const popup = this._getPopup()
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (popup) popup.classList.remove('show')
        this._removeDocListeners()
        if (refocus) trigger?.focus()
    }

    private _removeDocListeners(): void {
        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler)
            this._keydownHandler = null
        }
    }

    private _selectIcon(value: string): void {
        this._closePopup(false)
        this.setAttribute('value', value)
        this.dispatchEvent(new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            detail: { value },
        }))
        if (typeof this.onChange === 'function') this.onChange(value)
        this._getTrigger()?.focus()
    }

    private _setHighlight(idx: number): void {
        const options = this._getOptions()
        options.forEach((o, i) => {
            o.classList.toggle('tc-icon-picker-option--highlighted', i === idx)
        })
        if (options[idx]) options[idx].scrollIntoView({ block: 'nearest' })
    }

    private _onKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            e.preventDefault()
            this._closePopup()
            return
        }
        if (e.key === 'Tab') {
            this._closePopup(false)
            return
        }

        const filtered = this._getFilteredIcons()
        const cols = this.columns

        if (e.key === 'ArrowRight') {
            e.preventDefault()
            this._highlightIdx = this._highlightIdx < 0
                ? 0
                : Math.min(this._highlightIdx + 1, filtered.length - 1)
            this._setHighlight(this._highlightIdx)
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            if (this._highlightIdx > 0) {
                this._highlightIdx--
                this._setHighlight(this._highlightIdx)
            } else if (this._highlightIdx < 0) {
                this._highlightIdx = 0
                this._setHighlight(this._highlightIdx)
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            this._highlightIdx = this._highlightIdx < 0
                ? 0
                : Math.min(this._highlightIdx + cols, filtered.length - 1)
            this._setHighlight(this._highlightIdx)
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (this._highlightIdx > 0) {
                this._highlightIdx = Math.max(this._highlightIdx - cols, 0)
                this._setHighlight(this._highlightIdx)
            }
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (this._highlightIdx >= 0 && this._highlightIdx < filtered.length) {
                this._selectIcon(filtered[this._highlightIdx].value)
            }
        }
    }

    private _renderSkeletonPopup(): string {
        const cols = this.columns
        const count = cols * 3
        const cells = Array.from({ length: count }).map(() =>
            `<div class="tc-icon-picker-skeleton-cell" aria-hidden="true"></div>`
        ).join('')
        return `<div class="tc-icon-picker-popup" role="status" aria-busy="true" aria-label="Loading icons"><div class="tc-icon-picker-grid tc-icon-picker-grid--loading" style="grid-template-columns:repeat(${cols},1fr);">${cells}</div><span class="visually-hidden">Loading…</span></div>`
    }

    private _renderGridContent(filtered: IconOption[]): string {
        if (filtered.length === 0) {
            return `<p class="tc-icon-picker-empty">No icons found</p>`
        }
        const cols = this.columns
        const currentValue = this.value ?? ''
        const options = filtered.map((o, i) => {
            const isSelected = o.value === currentValue
            const isHighlighted = i === this._highlightIdx
            const iconHtml = lucideByName(o.value)
            const title = o.label ?? o.value
            let cls = 'tc-icon-picker-option'
            if (isSelected) cls += ' tc-icon-picker-option--selected'
            if (isHighlighted) cls += ' tc-icon-picker-option--highlighted'
            return `<button class="${cls}" type="button" role="option" aria-selected="${isSelected}" tabindex="-1" title="${esc(title)}" data-value="${esc(o.value)}">${iconHtml}</button>`
        }).join('')
        return `<div class="tc-icon-picker-grid" style="grid-template-columns:repeat(${cols},1fr);">${options}</div>`
    }

    private render(): void {
        const labelText = this.getAttribute('label')
        const currentValue = this.value ?? ''
        const loading = this.loading

        const labelHtml = labelText
            ? `<label class="tc-icon-picker-label">${esc(labelText)}</label>`
            : ''

        const selectedIconHtml = currentValue ? lucideByName(currentValue) : ''
        const expanded = this._isOpen ? 'true' : 'false'
        const triggerInner = `<span class="tc-icon-picker-trigger-icon" aria-hidden="true">${selectedIconHtml}</span><span class="tc-icon-picker-trigger-chevron" aria-hidden="true">${chevronDownIcon}</span>`

        let popupHtml: string
        if (loading) {
            popupHtml = this._renderSkeletonPopup()
        } else {
            const filtered = this._getFilteredIcons()
            const searchHtml = `<input class="tc-icon-picker-search" type="search" placeholder="Search icons…" value="${esc(this._searchValue)}" autocomplete="off" />`
            const gridContent = this._renderGridContent(filtered)
            popupHtml = `<div class="tc-icon-picker-popup" role="listbox" aria-label="Icons">${searchHtml}<div class="tc-icon-picker-options">${gridContent}</div></div>`
        }

        this.innerHTML = `${labelHtml}<button class="tc-icon-picker-trigger" type="button" aria-haspopup="listbox" aria-expanded="${expanded}">${triggerInner}</button>${popupHtml}`

        if (this._isOpen) {
            const popup = this._getPopup()
            if (popup) popup.classList.add('show')
        }

        const trigger = this._getTrigger()
        if (trigger) {
            trigger.addEventListener('click', () => {
                if (this._isOpen) this._closePopup(false)
                else this._openPopup()
            })
        }

        if (!loading) {
            const optionsEl = this.querySelector<HTMLElement>('.tc-icon-picker-options')
            if (optionsEl) {
                optionsEl.addEventListener('click', (e: Event) => {
                    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tc-icon-picker-option')
                    if (btn) {
                        const val = btn.dataset.value ?? ''
                        if (val) this._selectIcon(val)
                    }
                })
            }

            const searchInput = this._getSearchInput()
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    this._searchValue = searchInput.value
                    this._highlightIdx = -1
                    const el = this.querySelector<HTMLElement>('.tc-icon-picker-options')
                    if (el) el.innerHTML = this._renderGridContent(this._getFilteredIcons())
                })
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: IconPicker
    }
}

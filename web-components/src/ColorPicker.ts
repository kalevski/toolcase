import { Check } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-color-picker'

let _cpIdCounter = 0

export interface ColorOption {
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

function normalizeColor(c: string | ColorOption): ColorOption {
    if (typeof c === 'string') return { value: c }
    return c
}

function isValidHex(hex: string): boolean {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim())
}

const checkIconHtml = icon(Check)

export class ColorPicker extends HTMLElement {
    private _initialised = false
    private _colors: ColorOption[] = []
    private _isOpen = false
    private _hexInputId: string
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _keydownHandler: ((e: KeyboardEvent) => void) | null = null

    onChange: ((color: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'value', 'columns', 'loading', 'disabled']
    }

    constructor() {
        super()
        this._hexInputId = `tc-cp-hex-${++_cpIdCounter}`
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
        if (this._isOpen) {
            this._forceClose()
        }
        this.render()
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get colors(): ColorOption[] {
        return this._colors
    }
    set colors(v: Array<ColorOption | string>) {
        this._colors = Array.isArray(v) ? v.map(normalizeColor) : []
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
        return parseInt(this.getAttribute('columns') ?? '8', 10) || 8
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

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private _getTrigger(): HTMLButtonElement | null {
        return this.querySelector('.tc-color-picker-trigger')
    }

    private _getPanel(): HTMLElement | null {
        return this.querySelector('.tc-color-picker-panel')
    }

    private _getSwatches(): HTMLButtonElement[] {
        return Array.from(this.querySelectorAll<HTMLButtonElement>('.tc-color-picker-swatch:not([disabled])'))
    }

    private _forceClose(): void {
        this._isOpen = false
        this._removeDocListeners()
    }

    private _openPanel(): void {
        if (this._isOpen || this.disabled) return
        this._isOpen = true
        const trigger = this._getTrigger()
        const panel = this._getPanel()
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (panel) panel.classList.add('show')

        const swatches = this._getSwatches()
        const currentValue = this.value ?? ''
        const selected = swatches.find(s => s.dataset.value === currentValue)
        if (selected) selected.focus()
        else if (swatches.length > 0) swatches[0].focus()

        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closePanel(false)
        }
        this._keydownHandler = (e: KeyboardEvent) => this._onPanelKeydown(e)
        document.addEventListener('mousedown', this._outsideHandler)
        document.addEventListener('keydown', this._keydownHandler)
    }

    private _closePanel(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false
        const trigger = this._getTrigger()
        const panel = this._getPanel()
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (panel) panel.classList.remove('show')
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

    private _selectColor(color: string): void {
        // Close the panel first (sets _isOpen = false, cleans up listeners).
        // Then set value attribute — attributeChangedCallback fires and calls
        // render() with _isOpen already false, so the fresh DOM is consistent.
        this._closePanel(false)
        this.setAttribute('value', color)
        this.dispatchEvent(new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            detail: { value: color },
        }))
        if (typeof this.onChange === 'function') this.onChange(color)
        // Restore focus to trigger after the re-render caused by setAttribute.
        this._getTrigger()?.focus()
    }

    private _onPanelKeydown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            e.preventDefault()
            this._closePanel()
            return
        }

        const swatches = this._getSwatches()
        if (swatches.length === 0) return

        const focused = document.activeElement as HTMLElement
        const currentIdx = swatches.indexOf(focused as HTMLButtonElement)
        const cols = this.columns

        if (e.key === 'ArrowRight') {
            e.preventDefault()
            swatches[(currentIdx + 1) % swatches.length].focus()
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            swatches[(currentIdx - 1 + swatches.length) % swatches.length].focus()
        } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            const next = currentIdx + cols
            swatches[Math.min(next, swatches.length - 1)].focus()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const prev = currentIdx - cols
            swatches[Math.max(prev, 0)].focus()
        } else if (e.key === 'Enter') {
            e.preventDefault()
            if (currentIdx >= 0) {
                const color = swatches[currentIdx].dataset.value ?? ''
                if (color) this._selectColor(color)
            }
        } else if (e.key === 'Tab') {
            this._closePanel(false)
        }
    }

    private _renderSkeleton(): string {
        const cols = this.columns
        const count = cols * 3
        const items = Array.from({ length: count }).map(() =>
            `<div class="tc-color-picker-swatch-skeleton"></div>`
        ).join('')
        return `<div class="tc-color-picker-grid tc-color-picker-grid--loading" style="grid-template-columns:repeat(${cols},1fr);">${items}</div>`
    }

    private _renderGrid(): string {
        const cols = this.columns
        const currentValue = this.value ?? ''
        const disabled = this.disabled

        const swatches = this._colors.map(c => {
            const isSelected = c.value === currentValue
            const disabledAttr = disabled ? ' disabled aria-disabled="true"' : ''
            const ariaSelected = isSelected ? ' aria-selected="true"' : ' aria-selected="false"'
            const label = c.label ?? c.value
            return `<button class="tc-color-picker-swatch${isSelected ? ' tc-color-picker-swatch--selected' : ''}" type="button" role="option"${ariaSelected}${disabledAttr} data-value="${esc(c.value)}" aria-label="${esc(label)}" style="background:${esc(c.value)};" tabindex="-1">${isSelected ? `<span class="tc-color-picker-check" aria-hidden="true">${checkIconHtml}</span>` : ''}</button>`
        }).join('')

        return `<div class="tc-color-picker-grid" role="listbox" aria-label="Color swatches" style="grid-template-columns:repeat(${cols},1fr);">${swatches}</div>`
    }

    private render(): void {
        const labelText = this.getAttribute('label')
        const currentValue = this.value ?? ''
        const disabled = this.disabled
        const loading = this.loading
        const disabledAttr = disabled ? ' disabled aria-disabled="true"' : ''

        const chipStyle = currentValue ? ` style="background:${esc(currentValue)};"` : ''
        const triggerText = currentValue ? esc(currentValue) : 'Select color'

        const labelHtml = labelText
            ? `<label class="tc-color-picker-label form-label" for="tc-cp-trigger-${this._hexInputId}">${esc(labelText)}</label>`
            : ''

        const hexValue = currentValue ? esc(currentValue) : ''
        const gridHtml = loading ? this._renderSkeleton() : this._renderGrid()

        this.innerHTML = `${labelHtml}<button class="tc-color-picker-trigger" id="tc-cp-trigger-${this._hexInputId}" type="button" aria-haspopup="listbox" aria-expanded="false"${disabledAttr}><span class="tc-color-picker-chip" aria-hidden="true"${chipStyle}></span><span class="tc-color-picker-hex-text">${triggerText}</span></button><div class="tc-color-picker-panel" role="dialog" aria-label="Color picker" aria-modal="false">${gridHtml}<div class="tc-color-picker-footer"><label class="visually-hidden" for="${this._hexInputId}">Hex color value</label><input class="tc-color-picker-hex form-control" id="${this._hexInputId}" type="text" placeholder="#000000" value="${hexValue}" spellcheck="false" autocomplete="off"${disabled ? ' disabled' : ''} /></div></div>`

        const trigger = this._getTrigger()
        if (trigger) {
            trigger.addEventListener('click', () => {
                if (this._isOpen) this._closePanel(false)
                else this._openPanel()
            })
        }

        const grid = this.querySelector('.tc-color-picker-grid')
        if (grid && !loading) {
            grid.addEventListener('click', (e: Event) => {
                const swatch = (e.target as HTMLElement).closest<HTMLButtonElement>('.tc-color-picker-swatch')
                if (swatch && !swatch.disabled) {
                    const color = swatch.dataset.value ?? ''
                    if (color) this._selectColor(color)
                }
            })
        }

        const hexInput = this.querySelector<HTMLInputElement>('.tc-color-picker-hex')
        if (hexInput) {
            hexInput.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    const val = hexInput.value.trim()
                    if (isValidHex(val)) {
                        this._selectColor(val)
                    }
                }
            })
            hexInput.addEventListener('blur', () => {
                if (!hexInput.isConnected) return
                const val = hexInput.value.trim()
                if (isValidHex(val) && val !== (this.value ?? '')) {
                    this._selectColor(val)
                }
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ColorPicker
    }
}

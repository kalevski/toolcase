import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-helper-text'

export type HelperTextVariant = 'default' | 'success' | 'warning' | 'error'

const VARIANTS: HelperTextVariant[] = ['default', 'success', 'warning', 'error']

const VARIANT_ICONS: Record<HelperTextVariant, string> = {
    default: 'Info',
    success: 'CheckCircle',
    warning: 'AlertTriangle',
    error: 'AlertCircle',
}

function resolveIcon(name: string): string {
    const svgStr = (LucideIcons as Record<string, string>)[name]
    if (!svgStr) return ''
    return icon(svgStr)
}

export class HelperText extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['text', 'variant', 'icon', 'class-name', 'id']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            if (!this.hasAttribute('text')) {
                const inner = this.querySelector('.tc-helper-text-content')
                if (inner) slotContent.forEach((n) => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-helper-text-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        if (!this.hasAttribute('text')) {
            const newInner = this.querySelector('.tc-helper-text-content')
            if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
        }
    }

    get variant(): HelperTextVariant {
        const v = this.getAttribute('variant') as HelperTextVariant
        return VARIANTS.includes(v) ? v : 'default'
    }
    set variant(v: HelperTextVariant) {
        this.setAttribute('variant', v)
    }

    get text(): string | null {
        return this.getAttribute('text')
    }
    set text(v: string | null) {
        if (v != null) this.setAttribute('text', v)
        else this.removeAttribute('text')
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    // Named extraClass to avoid shadowing native HTMLElement.className.
    get extraClass(): string {
        return this.getAttribute('class-name') ?? ''
    }
    set extraClass(v: string) {
        if (v) this.setAttribute('class-name', v)
        else this.removeAttribute('class-name')
    }

    private render(): void {
        const variant = this.variant
        const text = this.getAttribute('text')
        const iconAttr = this.getAttribute('icon')
        const iconName = iconAttr ?? VARIANT_ICONS[variant]
        const extraClass = this.getAttribute('class-name')
        const id = this.getAttribute('id')

        const iconHtml = resolveIcon(iconName)
        const classes = ['tc-helper-text', `tc-helper-text--${variant}`, extraClass]
            .filter(Boolean)
            .join(' ')
        const idAttr = id ? ` id="${id}"` : ''
        const content =
            text != null
                ? `<span class="tc-helper-text-content">${text}</span>`
                : `<span class="tc-helper-text-content"></span>`

        this.innerHTML = `<div class="${classes}"${idAttr}>${iconHtml}${content}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: HelperText
    }
}

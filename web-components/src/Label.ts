import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { setHostClass } from './internal/host-class'
import { setAttr, syncTrailingNodes } from './internal/tc-element'

const TAG_NAME = 'tc-label'

export type LabelSize = 'small' | 'default' | 'large'

const SIZES: LabelSize[] = ['small', 'default', 'large']

const infoIcon = icon((LucideIcons as Record<string, string>)['Info'] ?? '')

let _idCounter = 0

/**
 * tc-label — form label with a required indicator and an info-icon tooltip.
 *
 * THE HOST IS THE LABEL. It renders no wrapper and never moves your children.
 * Before 5.1 it rendered `<label class="form-label tc-label"><span
 * class="tc-label-content">` and re-appended the consumer's nodes inside, so
 * react-dom threw `NotFoundError` from `parentInstance.removeChild(child)` when it
 * removed one of them individually. At 44 call sites in one consuming app — and a
 * label's text is routinely `{t.field}{required ? ' *' : ''}` — that is not a
 * hypothetical.
 *
 * A custom element cannot be a `<label>`, so the two things a real `<label for>`
 * gives you are provided explicitly:
 *
 *   - **Click-to-focus.** A click anywhere on the label focuses the target, or
 *     toggles it when the target is a checkbox or radio.
 *   - **The accessible name.** The host gets an id and the target gets
 *     `aria-labelledby` pointing at it, which is what a screen reader reads.
 *
 * The asterisk and the info button are the only nodes the element creates, and
 * both are APPENDED — they belong after the text either way.
 */
export class Label extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        // `class` is observed so the element can re-assert its own classes after
        // react-dom overwrites `className` wholesale — see setHostClass.
        return ['required', 'tooltip', 'size', 'for', 'class']
    }

    connectedCallback(): void {
        this._built = true
        this.addEventListener('click', this._onClick)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    get tooltip(): string | null {
        return this.getAttribute('tooltip')
    }
    set tooltip(v: string | null) {
        if (v != null) this.setAttribute('tooltip', v)
        else this.removeAttribute('tooltip')
    }

    get size(): LabelSize {
        const v = this.getAttribute('size') as LabelSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: LabelSize) {
        setAttr(this, 'size', v)
    }

    /** The id of the control this labels — the `<label for>` equivalent. */
    get htmlFor(): string | null {
        return this.getAttribute('for')
    }
    set htmlFor(v: string | null) {
        if (v != null) this.setAttribute('for', v)
        else this.removeAttribute('for')
    }

    private patch(): void {
        const size = this.size
        const sizeClass = size === 'small' ? ' tc-label-sm' : size === 'large' ? ' tc-label-lg' : ''
        setHostClass(this, `form-label tc-label${sizeClass}`)

        const tooltip = this.tooltip
        syncTrailingNodes(this, [
            {
                cls: 'tc-label-required',
                html: this.required ? '*' : null,
            },
            {
                cls: 'tc-label-info',
                tag: 'button',
                html: tooltip ? infoIcon : null,
            },
        ])

        const mark = this.querySelector(':scope > .tc-label-required')
        if (mark) mark.setAttribute('aria-hidden', 'true')

        const info = this.querySelector<HTMLButtonElement>(':scope > .tc-label-info')
        if (info && tooltip) {
            info.type = 'button'
            info.setAttribute('aria-label', tooltip)
            info.setAttribute('title', tooltip)
        }

        this._linkTarget()
    }

    /** Name the target control after this label. `<label for>` does it natively;
     *  a custom element has to say it with `aria-labelledby`. */
    private _linkTarget(): void {
        const target = this._target()
        if (!target) return
        if (!this.id) this.id = `tc-label-${++_idCounter}`
        const existing = target.getAttribute('aria-labelledby')
        if (existing !== this.id) target.setAttribute('aria-labelledby', this.id)
    }

    private _target(): HTMLElement | null {
        const forId = this.getAttribute('for')
        if (!forId) return null
        return this.ownerDocument?.getElementById(forId) ?? null
    }

    private _onClick = (event: MouseEvent): void => {
        // The info button is its own control; a click on it is not a click on the
        // label. Same for anything focusable the consumer put inside the label.
        const origin = event.target as Element | null
        if (origin?.closest('.tc-label-info, a, button, input, select, textarea')) return

        const target = this._target()
        if (!target) return
        const control = target.matches('input, select, textarea, button')
            ? target
            : target.querySelector<HTMLElement>('input, select, textarea, button')
        if (!control) return
        // A real `<label>` TOGGLES a checkbox or radio rather than only focusing it.
        if (
            control instanceof HTMLInputElement &&
            (control.type === 'checkbox' || control.type === 'radio')
        ) {
            control.click()
        } else {
            control.focus()
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Label
    }
}

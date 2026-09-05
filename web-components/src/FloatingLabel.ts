import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-floating-label'

// THE HOST IS THE BOX. `.form-floating` is a positioning context with two direct
// children — the control and the label docked over it — and every rule in
// style/components/_floating-label.scss is written as `> .form-control`,
// `> label`, `> .form-control:focus ~ label`. That is satisfied just as well by
// putting the class on the host as by creating a wrapper for it, and the wrapper
// cost the consumer's control: moving a node react-dom created makes the next
// `parentInstance.removeChild(child)` throw NotFoundError (rule 1), and building
// a fresh wrapper on every connect stacked another one on every React remount.
//
// So the control stays exactly where the consumer wrote it, and the element
// creates only the `<label>` — appended after the control, which is what the
// sibling combinator needs.
const CONTROL_SELECTOR =
    ':scope > input, :scope > select, :scope > textarea, :scope > .form-control, :scope > .form-select'

export class FloatingLabel extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        // `class` is observed so the element can re-assert its own classes after
        // react-dom overwrites `className` wholesale — see setHostClass.
        return ['label', 'for', 'class']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get htmlFor(): string | null {
        return this.getAttribute('for')
    }
    set htmlFor(v: string | null) {
        if (v != null) this.setAttribute('for', v)
        else this.removeAttribute('for')
    }

    /** The consumer's control, whatever they wrote it as. */
    private _control(): Element | null {
        return this.querySelector(CONTROL_SELECTOR)
    }

    private render(): void {
        // Bootstrap's float animation is driven by :placeholder-shown, so a control
        // with no placeholder of its own gets an empty one. Set on the consumer's
        // node, which is an attribute write and not a move.
        const control = this._control()
        if (control && !control.hasAttribute('placeholder')) {
            control.setAttribute('placeholder', ' ')
        }

        setHostClass(this, 'form-floating')

        const forAttr = this.getAttribute('for')
        const forHtml = forAttr ? ` for="${esc(forAttr)}"` : ''
        // `at: 'end'` — the label has to FOLLOW the control for
        // `> .form-control:focus ~ label` to reach it.
        patchHtml(this, `<label${forHtml}>${esc(this.label ?? '')}</label>`, { at: 'end' })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FloatingLabel
    }
}

import { setHostClass } from './internal/host-class'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-visually-hidden'

export type VisuallyHiddenAs = 'span' | 'div'

const AS_TAGS: VisuallyHiddenAs[] = ['span', 'div']

/**
 * tc-visually-hidden — THE HOST IS THE HIDDEN BOX.
 *
 * It used to render an inner `<span>`/`<div>` carrying `.visually-hidden` and move
 * the consumer's children into it. react-dom recorded `tc-visually-hidden` as the
 * parent of those children, so removing one threw NotFoundError. The utility class
 * now lands on the host and nothing is created or re-parented; `as` still selects
 * the layout the inner element used to provide, through `_reset.scss`.
 */
export class VisuallyHidden extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['as', 'class']
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected) return
        this.render()
    }

    get as(): VisuallyHiddenAs {
        const v = this.getAttribute('as') as VisuallyHiddenAs
        return AS_TAGS.includes(v) ? v : 'span'
    }
    set as(v: VisuallyHiddenAs) {
        setAttr(this, 'as', v)
    }

    private render(): void {
        setHostClass(this, 'visually-hidden')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VisuallyHidden
    }
}

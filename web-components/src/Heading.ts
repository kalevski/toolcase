import { setHostClass } from './internal/host-class'
import { SlotWrapBase } from './internal/slot-wrap'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-heading'

export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
const LEVELS: HeadingLevel[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

/**
 * tc-heading — a heading (`h1`–`h6`) with optional gradient ink fill. Built on the
 * shared {@link SlotWrapBase} slot-wrapping scaffold.
 */
export class Heading extends SlotWrapBase {
    static get observedAttributes(): string[] {
        return ['as', 'gradient']
    }

    get as(): HeadingLevel {
        const v = this.getAttribute('as') as HeadingLevel
        return LEVELS.includes(v) ? v : 'h2'
    }
    set as(v: HeadingLevel) {
        setAttr(this, 'as', v)
    }

    get gradient(): boolean {
        return this.hasAttribute('gradient')
    }
    set gradient(v: boolean) {
        if (v) this.setAttribute('gradient', '')
        else this.removeAttribute('gradient')
    }

    /** THE HOST IS THE HEADING: `as` becomes `role="heading"` + `aria-level` on the
     *  consumer's own tag rather than an `<h1>`–`<h6>` their children are moved
     *  into (rule 1). The `.tc-heading` styling is unchanged. */
    protected render(): void {
        const level = this.as
        const gradientClass = this.gradient ? ' tc-heading--gradient' : ''
        setHostClass(this, `tc-heading tc-heading--${level}${gradientClass}`)
        this.setAttribute('role', 'heading')
        this.setAttribute('aria-level', level.slice(1))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Heading
    }
}

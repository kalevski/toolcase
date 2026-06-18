import { SlotWrapBase } from './internal/slot-wrap'

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
        this.setAttribute('as', v)
    }

    get gradient(): boolean {
        return this.hasAttribute('gradient')
    }
    set gradient(v: boolean) {
        if (v) this.setAttribute('gradient', '')
        else this.removeAttribute('gradient')
    }

    protected getContentEl(): Element | null {
        return this.querySelector('.tc-heading-content')
    }

    protected render(): void {
        const level = this.as
        const gradientClass = this.gradient ? ' tc-heading--gradient' : ''
        this.innerHTML = `<${level} class="tc-heading${gradientClass}"><span class="tc-heading-content"></span></${level}>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Heading
    }
}

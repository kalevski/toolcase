import { setHostClass } from './internal/host-class'
const TAG_NAME = 'tc-lore-text'

// Flavour / lore body-copy block. THE HOST IS THE BLOCK: the class goes on the
// consumer's own tag, so their children are never re-parented into an
// element-owned wrapper (rule 1) and react-dom's `removeChild` keeps working.
export class LoreText extends HTMLElement {
    connectedCallback(): void {
        setHostClass(this, 'tc-lore-text')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LoreText
    }
}

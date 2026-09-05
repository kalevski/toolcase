import { setHostClass } from './internal/host-class'
const TAG_NAME = 'tc-eyebrow'

// Port of game-components `gc-eyebrow` — a small uppercase micro-label shown
// above a heading. The source is a pure default-slot component (no attributes,
// properties, or events), so this port keeps the same minimal surface and only
// swaps the fantasy chrome for the web-components design-system micro-label
// (JetBrains Mono, uppercase, slate-muted), styled via `_eyebrow.scss`.
//
// THE HOST IS THE LABEL. It used to render `<span class="tc-eyebrow">` around a
// content span and move the consumer's children inside it — which made react-dom,
// which recorded `tc-eyebrow` as the parent of those children, throw NotFoundError
// from `removeChild` the moment one of them was removed. The class now lands on
// the host itself (same class name, so the stylesheet did not move) and no node
// is created or moved at all.
export class Eyebrow extends HTMLElement {
    connectedCallback(): void {
        setHostClass(this, 'tc-eyebrow')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Eyebrow
    }
}

import { setHostClass } from './internal/host-class'
import { syncOwnedNodes } from './internal/tc-element'
import { esc } from './internal/esc'

// tc-editor-shell — the frame every tool-and-canvas surface has: a toolbar across
// the top, a tool rail down one side, the stage in the middle, an inspector down
// the other, and a status strip along the bottom.
//
// webgame.cloud and mindmap ship `EditorShell` (identical), and webgame.cloud's
// `ToolShell` + `ToolWorkspace` + `ToolControls` (500 lines between them) are the
// SAME shape under a different vocabulary — a parameter rail, a live preview and
// an output panel. One element covers both; two would have been the same layout
// twice with the regions renamed.
//
// EVERY REGION IS YOURS. This element draws no toolbar, no rail and no inspector
// — it draws the GRID they sit in and nothing else. That is what makes it usable
// by two apps that agree on the layout and on nothing else, and it is also why
// there is no re-parenting anywhere here: the regions are your own children,
// placed by `grid-area` off their `slot`.
//
// The one thing it owns is the inspector's collapse toggle, because whether the
// inspector is open is shell state (it changes the grid) rather than panel state.
//
// TWO SHELL ELEMENTS IN THIS LIBRARY, and they are not interchangeable:
//   tc-dashboard-layout  a NAVIGATION frame: sidebar of routes, topbar, content.
//   tc-editor-shell      this one. A WORKING frame: the middle is a stage that
//                        owns the pointer, and the panels around it act on what is
//                        in it. The rail is tools, not destinations.

const TAG_NAME = 'tc-editor-shell'

export class EditorShell extends HTMLElement {
    private _built = false

    static get observedAttributes(): string[] {
        return ['inspector-open', 'rail-open', 'inspector-label', 'compact', 'class']
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

    /** Default ON: an inspector that starts closed is a panel nobody finds. */
    get inspectorOpen(): boolean {
        return this.getAttribute('inspector-open') !== 'false'
    }
    set inspectorOpen(v: boolean) {
        this.setAttribute('inspector-open', v ? 'true' : 'false')
    }

    /** Default ON. The rail is how tools are reached, so it hides only on request. */
    get railOpen(): boolean {
        return this.getAttribute('rail-open') !== 'false'
    }
    set railOpen(v: boolean) {
        this.setAttribute('rail-open', v ? 'true' : 'false')
    }

    /** The toggle's accessible name. */
    get inspectorLabel(): string | null {
        return this.getAttribute('inspector-label')
    }
    set inspectorLabel(v: string | null) {
        if (v != null) this.setAttribute('inspector-label', v)
        else this.removeAttribute('inspector-label')
    }

    /** Stacks the regions into one column — the phone shape, where a three-column
     *  editor is three columns of nothing. */
    get compact(): boolean {
        return this.hasAttribute('compact')
    }
    set compact(v: boolean) {
        if (v) this.setAttribute('compact', '')
        else this.removeAttribute('compact')
    }

    private patch(): void {
        setHostClass(this, `tc-editor-shell${this.compact ? ' tc-editor-shell--compact' : ''}`)
        this.setAttribute('data-inspector', this.inspectorOpen ? 'open' : 'closed')
        this.setAttribute('data-rail', this.railOpen ? 'open' : 'closed')

        const label = this.inspectorLabel
        syncOwnedNodes(this, [
            {
                cls: 'tc-editor-shell__inspector-toggle',
                tag: 'button',
                // Only drawn when it can be named: a toggle with no accessible name
                // is a button a screen reader reads out as "button".
                html: label ? esc(label) : null,
            },
        ])
        const toggle = this.querySelector<HTMLButtonElement>(
            ':scope > .tc-editor-shell__inspector-toggle',
        )
        if (toggle) {
            toggle.type = 'button'
            toggle.setAttribute('aria-expanded', String(this.inspectorOpen))
        }
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        if (!origin?.closest('.tc-editor-shell__inspector-toggle')) return
        const next = !this.inspectorOpen
        this.inspectorOpen = next
        this.dispatchEvent(
            new CustomEvent('tc-inspector-toggle', {
                bubbles: true,
                composed: true,
                detail: { open: next },
            }),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EditorShell
    }
}

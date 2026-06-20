// Singleton registry that tracks the ordered stack of open overlays so only
// the topmost overlay reacts to Escape and owns focus-trapping.
// The token is the overlay's own identity (plugin instance or custom element).

const _stack: object[] = []

export const overlayStack = {
    push(overlay: object): void {
        if (!_stack.includes(overlay)) _stack.push(overlay)
    },
    pop(overlay: object): void {
        const idx = _stack.lastIndexOf(overlay)
        if (idx !== -1) _stack.splice(idx, 1)
    },
    top(): object | undefined {
        return _stack[_stack.length - 1]
    },
}

// Shared transition helpers for the internal plugin layer.
//
// The plugins re-implement the small slice of Bootstrap 5.3 JS behaviour the
// tc-* components rely on, without the bootstrap dependency. They keep the
// same DOM class protocol (.fade/.show/.collapsing…) and the same event names
// (show.bs.modal, hidden.bs.collapse, …) so component wrappers and the theme
// CSS keep working unchanged.

/** Force a reflow so a freshly-added class participates in the next transition. */
export function reflow(element: HTMLElement): void {
    void element.offsetHeight
}

function transitionDurationMs(element: HTMLElement): number {
    const styles = window.getComputedStyle(element)
    const maxOf = (v: string) =>
        v.split(',').reduce((m, p) => Math.max(m, parseFloat(p) || 0), 0)
    const duration = maxOf(styles.transitionDuration)
    const delay = maxOf(styles.transitionDelay)
    if (!duration && !delay) return 0
    return (duration + delay) * 1000
}

/**
 * Run a callback once the element's CSS transition finishes. Falls back to a
 * timer slightly longer than the computed duration so a missed transitionend
 * (e.g. display:none mid-flight, reduced-motion) never wedges a plugin.
 */
export function executeAfterTransition(
    element: HTMLElement,
    callback: () => void,
    animated = true,
): void {
    const duration = animated ? transitionDurationMs(element) : 0
    if (duration === 0) {
        callback()
        return
    }

    let done = false
    const handler = (event: Event): void => {
        if (event.target !== element) return
        finish()
    }
    const finish = (): void => {
        if (done) return
        done = true
        element.removeEventListener('transitionend', handler)
        callback()
    }
    element.addEventListener('transitionend', handler)
    window.setTimeout(finish, duration + 50)
}

/** Dispatch a Bootstrap-named event (e.g. "hide.bs.modal") with optional extra payload. */
export function triggerEvent(
    element: Element,
    name: string,
    detail?: Record<string, unknown>,
): CustomEvent {
    const event = new CustomEvent(name, { bubbles: true, cancelable: true })
    if (detail) Object.assign(event, detail)
    element.dispatchEvent(event)
    return event
}

// Scroll-edge affordance for horizontally scrollable containers (tables).
// Toggles `tc-scroll-shadow--start/--end` on a wrapping shell so CSS can fade
// in gradient shadows at whichever edge has clipped content — the visual cue
// that a 390px viewport is only showing part of the table. The shell owns the
// pseudo-element overlays (see foundation/_utilities.scss); the scroller is the
// actual overflow-x container inside it.

/**
 * Wire scroll/resize listeners that keep the shell's edge-shadow classes in
 * sync with the scroller's position. Returns an unbind function — call it
 * before re-rendering (the old nodes are being thrown away) and on disconnect.
 */
export function wireScrollEdges(shell: HTMLElement, scroller: HTMLElement): () => void {
    const update = (): void => {
        const max = scroller.scrollWidth - scroller.clientWidth
        const x = scroller.scrollLeft
        shell.classList.toggle('tc-scroll-shadow--start', x > 1)
        shell.classList.toggle('tc-scroll-shadow--end', max - x > 1)
    }
    scroller.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // ResizeObserver catches content-driven width changes (rows loading in)
    // that fire neither scroll nor window resize.
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(update)
        ro.observe(scroller)
    }
    update()
    return () => {
        scroller.removeEventListener('scroll', update)
        window.removeEventListener('resize', update)
        ro?.disconnect()
    }
}

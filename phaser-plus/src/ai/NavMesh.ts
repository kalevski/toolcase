/**
 * Grid-aligned navigation mesh. Subclass and override `isBlocked` (and
 * optionally `cost`) to plug your tilemap / world into the path finder.
 */
export default abstract class NavMesh {

    /** Return true when the cell at (x, y) cannot be traversed. */
    abstract isBlocked(x: number, y: number): boolean

    /** Per-cell cost multiplier. Default 1. Override for weighted tiles (mud, water). */
    cost(_x: number, _y: number): number {
        return 1
    }

}

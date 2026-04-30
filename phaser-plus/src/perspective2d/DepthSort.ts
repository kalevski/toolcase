import type GameObject2D from './GameObject2D'

type SortFn = (a: GameObject2D, b: GameObject2D) => number

type SortKey = 'normalSort' | 'inverseXSort' | 'inverseYSort' | 'inverseSort' | 'disabledSort'

export default class DepthSort {

    private sortFn: SortKey = 'normalSort'

    setup(): void {
        this.sortFn = 'normalSort'
    }

    disable(): void {
        this.sortFn = 'disabledSort'
    }

    set(inverseX: boolean = false, inverseY: boolean = false): void {
        if (!inverseX && !inverseY) this.sortFn = 'normalSort'
        else if (inverseX && !inverseY) this.sortFn = 'inverseXSort'
        else if (!inverseX && inverseY) this.sortFn = 'inverseYSort'
        else this.sortFn = 'inverseSort'
    }

    private normalSort: SortFn = (a, b) => {
        const d = a.depth - b.depth
        if (d !== 0) return d
        const dy = a.pivot.y - b.pivot.y
        if (dy !== 0) return dy
        return a.pivot.x - b.pivot.x
    }

    private inverseXSort: SortFn = (a, b) => {
        const d = a.depth - b.depth
        if (d !== 0) return d
        const dy = a.pivot.y - b.pivot.y
        if (dy !== 0) return dy
        return b.pivot.x - a.pivot.x
    }

    private inverseYSort: SortFn = (a, b) => {
        const d = a.depth - b.depth
        if (d !== 0) return d
        const dy = b.pivot.y - a.pivot.y
        if (dy !== 0) return dy
        return a.pivot.x - b.pivot.x
    }

    private inverseSort: SortFn = (a, b) => {
        const d = a.depth - b.depth
        if (d !== 0) return d
        const dy = b.pivot.y - a.pivot.y
        if (dy !== 0) return dy
        return b.pivot.x - a.pivot.x
    }

    private disabledSort: SortFn = () => 0

    get fn(): SortFn {
        return this[this.sortFn]
    }

}

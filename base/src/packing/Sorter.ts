import { PreparedSprite, SortStrategy } from './types'

class Sorter {

    private strategy: SortStrategy

    constructor(strategy: SortStrategy = 'max-side-desc') {
        this.strategy = strategy
    }

    sort(sprites: PreparedSprite[]): PreparedSprite[] {
        const copy = sprites.slice()
        const fn = this.compareFn()
        copy.sort(fn)
        return copy
    }

    private compareFn(): (a: PreparedSprite, b: PreparedSprite) => number {
        switch (this.strategy) {
            case 'area-desc': return (a, b) => b.width * b.height - a.width * a.height
            case 'max-side-desc': return (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height)
            case 'height-desc': return (a, b) => b.height - a.height
            case 'width-desc': return (a, b) => b.width - a.width
            case 'perimeter-desc': return (a, b) => (b.width + b.height) - (a.width + a.height)
        }
    }

}

export default Sorter

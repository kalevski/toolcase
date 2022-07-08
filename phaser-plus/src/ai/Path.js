import { Broadcast, PriorityQueue } from '@toolcase/base'
import { Math } from 'phaser'
import PathNode from './PathNode'

/**
 * @typedef EventTypes
 * @type {('found')}
 */

/**
 * @extends Broadcast<EventTypes,any,any>
 */
class Path extends Broadcast {

    /**
     * @readonly
     */
    iterations = 0

    /**
     * @readonly
     * @type {PriorityQueue<PathNode>}
     */
    queue = new PriorityQueue(node => node.properties.F, node => node.id)

    /** @readonly  */
    start = new Math.Vector2()

    /** @readonly  */
    current = new Math.Vector2()

    /** @readonly  */
    end = new Math.Vector2()

    /** @readonly */
    progress = 0

    /**
     * @readonly
     * @type {Array<PathNode>}
     */
    stack = []

    /**
     * @readonly
     * @type {Array<PathNode>}
     */
    nodes = []

    get inProgress() {
        return !this.current.equals(this.end)
    }

    set(fromX, fromY, toX, toY) {
        this.start.setTo(fromX, fromY)
        this.current.setTo(fromX, fromY)
        this.end.setTo(toX, toY)
    }

}

/** @enum {string} */
Path.Events = {
    FOUND: 'found'
}

export default Path
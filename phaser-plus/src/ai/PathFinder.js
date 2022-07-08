import { ObjectPool } from '@toolcase/base'
import Path from './Path'
import NavMesh from './NavMesh'
import PathIterator from './PathIterator'

class PathFinder {

    /**
     * @private
     * @type {ObjectPool<Path>}
     */
    pool = new ObjectPool(Path, path => {
        path.iterations = 0
        path.progress = 0
        while(path.queue.length > 0) {
            path.queue.pop().release()
        }
        while(path.nodes.length > 0) {
            path.nodes.pop().release()
        }
        while(path.stack.length > 0) {
            path.stack.pop().release()
        }
        path.clearListeners()
    })

    /**
     * @private
     * @type {PathIterator}
     */
    iterator = null

    /**
     * @private
     * @type {Array<Path>}
     */
    queue = []

    /**
     * 
     * @param {NavMesh} mesh 
     */
    constructor(mesh) {
        this.iterator = new PathIterator(mesh)
    }

    /**
     * 
     * @param {number} fromX 
     * @param {number} fromY 
     * @param {number} toX 
     * @param {number} toY 
     */
    find(fromX, fromY, toX, toY) {
        let path = this.pool.obtain()
        path.set(fromX, fromY, toX, toY)
        this.iterator.begin(path)
        this.queue.push(path)
        return path
    }

    /** @protected */
    onUpdate() {
        let path = this.queue.shift() || null
        if (path === null) {
            return
        }
        if (path.inProgress) {
            this.iterator.iterate(path)
            this.queue.push(path)
        } else {
            this.iterator.end(path)
        }
    }

}

export default PathFinder
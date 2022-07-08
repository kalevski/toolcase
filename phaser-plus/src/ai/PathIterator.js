import Phaser from 'phaser'
import { ObjectPool } from '@toolcase/base'
import NavMesh from './NavMesh'
import Path from './Path'
import PathNode from './PathNode'

class PathIterator {

    /**
     * @private
     * @type {ObjectPool<PathNode>}
     */
    nodePool = new ObjectPool(PathNode, node => {
        node.id = null
        node.parent = null
    })

    /**
     * @private
     * @type {NavMesh}
     */
    mesh = null

    /**
     * 
     * @param {NavMesh} mesh 
     */
    constructor(mesh) {
        this.mesh = mesh
    }

    neighbours = [
        new Phaser.Math.Vector2(-1, 0),
        new Phaser.Math.Vector2(1, 0),
        new Phaser.Math.Vector2(0, -1),
        new Phaser.Math.Vector2(0, 1)
    ]

    /**
     * 
     * @param {Path} path 
     */
    begin(path) {
        let node = this.nodePool.obtain()
        node.setTo(path.start.x, path.start.y)
        node.properties.G = 0
        node.properties.H = this.getDistance(path.start, path.end)
        path.queue.enqueue(node)

        // check for availability
    }

    /**
     * 
     * @param {Path} path 
     */
    iterate(path) {
        let current = path.queue.dequeue()

        if (current === null) {
            throw new Error('hehe!')
        }

        path.stack.push(current)

        path.current.setTo(current.x, current.y)
        for (let direction of this.neighbours) {
            let blocked = this.mesh.isBlocked(
                direction.x + path.current.x,
                direction.y + path.current.y
            )
            if (blocked) {
                continue
            }

            let neighbour = this.nodePool.obtain()
            neighbour.setTo(
                direction.x + path.current.x,
                direction.y + path.current.y
            )
            
            
            
            if (path.queue.has(neighbour)) {
                neighbour.release()
                continue
            }
            
            neighbour.properties.G = current.properties.G + 1
            neighbour.properties.H = this.getDistance(neighbour, path.end)
            neighbour.parent = current
            path.queue.enqueue(neighbour)
            
        }
        ++path.iterations
    }

    /**
     * 
     * @param {Path} path 
     */
    end(path) {
        let node = path.stack[path.stack.length - 1]
        while(node.parent !== null) {
            let point = this.nodePool.obtain()
            point.setTo(node.x, node.y)
            point.properties.G = node.properties.G
            point.properties.H = node.properties.H
            path.nodes.unshift(point)

            node = node.parent
        }
        
        while(path.stack.length > 0) {
            path.stack.pop().release()
        }

        while(path.queue.length > 0) {
            path.queue.pop().release()
        }
        path.emit(Path.Events.FOUND)
    }

    /**
     * heuristics (Manhattan distance)
     * @param {PathNode} pointA 
     * @param {PathNode} pointB 
     */
    getDistance(pointA, pointB) {
        return Math.abs(pointB.x - pointA.x) + Math.abs(pointB.y - pointA.y)
    }

}

export default PathIterator
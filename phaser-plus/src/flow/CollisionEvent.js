import Event from './Event'

class CollisionEvent extends Event {

    get type() {
        return 'collision_event'
    }

    /** @private */
    onFire() {}

    /** @protected */
    onEnter(bodyA, bodyB, event) {}

    /** @protected */
    onExit(bodyA, bodyB, event) {}

}

export default CollisionEvent
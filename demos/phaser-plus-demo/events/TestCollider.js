import { Flow } from '@toolcase/phaser-plus'

class TestCollider extends Flow.CollisionEvent {

    onEnter(bodyA, bodyB) {
        // bodyA.gameObject.setVelocityX(10)
    }

    onExit(bodyA, bodyB) {}

}

export default TestCollider
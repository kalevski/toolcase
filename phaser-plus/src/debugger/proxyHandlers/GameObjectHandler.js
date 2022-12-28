import GameObject from '../../base/GameObject'
import ProxyHandler from './ProxyHandler'

/**
 * @extends {ProxyHandler<GameObject>}
 */
class GameObjectHandler extends ProxyHandler {

    get x() {
        return this.ref.x
    }

    set x(value) {
        this.ref.setX(value)
    }

    get y() {
        return this.ref.x
    }

    set y(value) {
        this.ref.setY(value)
    }

}

export default GameObjectHandler
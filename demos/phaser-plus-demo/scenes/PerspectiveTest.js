import { Features, Perspective2D, Scene, Structs } from '@toolcase/phaser-plus'
import Barrel from '../prefabs/Barrel'

class PerspectiveTest extends Scene {

    /**
     * @private
     * @type {Features.ScreenLayout}
     */
    layout = null

    /**
     * @private
     * @type {Perspective2D.World}
     */
    world = null

    /**
     * @private
     * @type {Perspective2D.DebugGrid}
     */
    debugGrid = null

    onCreate() {
        
        this.layout = this.features.register('layout', Features.ScreenLayout)

        this.debugGrid = this.features.register('debug', Perspective2D.DebugGrid)

        this.world = this.features.register('world', Perspective2D.World, {
            projection: Structs.Matrix2.create(64, 64, 0, 0)
        })

        this.layout.add(this.debugGrid)
        this.layout.add(this.world)
        // this.world.add(this.debugGrid)

        this.debugGrid.draw(this.world.projection)

        this.world.objects.register('barrel', Barrel)

        this.player = this.world.objects.add('barrel', 0, 0)

    }

    update(time, delta) {
        super.update(time, delta)
        this.player.x += 0.05 * delta
        this.player.y += 0.05 * delta
    }

    onDestroy() {

    }

}

export default PerspectiveTest
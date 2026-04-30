import { Structs } from '@toolcase/phaser-plus'
import { GameObject2D, Scene2D } from '@toolcase/phaser-plus'
import Barrel2D from './prefabs/Barrel2D'
import RoundTable2D from './prefabs/RoundTable2D'
import Fireplace2D from './prefabs/Fireplace2D'

class WorldReset extends Scene2D {

    label = null

    onInit() {
        this.world.projection = Structs.Matrix2.createISO(64)
        this.world.debug()
    }

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onCreate() {
        this.world.register('barrel', Barrel2D)
        this.world.register('table', RoundTable2D)
        this.world.register('fireplace', Fireplace2D)

        this.populate()

        this.label = this.add.text(0, -300,
            'SPACE = clear world (release to pool)   R = repopulate', {
                font: '18px Courier',
                color: '#ffeb3b'
            }).setOrigin(0.5)
        this.ui.container.add(this.label)

        this.input.keyboard.on('keydown-SPACE', () => {
            this.world.clear()
        })

        this.input.keyboard.on('keydown-R', () => {
            this.world.clear()
            this.populate()
        })
    }

    populate() {
        this.world.add('fireplace', 0, 0)
        this.world.add('table', 2, 2)
        this.world.add('barrel', -2, -1)
        this.world.add('barrel', 3, -2)
        this.world.add('barrel', -1, 3)
        this.world.sort.set()
    }
}

export default WorldReset

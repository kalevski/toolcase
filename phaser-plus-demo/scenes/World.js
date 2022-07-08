import { Scene, Features, ISO, Flow } from '@toolcase/phaser-plus'
import GameUI from '../features/GameUI'
import Barrel from '../prefabs/Barrel'

class World extends Scene {

    inputs = {
        /** @type {Features.KeyboardInput} */
        A: null,
        /** @type {Features.KeyboardInput} */
        B: null
    }

    /** @type {ISO.ISOWorld} */
    world = null

    /** @type {Features.SplitScreen} */
    screen = null

    /** @type {GameUI} */
    ui = null

    onCreate() {
        let sensorProcessor = new Flow.MatterJSProcessor(this.matter.world)
        this.flow.setSensorProcessor(sensorProcessor)

        this.inputs.A = this.features.register('input_A', Features.KeyboardInput, {
            movement: [ 'W', 'S', 'A', 'D' ],
            action: 'F'
        })

        this.inputs.A = this.features.register('input_B', Features.KeyboardInput, {
            movement: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
            action: 'ENTER'
        })

        this.world = this.features.register('world', ISO.ISOWorld)


        this.screen = this.features.register('screen', Features.SplitScreen)
        this.ui = this.features.register('ui', GameUI)

        this.screen.cameras.A.ignore(this.ui)
        this.screen.cameras.B.ignore(this.ui)
        this.screen.cameras.ui.ignore(this.world)

        this.world.objects.register('barrel', Barrel)

        let distance = 3.5

        let barrelA = this.world.objects.add('barrel', -distance, -distance)
        let barrelB = this.world.objects.add('barrel', distance, distance)
        let barrelC = this.world.objects.add('barrel', -distance, distance)
        let barrelD = this.world.objects.add('barrel', distance, -distance)

        this.screen.follow(barrelC, barrelD)

        let bg = this.add.image(0, 0, 'lobby')
        this.world.add(bg)

        if (typeof this.matter.world.debugGraphic !== 'undefined') {
            this.screen.cameras.ui.ignore(this.matter.world.debugGraphic)
        }

    }

}

export default World
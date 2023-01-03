import { Flow, Perspective2D } from "@toolcase/phaser-plus";

class MyEvent extends Flow.Event {

    onFire(payload) {
        // let iterator = 100
        // while(iterator > 0) {
        //     iterator--
        //     let x = Math.floor(Math.random() * 20) - 10
        //     let y = Math.floor(Math.random() * 20) - 10
        //     this.scene.world.add('barrel', x, y)
        // }
        // this.scene.world.add('barrel', 0, 0)

        /** @type {Perspective2D.World} */
        let world = this.scene.features.get('world')
        world.depth.set(true, false)
    }

}

export default MyEvent
import { Flow } from "@toolcase/phaser-plus";

class MyEvent extends Flow.Event {

    onFire(payload) {
        console.log('manual trigger', payload)
    }

}

export default MyEvent
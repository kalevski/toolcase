import { Flow } from "@toolcase/phaser-plus";

class TestTimer extends Flow.TimeEvent {

    onFire(times) {
        // console.log('fire', times)
    }

}

export default TestTimer
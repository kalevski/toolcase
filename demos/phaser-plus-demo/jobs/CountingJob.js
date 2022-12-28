import { AdjacencyMatrix } from "@toolcase/base";
import { Flow } from "@toolcase/phaser-plus";

class CountingJob extends Flow.Job {

    counter = 0

    onUpdate(time, delta) {
        const { id, count } = this.payload
        this.counter++
        console.log(`${id}: ${this.counter}, target: ${count}`)
        return this.counter >= count
    }

    onComplete() {
        

        const { id, count } = this.payload
        console.log(`${id}: completed`)
    }

    onTerminate(error) {
        const { id, count } = this.payload
        console.log(`${id}: terminated`)
    }

    /** @private */
    onFire() {}

    /** @private */
    onDestroy() {}

}

export default CountingJob
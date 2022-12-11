import { Broadcast } from '@toolcase/base'
import Event from './Event'

class Job extends Event {

    events = new Broadcast()

    /** @private */
    onFire() {}

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {

    }

    /**
     * @protected
     * @returns {boolean}
     */
    isDone() { return true }

}

Job.Events = {
    ON_COMPLETE: 'on_complete'
}

export default Job
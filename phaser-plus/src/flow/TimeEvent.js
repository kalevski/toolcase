import Event from './Event'

class TimeEvent extends Event {

    get type() {
        return 'time_event'
    }

    /**
     * @protected
     * @param {number} times 
     */
    onFire(times) {}

}

export default TimeEvent
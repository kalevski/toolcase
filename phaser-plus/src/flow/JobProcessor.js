import FlowProcessor from './FlowProcessor'

class JobProcessor extends FlowProcessor {

    /** @protected */
    onCreate() {}

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {}

    /** @protected */
    onDestroy() {}

    run(job) {

    }

}

export default JobProcessor
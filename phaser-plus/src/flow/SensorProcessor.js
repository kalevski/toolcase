import SensorEvent from './SensorEvent'

class SensorProcessor {

    /**
     * @protected
     * @param {Map<string,SensorEvent>} events 
     */
    onCreate(events) {}

    /** @protected */
    onDestroy() {}

    /**
     * @param {GameObjects.GameObject} gameObject 
     * @param {string} actionName 
     */
    doAction(gameObject, actionName) {}

    /**
     * @protected
     * @param {string} eventName 
     */
    getLabel(eventName) {
        return null
    }

}

export default SensorProcessor
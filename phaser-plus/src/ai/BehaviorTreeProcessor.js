import FlowProcessor from '../flow/FlowProcessor'

class BehaviorTreeProcessor extends FlowProcessor {

    /** @protected */
    onCreate() {}

    /** @protected */
    onUpdate() {}

    /** @protected */
    onDestroy() {}

    /**
     * @template {Whiteboard} T
     * @param {string} key
     * @param {T} whiteboard
     * @returns {BehaviorTree<T>} 
     */
    define(key, whiteboard, structure) {}

    trigger(key) {}
    
    // TODO: mechanism for creating complex tree structures that are capable of calling flow events
    // an event or situation in the game can call one of the trees defined here
}

export default BehaviorTreeProcessor
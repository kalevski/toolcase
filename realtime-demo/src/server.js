const { Serializer } = require('@toolcase/base')
const { Level } = require('@toolcase/logging')
const { Realtime, logging, Transports, AuthMiddleware, Room } = require('@toolcase/realtime')

logging.level = Level.VERBOSE

const serializer = new Serializer()

serializer.define('test', [
    { key: 'types', type: 'int32', rule: 'repeated' }
])

serializer.define('my_topic', [
    { key: 'names', type: 'bool', rule: 'repeated' },
    { key: 'test', type: 'test', rule: 'required' }
])

class MyRoom extends Room {
    
    onCreate() {
        this.listen('my_topic', this.onMyTopic)
    }

    onDestroy() {
        
    }

    /** @type {import('@toolcase/realtime').TopicListener} */
    onMyTopic(actor, payload) {
        actor.send('my_topic', serializer.encode('my_topic', {
            names: [true, false, true, true, false, false, false, false, false, false, false, false, false, false, false, false, false],
            test: {
                types: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]
            }
        }))
    }
}

class Auth extends AuthMiddleware {
    getRoomId() {
        return 'test'
    }
}

const realtime = new Realtime({
    transports: [ new Transports.WSTransport({
        port: 3000
    }) ],
    authMiddleware: new Auth()
})

realtime.rooms.define('my_room', MyRoom)
realtime.rooms.create('my_room', 'test')

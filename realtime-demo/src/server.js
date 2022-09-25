const { Level } = require('@toolcase/logging')
const { Realtime, logging, Transports, AuthMiddleware, Room } = require('@toolcase/realtime')

logging.level = Level.VERBOSE

class MyRoom extends Room {
    onCreate() {
        this.listen('my_topic', this.onMyTopic)
    }

    onDestroy() {
        
    }

    /** @type {import('@toolcase/realtime').TopicListener} */
    onMyTopic(actor, payload) {
        console.log(payload.toString())
        actor.send('my_topic', 'hey')
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

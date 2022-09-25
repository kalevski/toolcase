const { Serializer } = require('@toolcase/base')
const { Level } = require('@toolcase/logging')
const { Realtime, logging, Transports, AuthMiddleware, Room, Clients } = require('@toolcase/realtime')
const { WebSocket } = require('ws')

logging.level = Level.VERBOSE


let serializer = new Serializer()

serializer.define('toolcase_realtime_message', [
    { key: 'topic', type: 'string', rule: 'required' },
    { key: 'payload', type: 'bytes', rule: 'required' },
    { key: 'sender', type: 'string', rule: 'optional' }
])

class MyRoom extends Room {

    onCreate() {
        this.listen('my_topic', this.onMyTopic)
        setTimeout(() => {
            this.broadcast('hello', 'yey')
        }, 2000)
    }

    onDestroy() {
        
    }

    /** @type {import('@toolcase/realtime').TopicListener} */
    onMyTopic(actor, payload) {
        // console.log('message received', actor.id, payload.toString('utf-8'))
    }

}

class Auth extends AuthMiddleware {

    getData() {
        return {
            something: 1
        }
    }

    validateTicket(ticket) {
        if (ticket === 'test') {
            return true
        }
    }

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

let room = realtime.rooms.create('my_room', 'test')


// console.log(room)

// realtime.rooms.destroy(room.id)

const connectToServer = () => {
    let client = new Clients.WSClient('ws://localhost:3000')
    client.connect('test')

    client.on('client:connect', (payload) => {
        client.send('my_topic', 'hejjj')
    })

    client.on('hello', payload => {
        console.log(payload.toString())
    })
}

setTimeout(connectToServer, 1000)
